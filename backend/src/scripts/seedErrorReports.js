import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { ErrorReport } from '../models/ErrorReport.js';
import { Customer } from '../models/Customer.js';
import { Elevator } from '../models/Elevator.js';
import { User } from '../models/User.js';

function formatDateYYYYMMDD(date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

async function generateUniqueErrorId() {
  const datePart = formatDateYYYYMMDD(new Date());
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    const errorId = `BL${datePart}-${rand}`;
    const exists = await ErrorReport.exists({ errorId });
    if (!exists) return errorId;
  }
  const fallback = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `BL${datePart}-${fallback}`;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

const TITLES = [
  'Thang máy kêu to bất thường',
  'Cửa thang không đóng kín',
  'Thang dừng giữa tầng',
  'Bảng điều khiển không phản hồi',
  'Bảo trì định kỳ tháng',
  'Kiểm tra an toàn sau sự cố mất điện',
  'Thay dây cáp và bảo trì',
  'Bảo hành lần 1 - Kiểm tra tổng thể',
  'Sửa chữa cabin bị rung',
  'Thang chạy chậm bất thường',
  'Cảnh báo lỗi trên màn hình',
  'Bảo trì hệ thống cửa tầng',
  'Bảo hành thay thế linh kiện',
  'Thang không lên tầng cao nhất',
  'Bảo trì hệ thống phanh khẩn cấp',
];

const DESCRIPTIONS = [
  'Khách hàng báo thang máy phát ra tiếng kêu lạ khi vận hành. Cần kiểm tra động cơ và ray dẫn.',
  'Cửa thang đóng không khít, có khe hở. Kiểm tra cảm biến và cơ cấu đóng mở.',
  'Thang dừng giữa hai tầng, hành khách kẹt bên trong đã được giải cứu. Cần kiểm tra toàn bộ.',
  'Bảng bấm tầng không phản hồi. Nghi ngờ lỗi mạch điều khiển.',
  'Bảo trì định kỳ theo hợp đồng. Kiểm tra dầu, dây cáp, cửa và hệ thống an toàn.',
  'Sau sự cố mất điện, cần kiểm tra hệ thống an toàn và hoạt động bình thường.',
  'Thay thế dây cáp theo lịch và bảo trì toàn diện.',
  'Bảo hành lần 1: kiểm tra tổng thể, siết chặt bulong, vệ sinh hố thang.',
  'Cabin rung khi di chuyển. Kiểm tra ray, con lăn và cân chỉnh.',
  'Tốc độ thang chậm hơn bình thường. Kiểm tra biến tần và tải.',
  'Màn hình hiển thị mã lỗi. Cần đọc mã và xử lý theo hướng dẫn.',
  'Bảo trì cửa tầng: cảm biến, motor và ray cửa.',
  'Bảo hành thay thế linh kiện theo chính sách.',
  'Thang không lên được tầng trên cùng. Kiểm tra giới hạn tầng và điều khiển.',
  'Bảo trì hệ thống phanh khẩn cấp và thử nghiệm an toàn.',
];

const TYPES = ['maintenance', 'warranty'];
const STATUSES = ['pending', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

function getArgValue(key, defaultValue) {
  const argv = process.argv.slice(2);
  const direct = argv.find((a) => a.startsWith(`${key}=`));
  if (direct) return direct.slice(key.length + 1);
  const idx = argv.indexOf(key);
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return defaultValue;
}

function randomDate(daysAgoMin, daysAgoMax) {
  const d = new Date();
  const days = randInt(daysAgoMin, daysAgoMax);
  d.setDate(d.getDate() - days);
  return d;
}

async function main() {
  const count = Number(getArgValue('--count', '15'));
  const reset = process.argv.slice(2).includes('--reset');

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error('Invalid --count. Example: --count 15');
  }

  await connectDB();

  if (reset) {
    const r = await ErrorReport.deleteMany({});
    console.log(`Deleted ${r.deletedCount ?? 0} error reports`);
  }

  const customers = await Customer.find({}).select('_id').lean();
  const elevators = await Elevator.find({}).select('_id').lean();
  const users = await User.find({}).select('_id').lean();

  if (!customers.length || !elevators.length) {
    throw new Error('Cần có ít nhất 1 khách hàng và 1 thang máy. Chạy seed:customers và seed:elevators trước.');
  }

  const titlesUsed = new Set();
  let created = 0;

  for (let i = 0; i < count; i += 1) {
    const errorId = await generateUniqueErrorId();
    const title = TITLES[i % TITLES.length];
    const desc = DESCRIPTIONS[i % DESCRIPTIONS.length];
    const type = pick(TYPES);
    const status = pick(STATUSES);
    const priority = pick(PRIORITIES);
    const reported_date = randomDate(0, 60);
    const scheduled_date = status !== 'pending' ? randomDate(-30, 30) : randomDate(1, 14);
    const completed_date =
      status === 'resolved' || status === 'closed' ? randomDate(0, 20) : undefined;

    const payload = {
      errorId,
      elevator_id: pick(elevators)._id,
      customer_id: pick(customers)._id,
      contract_id: null,
      reported_by: users.length ? pick(users)._id : undefined,
      title: titlesUsed.has(title) ? `${title} (${i + 1})` : title,
      description: desc,
      type,
      status,
      priority,
      reported_date,
      scheduled_date: scheduled_date || undefined,
      completed_date: completed_date || undefined,
    };

    if (!titlesUsed.has(title)) titlesUsed.add(title);

    try {
      await new ErrorReport(payload).save();
      created += 1;
    } catch (err) {
      if (err?.code === 11000) {
        i -= 1;
        continue;
      }
      throw err;
    }
  }

  console.log(`Seeded ${created} error reports (báo lỗi)`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
