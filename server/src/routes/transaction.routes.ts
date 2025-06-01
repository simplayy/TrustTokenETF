import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller';

const router = Router();

/**
 * @route GET /api/transactions
 * @desc Get account transactions
 * @access Public
 */
router.get('/', transactionController.getTransactions.bind(transactionController));

/**
 * @route GET /api/transactions/token/:tokenId
 * @desc Get transactions for a specific token
 * @access Public
 */
router.get('/token/:tokenId', transactionController.getTokenTransactions.bind(transactionController));

export default router; 