// Vercel serverless entry point: every /api/* request is rewritten here (see vercel.json)
// and handled by the same Express app that src/server.js runs locally.
import { createApp } from '../src/app.js';

export default createApp();
