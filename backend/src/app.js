import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
const allowedOrigins = new Set([new URL(env.clientUrl).origin]);
if (env.nodeEnv !== 'production') {
  allowedOrigins.add('http://127.0.0.1:5173');
  allowedOrigins.add('http://localhost:5000');
  allowedOrigins.add(`http://127.0.0.1:${env.port}`);
}
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)), credentials: true }));
// Cookie authentication requires an origin check on every browser mutation, including login.
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if ((origin && !allowedOrigins.has(origin)) || req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ message: 'Request origin is not allowed' });
  }
  next();
});
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 200, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many requests. Try again shortly' } }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/users', userRoutes);
app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found' }));

const frontendDist = fileURLToPath(new URL('../../frontend/dist', import.meta.url));
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('/{*path}', (req, res) => res.sendFile(`${frontendDist}/index.html`));
}
app.use(errorHandler);
export default app;
