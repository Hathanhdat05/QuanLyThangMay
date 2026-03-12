import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { migratePastMaintenanceToCompleted } from '../jobs/migratePastMaintenanceToCompleted.js';

async function main() {
  await connectDB();
  const { todayDateOnly, schedulesUpdated, ordersUpdated } =
    await migratePastMaintenanceToCompleted();

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
