import { MaintenanceSchedule } from '../models/MaintenanceSchedule.js';
import { MaintenanceOrder } from '../models/MaintenanceOrder.js';
import { toDateOnly } from '../utils/dateOnly.js';

/**
 * Mark past planned maintenance records as completed.
 * - Only updates records with status "planned"
 * - Keeps "cancelled" and already "completed" records unchanged
 */
export async function migratePastMaintenanceToCompleted() {
  const todayDateOnly = toDateOnly(new Date());
  if (!todayDateOnly) {
    throw new Error('Cannot resolve current date in YYYY-MM-DD format');
  }

  const scheduleResult = await MaintenanceSchedule.updateMany(
    {
      scheduled_date: { $lt: todayDateOnly },
      status: 'planned',
    },
    { $set: { status: 'completed' } }
  );

  const orderResult = await MaintenanceOrder.updateMany(
    {
      scheduled_date: { $lt: todayDateOnly },
      status: 'planned',
    },
    { $set: { status: 'completed' } }
  );

  const schedulesUpdated = scheduleResult?.modifiedCount || 0;
  const ordersUpdated = orderResult?.modifiedCount || 0;

  return { todayDateOnly, schedulesUpdated, ordersUpdated };
}
