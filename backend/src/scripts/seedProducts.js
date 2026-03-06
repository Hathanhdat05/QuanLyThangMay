import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Product } from '../models/Product.js';

function formatDateYYYYMMDD(date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

async function generateUniqueProductId() {
  const datePart = formatDateYYYYMMDD(new Date());
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    const productId = `SP${datePart}-${rand}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await Product.exists({ productId });
    if (!exists) return productId;
  }
  const fallback = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `SP${datePart}-${fallback}`;
}

function getArgValue(key, defaultValue) {
  const argv = process.argv.slice(2);
  const direct = argv.find((a) => a.startsWith(`${key}=`));
  if (direct) return direct.slice(key.length + 1);
  const idx = argv.indexOf(key);
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return defaultValue;
}

function ensurePlaceholderSvg() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const productsDir = path.join(__dirname, '..', '..', 'uploads', 'products');
  fs.mkdirSync(productsDir, { recursive: true });
  const p = path.join(productsDir, 'placeholder.svg');
  if (fs.existsSync(p)) return;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F0F2F5"/>
      <stop offset="1" stop-color="#D9D9D9"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="48" fill="url(#g)"/>
  <g fill="none" stroke="#8C8C8C" stroke-width="18">
    <rect x="120" y="140" width="272" height="232" rx="24"/>
    <path d="M156 330l78-82 58 60 54-56 66 78"/>
    <circle cx="210" cy="210" r="22"/>
  </g>
  <text x="50%" y="86%" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#595959">
    Product Image
  </text>
</svg>
`;
  fs.writeFileSync(p, svg, 'utf8');
}

function genProduct(i) {
  const names = [
    'Cơ lê',
    'Bulong - ốc vít',
    'Cáp tải',
    'Ray dẫn hướng',
    'Cabin thang máy',
    'Bảng điều khiển',
    'Máy kéo',
    'Bộ cứu hộ tự động',
    'Cảm biến cửa',
    'Biến tần',
    'Động cơ cửa',
    'Nút bấm tầng',
    'Đèn LED cabin',
    'Phanh an toàn',
    'Bộ giới hạn tốc độ',
    'Puly',
    'Dây tín hiệu',
    'Khóa cửa tầng',
    'Bộ giảm chấn',
    'Bảng hiển thị tầng',
  ];

  const units = ['cái', 'bộ', 'chiếc', 'mét', 'cuộn'];
  const materials = ['Inox 304', 'Thép', 'Nhôm', 'Hợp kim', 'Nhựa kỹ thuật'];
  const brands = ['Mitsubishi', 'Fuji', 'Sanyo', 'Kone', 'Otis', 'Schindler', 'Sigma', 'Montanari'];

  const baseName = pick(names);
  const code = String(i + 1).padStart(3, '0');
  const name = `${baseName} ${code}`;

  const brand = pick(brands);
  const material = pick(materials);
  const warranty = randInt(6, 24);
  const price = randInt(50_000, 50_000_000);

  const description = `Sản phẩm ${baseName} dùng cho hệ thống thang máy. Hãng: ${brand}. Vật liệu: ${material}. (Mock data)`;
  const specifications = [
    `Hãng: ${brand}`,
    `Vật liệu: ${material}`,
    `Bảo hành: ${warranty} tháng`,
    `Tiêu chuẩn: ISO 9001`,
    `Xuất xứ: Việt Nam / Nhập khẩu`,
  ].join('\n');

  return {
    name,
    description,
    price,
    unit: pick(units),
    specifications,
    image_url: '/uploads/products/placeholder.svg',
  };
}

async function main() {
  const count = Number(getArgValue('--count', '100'));
  const reset = process.argv.slice(2).includes('--reset');

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error('Invalid --count. Example: --count 100');
  }

  ensurePlaceholderSvg();
  await connectDB();

  if (reset) {
    const r = await Product.deleteMany({});
    console.log(`Deleted ${r.deletedCount ?? 0} products`);
  }

  let created = 0;
  for (let i = 0; i < count; i += 1) {
    const base = genProduct(i);
    // eslint-disable-next-line no-await-in-loop
    const productId = await generateUniqueProductId();
    try {
      // eslint-disable-next-line no-await-in-loop
      await new Product({ ...base, productId }).save();
      created += 1;
    } catch (err) {
      if (err?.code === 11000) {
        i -= 1;
        continue;
      }
      throw err;
    }
  }

  console.log(`Seeded ${created} products`);
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

