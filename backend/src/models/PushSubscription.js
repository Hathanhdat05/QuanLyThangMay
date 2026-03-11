import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    user_agent: { type: String, default: '' },
  },
  { timestamps: true }
);

schema.index({ user_id: 1, updatedAt: -1 });

export const PushSubscription = mongoose.model('PushSubscription', schema);
