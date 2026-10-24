import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, validateId, roleSchema } from '../middleware/validate.js';
import { listUsers, updateRole } from '../controllers/userController.js';

const router = Router();
router.use(authenticate, authorize('admin'));
router.get('/', listUsers);
router.patch('/:id/role', validateId, validate(roleSchema), updateRole);
export default router;
