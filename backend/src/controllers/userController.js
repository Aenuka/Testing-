import User from '../models/User.js';
import { publicUser } from './authController.js';
import { HttpError } from '../utils/HttpError.js';

export async function listUsers(req, res) { res.json({ users: (await User.find().sort({ createdAt: -1 })).map(publicUser) }); }
export async function updateRole(req, res) {
  if (req.params.id === String(req.user._id)) throw new HttpError(400, 'You cannot change your own role');
  // Existing admins are protected from demotion, preventing concurrent admin lockout.
  const user = await User.findOneAndUpdate({ _id: req.params.id, role: { $ne: 'admin' } }, { $set: { role: req.body.role }, $inc: { tokenVersion: 1 } }, { new: true, runValidators: true });
  if (!user) throw new HttpError(400, 'User not found, or this is a protected admin account');
  res.json({ user: publicUser(user) });
}
