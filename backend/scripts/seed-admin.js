/**
 * Tạo user admin mặc định nếu chưa có.
 * Chạy: node scripts/seed-admin.js
 * Đăng nhập: email = admin@example.com, password = admin123
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/thangmay3';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  const exists = await User.findOne({ email: 'admin@example.com' });
  if (exists) {
    console.log('Admin user đã tồn tại.');
    process.exit(0);
    return;
  }
  const user = new User({
    email: 'admin@example.com',
    passwordHash: 'admin123',
    full_name: 'Administrator',
    role: 'admin',
    phone: '',
  });
  await user.save();
  console.log('Đã tạo admin: admin@example.com / admin123');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
