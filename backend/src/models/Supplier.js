import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, default: '', maxlength: 40 },
  location: { type: String, default: '', maxlength: 150 },
}, { timestamps: true });

export default mongoose.model('Supplier', supplierSchema);
