import mongoose from 'mongoose';

const contractProductSchema = new mongoose.Schema({
  item_type: {
    type: String,
    enum: ['product', 'elevator'],
    default: 'product',
  },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  elevator_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Elevator' },
  quantity: { type: Number, default: 1 },
  unit_price: { type: Number, default: 0 },
});

const schema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    contract_number: { type: String, required: true, unique: true },
    contract_type: {
      type: String,
      enum: ['installation', 'maintenance', 'warranty'],
      required: true,
      default: 'installation',
    },
    start_date: { type: Date },
    end_date: { type: Date },
    status: { type: String, enum: ['draft', 'active', 'completed', 'cancelled'], default: 'draft' },
    total_value: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    items: [contractProductSchema],
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
    if (ret.items) {
      ret.contract_products = ret.items.map((it) => ({
        id: it._id?.toHexString(),
        item_type: it.item_type || (it.elevator_id ? 'elevator' : 'product'),
        product_id: it.product_id?.toHexString?.() ?? it.product_id,
        elevator_id: it.elevator_id?.toHexString?.() ?? it.elevator_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
        products: it.products,
        elevator: it.elevator,
      }));
    }
    delete ret._id;
    delete ret.__v;
    delete ret.items;
  },
});

export const Contract = mongoose.model('Contract', schema);
