import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import mongoose from 'mongoose';

try {
  await connectDB();
  const server = app.listen(env.port, '127.0.0.1', () => console.log(`Stockroom API: http://localhost:${env.port}`));
  const shutdown = () => server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) { console.error(`Could not start Stockroom: ${error.message}`); process.exit(1); }
