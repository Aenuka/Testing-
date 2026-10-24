import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';

export async function authenticate(req, res, next) {
  const token = req.cookies?.access_token;
  if (!token) throw new HttpError(401, 'Please sign in to continue');
  let payload;
  try { payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'], issuer: 'stockroom', audience: 'stockroom-web' }); }
  catch { throw new HttpError(401, 'Your session expired. Please sign in again'); }
  if (typeof payload.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub)) throw new HttpError(401, 'Invalid session');
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || user.tokenVersion !== payload.version) throw new HttpError(401, 'Your session is no longer valid');
  req.user = user;
  next();
}

export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw new HttpError(403, 'You do not have permission to perform this action');
  next();
};
