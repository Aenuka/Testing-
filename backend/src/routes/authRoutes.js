import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { register, login, logout, me } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, registerSchema, credentialsSchema } from '../middleware/validate.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many sign-in attempts. Please try again in 15 minutes' } });
router.post('/register', limiter, validate(registerSchema), register);
router.post('/login', limiter, validate(credentialsSchema), login);
router.get('/me', authenticate, me);
router.post('/logout', authenticate, logout);
export default router;
