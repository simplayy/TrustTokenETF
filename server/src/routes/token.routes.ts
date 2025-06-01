import { Router } from 'express';
import { tokenController } from '../controllers/token.controller';
import axios from 'axios';
import config from '../config';

const router = Router();

/**
 * @route GET /api/tokens
 * @desc Get all tokens
 * @access Public
 */
router.get('/', tokenController.getAllTokens.bind(tokenController));

/**
 * @route POST /api/tokens
 * @desc Create a new token
 * @access Public
 */
router.post('/', tokenController.createToken.bind(tokenController));

/**
 * @route GET /api/tokens/:tokenId
 * @desc Get token information
 * @access Public
 */
router.get('/:tokenId', tokenController.getTokenInfo.bind(tokenController));

/**
 * @route POST /api/tokens/:tokenId/mint
 * @desc Mint new tokens
 * @access Public
 */
router.post('/:tokenId/mint', tokenController.mintToken.bind(tokenController));

/**
 * @route GET /api/tokens/:tokenId/collateral-requirements
 * @desc Get collateral requirements for minting a specific amount of tokens
 * @access Public
 */
router.get('/:tokenId/collateral-requirements', tokenController.getCollateralRequirements.bind(tokenController));

/**
 * @route GET /api/tokens/:tokenId/collateral-records
 * @desc Get all collateral records for a token
 * @access Public
 */
router.get('/:tokenId/collateral-records', tokenController.getCollateralRecords.bind(tokenController));

/**
 * @route GET /api/tokens/:tokenId/balance
 * @desc Get token balance for an account (defaults to normal account)
 * @access Public
 */
router.get('/:tokenId/balance', tokenController.getTokenBalance.bind(tokenController));

/**
 * @route GET /api/tokens/:tokenId/debug-memo
 * @desc Debug token memo
 * @access Public
 */
router.get('/:tokenId/debug-memo', async (req, res) => {
  try {
    const tokenId = req.params.tokenId;
    const result = await tokenController.debugTokenMemo(tokenId);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route GET /api/tokens/debug/mirror-api
 * @desc Debug Mirror Node API directly
 * @access Public
 */
router.get('/debug/mirror-api', async (req, res) => {
  try {
    // Determine which Mirror Node base URL to use based on network
    const network = config.hedera.network.toLowerCase();
    const mirrorNodeBaseUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
      
    // Format the account ID correctly for Mirror Node API
    const treasuryId = config.hedera.treasuryId;
    console.log(`Using treasury account ID for Mirror Node query: ${treasuryId}`);
    
    // Make request to Mirror Node API to get tokens
    const url = `${mirrorNodeBaseUrl}/api/v1/tokens?account.id=${treasuryId}`;
    console.log(`Making API request to: ${url}`);
    
    // Configure axios with proper headers
    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    };
    
    const response = await axios.get(url, axiosConfig);
    console.log(`Retrieved ${response.data.tokens?.length || 0} tokens from Mirror Node API`);
    
    res.status(200).json({
      success: true,
      mirrorNodeUrl: url,
      treasuryId,
      response: response.data
    });
  } catch (error: any) {
    console.error("Error calling Mirror Node API:", error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      response: error.response?.data || 'No response data'
    });
  }
});

/**
 * @route GET /api/tokens/debug/token/:tokenId
 * @desc Debug specific token in Mirror Node
 * @access Public
 */
router.get('/debug/token/:tokenId', async (req, res) => {
  try {
    const tokenId = req.params.tokenId;
    if (!tokenId) {
      return res.status(400).json({ success: false, message: 'Token ID is required' });
    }
    
    // Determine which Mirror Node base URL to use based on network
    const network = config.hedera.network.toLowerCase();
    const mirrorNodeBaseUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
      
    // Configure axios with proper headers
    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    };
    
    // Make direct request to the token endpoint
    const url = `${mirrorNodeBaseUrl}/api/v1/tokens/${tokenId}`;
    console.log(`Making API request to: ${url}`);
    
    const response = await axios.get(url, axiosConfig);
    
    res.status(200).json({
      success: true,
      mirrorNodeUrl: url,
      tokenId,
      response: response.data
    });
  } catch (error: any) {
    console.error(`Error getting token details from Mirror Node: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      response: error.response?.data || 'No response data'
    });
  }
});

/**
 * @route POST /api/tokens/:tokenId/burn
 * @desc Burn tokens
 * @access Public
 */
router.post('/:tokenId/burn', tokenController.burnToken.bind(tokenController));

export default router; 