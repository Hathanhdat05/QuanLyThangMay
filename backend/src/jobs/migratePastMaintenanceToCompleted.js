import { MaintenanceSchedule } from '../models/MaintenanceSchedule.js';
import { MaintenanceOrder } from '../models/MaintenanceOrder.js';
import { toDateOnly } from '../utils/dateOnly.js';

/**
 * Mark past planned maintenance records as completed.
 * - By default, keeps overdue "planned" records unchanged so they can still be tracked/rescheduled.
 * - Set AUTO_COMPLETE_PAST_PLANNED_MAINTENANCE=true to enable legacy auto-complete behavior.
 */
export async function migratePastMaintenanceToCompleted() {
  const autoCompletePastPlanned =
    String(process.env.AUTO_COMPLETE_PAST_PLANNED_MAINTENANCE ?? 'false').toLowerCase() === 'true';
  if (!autoCompletePastPlanned) {
    return { todayDateOnly: toDateOnly(new Date()), schedulesUpdated: 0, ordersUpdated: 0, skipped: true };
  }

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
