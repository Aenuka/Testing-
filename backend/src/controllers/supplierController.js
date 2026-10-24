import Supplier from '../models/Supplier.js';

export async function listSuppliers(req, res) { res.json({ suppliers: await Supplier.find().sort({ name: 1 }).lean() }); }
export async function createSupplier(req, res) { res.status(201).json({ supplier: await Supplier.create(req.body) }); }
