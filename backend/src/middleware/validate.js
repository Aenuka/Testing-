import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid record ID');
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ message: result.error.issues[0].message });
  req.body = result.data;
  next();
};
export const validateId = (req, res, next) => {
  if (!objectId.safeParse(req.params.id).success) return res.status(400).json({ message: 'Invalid record ID' });
  next();
};

export const credentialsSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(1).max(128),
}).strict();
export const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(80),
  password: z.string().min(10, 'Password must contain at least 10 characters').max(128),
});
const integer = z.number().int().min(0).max(1000000000);
export const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,40}$/, 'SKU must be 2–40 letters, numbers, hyphens or underscores'),
  category: z.string().trim().min(1).max(60),
  description: z.string().trim().max(1000).default(''),
  price: z.number().min(0).max(1000000000).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, 'Price supports at most two decimal places'),
  reorderLevel: integer,
  supplier: objectId.nullable().default(null),
}).strict();
export const createProductSchema = productSchema.extend({ quantity: integer });
export const updateProductSchema = productSchema.extend({ version: integer });
export const stockSchema = z.object({
  delta: z.number().int().min(-1000000000).max(1000000000).refine(v => v !== 0, 'Quantity cannot be zero'),
  reason: z.string().trim().min(3).max(200),
  version: integer,
}).strict();
export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase().max(254),
  phone: z.string().trim().max(40).default(''),
  location: z.string().trim().max(150).default(''),
}).strict();
export const roleSchema = z.object({ role: z.enum(['admin', 'manager', 'viewer']) }).strict();
