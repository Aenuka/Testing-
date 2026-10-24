import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';
import { HttpError } from '../utils/HttpError.js';

async function checkSupplier(id) {
  if (id && !await Supplier.exists({ _id: id })) throw new HttpError(400, 'The selected supplier no longer exists');
}
export async function listProducts(req, res) {
  const products = await Product.find({ archived: false }).select('-movements').populate('supplier', 'name').sort({ createdAt: -1 }).lean();
  res.json({ products });
}
export async function createProduct(req, res) {
  await checkSupplier(req.body.supplier);
  const product = await Product.create({ ...req.body, movements: [{ delta: req.body.quantity, balance: req.body.quantity, reason: 'Opening stock', actor: req.user.name }] });
  res.status(201).json({ product: await product.populate('supplier', 'name') });
}
export async function updateProduct(req, res) {
  const { version, ...fields } = req.body;
  await checkSupplier(fields.supplier);
  const product = await Product.findOneAndUpdate({ _id: req.params.id, archived: false, __v: version }, { $set: fields, $inc: { __v: 1 } }, { new: true, runValidators: true }).populate('supplier', 'name');
  if (!product) throw new HttpError(409, 'This product changed or was removed. Refresh and try again');
  res.json({ product });
}
export async function adjustStock(req, res) {
  const { delta, reason, version } = req.body;
  const current = await Product.findOne({ _id: req.params.id, archived: false });
  if (!current) throw new HttpError(404, 'Product not found');
  if (current.quantity + delta < 0) throw new HttpError(400, 'There is not enough stock for this adjustment');
  if (current.quantity + delta > 1000000000) throw new HttpError(400, 'Stock cannot exceed 1,000,000,000 units');
  const product = await Product.findOneAndUpdate({ _id: current._id, archived: false, __v: version }, {
    $inc: { quantity: delta, __v: 1 },
    $push: { movements: { $each: [{ delta, balance: current.quantity + delta, reason, actor: req.user.name, date: new Date() }], $slice: -100 } },
  }, { new: true, runValidators: true }).populate('supplier', 'name');
  if (!product) throw new HttpError(409, 'Stock changed since you opened this form. Refresh and try again');
  res.json({ product });
}
export async function deleteProduct(req, res) {
  const product = await Product.findOneAndUpdate({ _id: req.params.id, archived: false, __v: req.body.version }, { $set: { archived: true }, $inc: { __v: 1 } });
  if (!product) throw new HttpError(409, 'This product changed or was removed. Refresh and try again');
  res.status(204).end();
}
export async function activity(req, res) {
  const movements = await Product.aggregate([
    { $unwind: '$movements' },
    { $sort: { 'movements.date': -1, 'movements._id': -1 } },
    { $limit: 100 },
    { $project: { _id: '$movements._id', product: '$name', sku: 1, delta: '$movements.delta', balance: '$movements.balance', reason: '$movements.reason', actor: '$movements.actor', date: '$movements.date' } },
  ]);
  res.json({ movements });
}
