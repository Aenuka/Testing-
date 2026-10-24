import mongoose from 'mongoose';

const movementSchema = new mongoose.Schema({
  delta: { type: Number, required: true },
  balance: { type: Number, required: true },
  reason: { type: String, required: true },
  actor: { type: String, required: true },
  date: { type: Date, default: Date.now },
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  sku: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 40 },
  category: { type: String, required: true, maxlength: 60 },
  description: { type: String, default: '', maxlength: 1000 },
  price: { type: Number, required: true, min: 0, max: 1000000000 },
  quantity: { type: Number, default: 0, min: 0, max: 1000000000 },
  reorderLevel: { type: Number, default: 10, min: 0, max: 1000000000 },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  archived: { type: Boolean, default: false },
  movements: { type: [movementSchema], default: [] },
}, { timestamps: true, optimisticConcurrency: true });

export default mongoose.model('Product', productSchema);
