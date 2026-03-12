import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
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
import pushSubscriptionRoutes from './routes/pushSubscriptions.js';
import calendarFeedRoutes from './routes/calendarFeeds.js';
import googleCalendarRoutes from './routes/googleCalendar.js';
import maintenanceScheduleRoutes from './routes/maintenanceSchedules.js';
import maintenanceOrderRoutes from './routes/maintenanceOrders.js';
import { runMaintenanceNotifications } from './jobs/maintenanceNotifications.js';
import { migrateScheduledDatesToDateOnly } from './jobs/migrateDateOnlyScheduledDates.js';
import { bootstrapGoogleCalendarOnStartup } from './services/googleCalendarSync.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const isDev = process.env.NODE_ENV !== 'production';

const allowedOrigins = new Set(
  CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const isDevPrivateNetworkOrigin = (origin) =>
  /^http:\/\/((localhost)|(127\.0\.0\.1)|(10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})|(192\.168\.\d{1,3}\.\d{1,3}))(:\d+)?$/.test(
    origin
  );

const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (allowedOrigins.has(origin)) return callback(null, true);
  if (isDev && isDevPrivateNetworkOrigin(origin)) return callback(null, true);
  return callback(new Error(`CORS blocked for origin: ${origin}`));
};

const io = new SocketServer(httpServer, {
  cors: { origin: corsOrigin, credentials: true },
});

export { io };

app.use(cors({ origin: corsOrigin, credentials: true }));
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
app.use('/api/push-subscriptions', pushSubscriptionRoutes);
app.use('/api/calendar-feeds', calendarFeedRoutes);
app.use('/api/google-calendar', googleCalendarRoutes);
app.use('/api/maintenance-schedules', maintenanceScheduleRoutes);
app.use('/api/maintenance-orders', maintenanceOrderRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

connectDB()
  .then(() => {
    migrateScheduledDatesToDateOnly().catch((err) =>
      console.error('Date-only migration failed:', err?.message || err)
    );
    bootstrapGoogleCalendarOnStartup().catch((err) =>
      console.error('Google Calendar bootstrap startup error:', err?.message || err)
    );
    httpServer.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      setTimeout(() => runMaintenanceNotifications(), 5000);
      setInterval(runMaintenanceNotifications, 24 * 60 * 60 * 1000);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });
