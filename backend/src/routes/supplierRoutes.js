import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, supplierSchema } from '../middleware/validate.js';
import { listSuppliers, createSupplier } from '../controllers/supplierController.js';

const router = Router();
router.use(authenticate);
router.get('/', listSuppliers);
router.post('/', authorize('admin', 'manager'), validate(supplierSchema), createSupplier);
export default router;
