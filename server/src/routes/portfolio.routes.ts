import { Router } from 'express';
import { portfolioController } from '../controllers/portfolio.controller';

const router = Router();

/**
 * @route GET /api/portfolio
 * @desc Get user portfolio
 * @access Public
 */
router.get('/', portfolioController.getPortfolio.bind(portfolioController));

/**
 * @route POST /api/portfolio
 * @desc Add token to portfolio (simulation)
 * @access Public
 */
router.post('/', portfolioController.addToPortfolio.bind(portfolioController));

export default router; 