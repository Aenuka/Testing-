import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const secret = process.env.JWT_SECRET;
const mongoUri = process.env.MONGO_URI?.trim();
if (!mongoUri || !/^mongodb(?:\+srv)?:\/\//.test(mongoUri)) {
  throw new Error('Add your MongoDB connection string to MONGO_URI in backend/.env.');
}
if (!secret || secret.length < 32 || secret.startsWith('replace-this')) {
  throw new Error('Set JWT_SECRET in backend/.env to a unique random value of at least 32 characters.');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri,
  jwtSecret: secret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};
