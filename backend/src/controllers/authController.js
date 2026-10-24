import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';

export const publicUser = user => ({ _id: user._id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt });
const cookieOptions = { httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', path: '/' };
function setSession(res, user) {
  const token = jwt.sign({ version: user.tokenVersion }, env.jwtSecret, {
    subject: String(user._id), expiresIn: env.jwtExpiresIn, algorithm: 'HS256', issuer: 'stockroom', audience: 'stockroom-web',
  });
  res.cookie('access_token', token, { ...cookieOptions, expires: new Date(jwt.decode(token).exp * 1000) });
}

export async function register(req, res) {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw new HttpError(409, 'An account with that email already exists');
  const user = await User.create({ name, email, password: await bcrypt.hash(password, 12), role: 'viewer' });
  setSession(res, user);
  res.status(201).json({ user: publicUser(user) });
}
export async function login(req, res) {
  const user = await User.findOne({ email: req.body.email }).select('+password +tokenVersion');
  // A fixed dummy hash keeps a missing account on the password-check path too.
  const valid = await bcrypt.compare(req.body.password, user?.password || '$2b$12$C6UzMDM.H6dfI/f/IKcEe.4B77Y1U6I8W8kLX2xwEqGMjdSdYOhku');
  if (!user || !valid) throw new HttpError(401, 'Email or password is incorrect');
  setSession(res, user);
  res.json({ user: publicUser(user) });
}
export async function logout(req, res) {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.clearCookie('access_token', cookieOptions).status(204).end();
}
export function me(req, res) { res.json({ user: publicUser(req.user) }); }
