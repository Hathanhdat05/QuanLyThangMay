import mongoose from 'mongoose';
import { toDateOnly } from '../utils/dateOnly.js';

const maintenanceOrderItemSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, default: 1 },
    unit_price: { type: Number, default: 0 },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    maintenance_schedule_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaintenanceSchedule',
      required: true,
      unique: true,
      index: true,
    },
    contract_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', index: true },
    elevator_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Elevator', index: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', index: true },
    scheduled_date: {
      type: String,
      required: true,
      index: true,
      set: (value) => toDateOnly(value),
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    title: { type: String, default: '' },
    work_content: { type: String, default: '' },
    status: {
      type: String,
      enum: ['planned', 'in_progress', 'completed', 'cancelled'],
      default: 'planned',
    },
    assigned_user_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    items: [maintenanceOrderItemSchema],
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

schema.virtual('id').get(function () {
  return this._id?.toHexString();
});
schema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    ret.id = ret._id?.toHexString();
    delete ret._id;
    delete ret.__v;
  },
});

export const MaintenanceOrder = mongoose.model('MaintenanceOrder', schema);
