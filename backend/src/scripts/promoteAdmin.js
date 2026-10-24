import mongoose from 'mongoose';
import { z } from 'zod';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

// Explicit one-time setup for an existing account. Never creates sample records.
try {
  const email = z.email().toLowerCase().parse(process.argv[2]);
  await connectDB();
  const user = await User.findOne({ email });
  if (!user) throw new Error('No account found. Register in the app first, then run this command again.');
  if (user.role !== 'admin') {
    await User.updateOne({ _id: user._id }, { $set: { role: 'admin' }, $inc: { tokenVersion: 1 } });
    console.log('Account promoted to admin. Sign in again to use your new permissions.');
  } else console.log('This account is already an admin.');
} catch (error) {
  console.error(error instanceof z.ZodError ? 'Usage: npm run promote-admin -- you@your-company.com' : error.message);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
