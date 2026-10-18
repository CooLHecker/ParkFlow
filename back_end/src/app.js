import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { pool } from './db.js';
import { HttpError } from './errors.js';
import * as svc from './services.js';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();

  api.get('/health', wrap(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  }));

  // One-shot bootstrap for the frontend
  api.get('/state', wrap(async (_req, res) => res.json(await svc.getState())));

  // ParkingLot / ParkingSlot
  api.get('/lots', wrap(async (_req, res) => res.json(await svc.getLots())));
  api.get('/slots', wrap(async (_req, res) => res.json(await svc.getSlots())));
  api.patch('/slots/:slotId/maintenance', wrap(async (req, res) => res.json(await svc.toggleMaintenance(req.params.slotId))));

  // ParkingSession (+ Payment on exit)
  api.post('/sessions/entry', wrap(async (req, res) => {
    const slot = await svc.parkVehicle(req.body ?? {});
    res.status(201).json(slot);
  }));
  api.post('/sessions/exit', wrap(async (req, res) => res.json(await svc.exitVehicle(req.body ?? {}))));

  // Booking
  api.get('/reservations', wrap(async (_req, res) => res.json(await svc.getReservations())));
  api.post('/reservations', wrap(async (req, res) => res.status(201).json(await svc.createReservation(req.body ?? {}))));
  api.post('/reservations/:id/cancel', wrap(async (req, res) => res.json(await svc.cancelReservation(req.params.id))));
  api.post('/reservations/:id/check-in', wrap(async (req, res) => res.json(await svc.checkInReservation(req.params.id))));

  // Payment receipts
  api.get('/receipts', wrap(async (_req, res) => res.json(await svc.getReceipts())));

  // Tariffs
  api.get('/tariffs', wrap(async (_req, res) => res.json(await svc.getTariffs())));
  api.put('/tariffs', wrap(async (req, res) => res.json(await svc.updateTariffs(req.body))));

  app.use('/api', api);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
    switch (err?.code) {
      case 'ER_DUP_ENTRY':
        return res.status(409).json({ error: 'That record already exists or the slot/vehicle is already in use.' });
      case 'ER_LOCK_DEADLOCK':
      case 'ER_LOCK_WAIT_TIMEOUT':
        return res.status(503).json({ error: 'The system is busy, please retry.' });
      default:
        console.error('[error]', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
  });

  return app;
}
