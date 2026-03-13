import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const VIEW_PERMISSIONS = [
  'dashboard',
  'customers',
  'contracts',
  'products',
  'elevators',
  'errorReports',
  'maintenanceCalendar',
  'maintenanceOrders',
  'myJobs',
  'notifications',
  'users',
];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    full_name: { type: String, default: '' },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    phone: { type: String, default: '' },
    view_permissions: [{ type: String, enum: VIEW_PERMISSIONS }],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

userSchema.virtual('id').get(function () {
  return this._id?.toHexString();
});

userSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toHexString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
  },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  if (this.passwordHash && !this.passwordHash.startsWith('$2')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
  }
  next();
});

export const User = mongoose.model('User', userSchema);

export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
