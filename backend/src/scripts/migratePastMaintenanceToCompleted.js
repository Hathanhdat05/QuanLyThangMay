import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { MaintenanceSchedule } from '../models/MaintenanceSchedule.js';
import { MaintenanceOrder } from '../models/MaintenanceOrder.js';
import { toDateOnly } from '../utils/dateOnly.js';

async function main() {
  await connectDB();

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

  console.log(
    `[migratePastMaintenanceToCompleted] today=${todayDateOnly} schedules=${schedulesUpdated} orders=${ordersUpdated}`
  );
}

main()
  .catch((err) => {
    console.error('[migratePastMaintenanceToCompleted] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
