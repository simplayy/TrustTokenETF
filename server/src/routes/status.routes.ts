import { Router } from 'express';
import { getStatus } from '../controllers/status.controller';

const router = Router();

// GET /api/status
router.get('/', getStatus);

export default router; 