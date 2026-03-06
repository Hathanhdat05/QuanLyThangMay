import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Counter = mongoose.model('Counter', schema);

