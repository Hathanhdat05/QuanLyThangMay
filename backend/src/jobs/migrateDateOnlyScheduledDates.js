import { MaintenanceOrder } from '../models/MaintenanceOrder.js';
import { MaintenanceSchedule } from '../models/MaintenanceSchedule.js';

const DATE_ONLY_TIMEZONE = 'Asia/Ho_Chi_Minh';

export async function migrateScheduledDatesToDateOnly() {
  const scheduleResult = await MaintenanceSchedule.updateMany(
    { scheduled_date: { $type: 'date' } },
    [
      {
        $set: {
          scheduled_date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$scheduled_date',
              timezone: DATE_ONLY_TIMEZONE,
            },
          },
        },
      },
    ]
  );

  const orderResult = await MaintenanceOrder.updateMany(
    { scheduled_date: { $type: 'date' } },
    [
      {
        $set: {
          scheduled_date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$scheduled_date',
              timezone: DATE_ONLY_TIMEZONE,
            },
          },
        },
      },
    ]
  );

  const schedulesUpdated = scheduleResult?.modifiedCount || 0;
  const ordersUpdated = orderResult?.modifiedCount || 0;
  if (schedulesUpdated > 0 || ordersUpdated > 0) {
    console.log(
      `Date-only migration completed: schedules=${schedulesUpdated}, maintenance_orders=${ordersUpdated}`
    );
  }
}
