import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Customer } from '../models/Customer.js';

function formatDateYYYYMMDD(date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function buildAddress(province, district, addressDetail) {
  const parts = [addressDetail, district, province].filter(Boolean);
  return parts.join(', ') || '';
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function slugifyEmailLocalPart(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

function genVietnamPhone() {
  const prefixes = ['03', '05', '07', '08', '09'];
  const prefix = pick(prefixes);
  const rest = String(randInt(0, 99999999)).padStart(8, '0');
  return `${prefix}${rest}`;
}

async function generateUniqueCustomerId() {
  const datePart = formatDateYYYYMMDD(new Date());
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    const customerId = `KH${datePart}-${rand}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await Customer.exists({ customerId });
    if (!exists) return customerId;
  }
  const fallback = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `KH${datePart}-${fallback}`;
}

function genCustomerProfile(i) {
  const provinceToDistricts = new Map([
    ['TP. Hồ Chí Minh', ['Quận 1', 'Quận 3', 'Quận 7', 'Quận 8', 'TP. Thủ Đức']],
    ['Hà Nội', ['Ba Đình', 'Cầu Giấy', 'Đống Đa', 'Hai Bà Trưng', 'Nam Từ Liêm']],
    ['Đà Nẵng', ['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn']],
    ['Bình Dương', ['Thủ Dầu Một', 'Dĩ An', 'Thuận An']],
    ['Đồng Nai', ['Biên Hòa', 'Long Thành', 'Nhơn Trạch']],
    ['Hải Phòng', ['Hồng Bàng', 'Lê Chân', 'Ngô Quyền', 'Hải An']],
    ['Cần Thơ', ['Ninh Kiều', 'Bình Thủy', 'Cái Răng']],
  ]);

  const streetNames = [
    'Nguyễn Huệ',
    'Lê Lợi',
    'Trần Hưng Đạo',
    'Điện Biên Phủ',
    'Nguyễn Văn Cừ',
    'Cách Mạng Tháng 8',
    'Hai Bà Trưng',
    'Võ Thị Sáu',
    'Phan Xích Long',
    'Hoàng Diệu',
  ];

  const regions = ['Miền Bắc', 'Miền Trung', 'Miền Nam'];

  const individualLastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Võ', 'Đặng', 'Bùi', 'Đỗ'];
  const individualMiddleNames = ['Văn', 'Thị', 'Minh', 'Đức', 'Anh', 'Hồng', 'Ngọc', 'Gia', 'Quang', 'Thu'];
  const individualFirstNames = [
    'An',
    'Bảo',
    'Chi',
    'Dũng',
    'Hà',
    'Hải',
    'Hạnh',
    'Hiếu',
    'Huy',
    'Khánh',
    'Lan',
    'Linh',
    'Long',
    'Mai',
    'Nam',
    'Ngân',
    'Nhi',
    'Phúc',
    'Quân',
    'Tâm',
    'Thảo',
    'Trang',
    'Trí',
    'Tuấn',
    'Vy',
  ];

  const companyHeads = ['Công ty', 'CTCP', 'TNHH', 'Doanh nghiệp'];
  const companyBodies = [
    'An Phát',
    'Minh Long',
    'Thành Công',
    'Hưng Thịnh',
    'Hoàng Gia',
    'Việt Tín',
    'Phúc Khang',
    'Đại Dương',
    'Sao Mai',
    'Tân Việt',
    'GreenLift',
    'SkyTower',
  ];
  const companyTails = ['Group', 'JSC', 'Co.', 'Holding', ''];

  const province = pick([...provinceToDistricts.keys()]);
  const district = pick(provinceToDistricts.get(province));
  const addressDetail = `${randInt(1, 999)} ${pick(streetNames)}`;
  const address = buildAddress(province, district, addressDetail);

  const customerType = i % 2 === 0 ? 'individual' : 'business';
  const name =
    customerType === 'individual'
      ? `${pick(individualLastNames)} ${pick(individualMiddleNames)} ${pick(individualFirstNames)}`.replace(/\s+/g, ' ').trim()
      : `${pick(companyHeads)} ${pick(companyBodies)} ${pick(companyTails)}`.replace(/\s+/g, ' ').trim();
  const emailLocal = `${slugifyEmailLocalPart(name)}-${String(i + 1).padStart(3, '0')}`;
  const emailDomains = ['gmail.com', 'outlook.com', 'example.com'];
  const email = `${emailLocal}@${pick(emailDomains)}`;

  return {
    customerType,
    name,
    email,
    phone: genVietnamPhone(),
    region: pick(regions),
    province,
    district,
    addressDetail,
    address,
    note: 'Mock data (seed script)',
  };
}

function getArgValue(key, defaultValue) {
  const argv = process.argv.slice(2);
  const direct = argv.find((a) => a.startsWith(`${key}=`));
  if (direct) return direct.slice(key.length + 1);
  const idx = argv.indexOf(key);
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return defaultValue;
}

async function main() {
  const count = Number(getArgValue('--count', '100'));
  const reset = process.argv.slice(2).includes('--reset');

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error('Invalid --count. Example: --count 100');
  }

  await connectDB();

  if (reset) {
    const r = await Customer.deleteMany({});
    console.log(`Deleted ${r.deletedCount ?? 0} customers`);
  }

  let created = 0;
  for (let i = 0; i < count; i += 1) {
    const base = genCustomerProfile(i);
    // eslint-disable-next-line no-await-in-loop
    const customerId = await generateUniqueCustomerId();
    try {
      // eslint-disable-next-line no-await-in-loop
      await new Customer({ ...base, customerId }).save();
      created += 1;
    } catch (err) {
      if (err?.code === 11000) {
        // retry this index if collision happened
        i -= 1;
        continue;
      }
      throw err;
    }
  }

  console.log(`Seeded ${created} customers`);
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
