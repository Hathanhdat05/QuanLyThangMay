import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import customerRoutes from './routes/customers.js';
import elevatorRoutes from './routes/elevators.js';
import productRoutes from './routes/products.js';
import contractRoutes from './routes/contracts.js';
import errorReportRoutes from './routes/errorReports.js';
import dashboardRoutes from './routes/dashboard.js';
import notificationRoutes from './routes/notifications.js';
import maintenanceScheduleRoutes from './routes/maintenanceSchedules.js';
import maintenanceOrderRoutes from './routes/maintenanceOrders.js';
import { runMaintenanceNotifications } from './jobs/maintenanceNotifications.js';

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/elevators', elevatorRoutes);
app.use('/api/products', productRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/error-reports', errorReportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/maintenance-schedules', maintenanceScheduleRoutes);
app.use('/api/maintenance-orders', maintenanceOrderRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      // Chạy job thông báo bảo trì ngay khi khởi động (sau 5s) và mỗi 24 giờ
      setTimeout(() => runMaintenanceNotifications(), 5000);
      setInterval(runMaintenanceNotifications, 24 * 60 * 60 * 1000);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });
