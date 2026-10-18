/**
 * Server-side port of the frontend's calculateParkingFee() so that the
 * database (not the browser) is the single source of truth for billing.
 * Minimum 1 billable hour, then 30-minute blocks, plus tax (default 8%).
 */
export function calculateParkingFee(entryTime, exitTime, hourlyTariff, taxRate = 0.08) {
  const diffMs = Math.max(0, exitTime - entryTime);
  const totalMinutes = Math.max(1, Math.ceil(diffMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const durationFormatted = `${hours > 0 ? `${hours}h ` : ''}${minutes}m`;

  const billableHours = Math.max(1, Math.ceil(totalMinutes / 30) * 0.5);
  const subtotal = Math.round(billableHours * hourlyTariff * 100) / 100;
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  return { durationMinutes: totalMinutes, durationFormatted, billableHours, subtotal, tax, total };
}
