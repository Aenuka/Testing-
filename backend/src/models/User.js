import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'manager', 'viewer'], default: 'viewer' },
  tokenVersion: { type: Number, default: 0, select: false },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
