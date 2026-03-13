import { MaintenanceSchedule } from '../models/MaintenanceSchedule.js';
import { MaintenanceOrder } from '../models/MaintenanceOrder.js';
import { Notification } from '../models/Notification.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { sendWebPushNotification } from '../utils/webPush.js';
import { addDaysToDateOnly, parseDateOnlyToDate, toDateOnly } from '../utils/dateOnly.js';
import { io } from '../index.js';

async function broadcastBrowserPush(doc, userId) {
  const subscriptions = await PushSubscription.find({ user_id: userId }).lean();
  if (!subscriptions.length) return;

  const targetUrl = doc.maintenance_schedule_id
    ? `/maintenance-orders/schedule/${doc.maintenance_schedule_id.toString()}/detail`
    : '/notifications';
  const payload = {
    title: doc.title || 'Thông báo mới',
    body: doc.message || '',
    icon: '/logo.png',
    badge: '/logo.png',
    url: targetUrl,
  };

  await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendWebPushNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys?.p256dh,
            auth: sub.keys?.auth,
          },
        },
        payload
      );
      if (result?.expired) {
        await PushSubscription.deleteOne({ _id: sub._id });
      }
    })
  );
}

export async function runMaintenanceNotifications() {
  const todayDateOnly = toDateOnly(new Date());
  const today = parseDateOnlyToDate(todayDateOnly) || new Date();
  const rawNotifyBeforeDays = Number.parseInt(process.env.MAINTENANCE_SCHEDULE_NOTIFY_DAYS || '3', 10);
  const notifyBeforeDays = Number.isFinite(rawNotifyBeforeDays) && rawNotifyBeforeDays >= 1 ? rawNotifyBeforeDays : 3;
  const upcomingToDateOnly = addDaysToDateOnly(todayDateOnly, notifyBeforeDays);
  const changedUserIds = new Set();

  try {
    const upcomingSchedules = await MaintenanceSchedule.find({
      status: 'planned',
      scheduled_date: { $gt: todayDateOnly, $lte: upcomingToDateOnly },
    }).lean();

    for (const schedule of upcomingSchedules) {
      const order = await MaintenanceOrder.findOne({ maintenance_schedule_id: schedule._id })
        .select('assigned_user_ids')
        .lean();
      const assignedUserIds = Array.isArray(order?.assigned_user_ids)
        ? order.assigned_user_ids.map((id) => String(id)).filter(Boolean)
        : [];
      if (assignedUserIds.length === 0) continue;

      const scheduleDate = parseDateOnlyToDate(schedule.scheduled_date) || today;
      const referenceDate = parseDateOnlyToDate(todayDateOnly);
      for (const assignedUserId of assignedUserIds) {
        const exists = await Notification.findOne({
          type: 'maintenance_schedule_upcoming',
          maintenance_schedule_id: schedule._id,
          user_id: assignedUserId,
          // one notification per schedule per day (D-3 -> D-1)
          reference_date: referenceDate,
        });
        if (exists) continue;

        const msInDay = 24 * 60 * 60 * 1000;
        const daysLeft = Math.ceil((scheduleDate.getTime() - today.getTime()) / msInDay);
        const dateText = schedule.scheduled_date || toDateOnly(scheduleDate);
        const dayLabel = daysLeft === 1 ? '1 ngày' : `${daysLeft} ngày`;
        const elevatorText = schedule.elevator_name ? `Thang máy "${schedule.elevator_name}"` : 'Thang máy đã lên lịch';
        const customerText = schedule.customer_name ? `Khách hàng "${schedule.customer_name}", ` : '';
        const doc = await Notification.create({
          title: 'Nhắc bảo trì định kỳ',
          message: `${customerText}${elevatorText} còn ${dayLabel} nữa đến lịch bảo trì (${dateText}). Vui lòng chuẩn bị nhân sự và xác nhận thực hiện đúng hạn.`,
          type: 'maintenance_schedule_upcoming',
          user_id: assignedUserId,
          maintenance_schedule_id: schedule._id,
          elevator_id: schedule.elevator_id,
          contract_id: schedule.contract_id,
          reference_date: referenceDate,
        });
        changedUserIds.add(String(assignedUserId));
        io?.emit?.('notification:new', { ...doc.toJSON(), user_id: String(assignedUserId) });
        await broadcastBrowserPush(doc, assignedUserId);
      }
    }

    if (changedUserIds.size > 0) {
      for (const userId of changedUserIds) {
        const unreadCount = await Notification.countDocuments({
          type: 'maintenance_schedule_upcoming',
          user_id: userId,
          read: false,
        });
        io?.emit?.('notification:unread-count', { user_id: userId, count: unreadCount });
      }
    }
  } catch (err) {
    console.error('Maintenance notifications job error:', err);
  }
}
