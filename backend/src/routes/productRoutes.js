import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, validateId, createProductSchema, updateProductSchema, stockSchema } from '../middleware/validate.js';
import * as controller from '../controllers/productController.js';

const router = Router();
router.use(authenticate);
router.get('/', controller.listProducts);
router.get('/activity', controller.activity);
router.post('/', authorize('admin', 'manager'), validate(createProductSchema), controller.createProduct);
router.put('/:id', authorize('admin', 'manager'), validateId, validate(updateProductSchema), controller.updateProduct);
router.post('/:id/stock', authorize('admin', 'manager'), validateId, validate(stockSchema), controller.adjustStock);
router.delete('/:id', authorize('admin'), validateId, validate(z.object({ version: z.number().int().nonnegative() }).strict()), controller.deleteProduct);
export default router;
