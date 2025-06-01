import express from 'express';
import oracleController from '../controllers/oracle.controller';

const router = express.Router();

/**
 * @route GET /api/oracle/prices
 * @desc Get prices for multiple assets
 * @access Public
 * @query assets - Comma-separated list of asset symbols
 */
router.get('/prices', oracleController.getPrices);

/**
 * @route GET /api/oracle/price/:asset
 * @desc Get current price for a specific asset
 * @access Public
 * @param asset - Asset symbol (e.g., BTC, ETH, HBAR, AAPL)
 */
router.get('/price/:asset', oracleController.getPrice);

/**
 * @route GET /api/oracle/history/:asset
 * @desc Get historical price data for a specific asset
 * @access Public
 * @param asset - Asset symbol (e.g., BTC, ETH, HBAR, AAPL)
 * @query days - Number of days of historical data (default: 7)
 */
router.get('/history/:asset', oracleController.getHistoricalPrices);

/**
 * @route GET /api/oracle/assets
 * @desc Get all available assets, optionally filtered by type
 * @access Public
 * @query type - Asset type filter (optional: crypto, stock, commodity, forex, etf, bond)
 */
router.get('/assets', oracleController.getAvailableAssets);

/**
 * @route GET /api/oracle/hbar/price
 * @desc Get current HBAR price
 * @access Public
 */
router.get('/hbar/price', oracleController.getHbarPrice);

/**
 * @route GET /api/oracle/token/:tokenId/price
 * @desc Get price for a specific Hedera token by ID
 * @access Public
 * @param tokenId - The Hedera token ID
 */
router.get('/token/:tokenId/price', oracleController.getHederaTokenPrice);

/**
 * @route GET /api/oracle/debug
 * @desc Get debug information about oracle cache and status
 * @access Public
 */
router.get('/debug', oracleController.getDebugInfo);

/**
 * @route GET /api/oracle/status
 * @desc Get oracle status including mock mode status
 * @access Public
 */
router.get('/status', oracleController.getStatus);

/**
 * @route POST /api/oracle/toggle-mock
 * @desc Toggle between mock and real data mode
 * @access Public
 * @body useMock - Boolean to enable/disable mock mode
 */
router.post('/toggle-mock', oracleController.toggleMockMode);

export default router; 