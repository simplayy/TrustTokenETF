import { Router } from 'express';
import { hederaController } from '../controllers/hedera.controller';

const router = Router();

/**
 * @route GET /api/hedera/status
 * @desc Check Hedera connection status
 * @access Public
 */
router.get('/status', hederaController.checkConnection);

/**
 * @route GET /api/hedera/account
 * @desc Get account information
 * @access Public
 */
router.get('/account', hederaController.getAccountInfo);

/**
 * @route GET /api/hedera/hbar-balance
 * @desc Get HBAR balance for the account
 * @access Public
 */
router.get('/hbar-balance', hederaController.getHbarBalance);

/**
 * @route GET /api/hedera/debug
 * @desc Get detailed debug information for Hedera connection
 * @access Public
 */
router.get('/debug', hederaController.getDebugInfo);

export default router; 