import { Request, Response } from 'express';
import tokenService, { TokenCreateParams, AssetComposition } from '../services/token.service';
import { collateralService } from '../services/collateral.service';

/**
 * Controller for Token-related endpoints
 */
export class TokenController {
  /**
   * Create a new token
   */
  async createToken(req: Request, res: Response) {
    try {
      const { name, symbol, composition } = req.body;

      // Validate request data
      if (!name || !symbol || !composition || !Array.isArray(composition)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request data. Name, symbol, and composition array are required.'
        });
      }

      // Type-check and validate composition
      const validComposition = this.validateComposition(composition);
      if (!validComposition.valid) {
        return res.status(400).json({
          success: false,
          message: validComposition.message
        });
      }

      // Create token params
      const tokenParams: TokenCreateParams = {
        name,
        symbol,
        composition: composition as AssetComposition[]
      };

      // Call service to create token
      const result = await tokenService.createToken(tokenParams);

      return res.status(201).json(result);
    } catch (error) {
      console.error('Error creating token:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create token',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get token information
   */
  async getTokenInfo(req: Request, res: Response) {
    try {
      const { tokenId } = req.params;

      if (!tokenId) {
        return res.status(400).json({
          success: false,
          message: 'Token ID is required'
        });
      }

      const tokenInfo = await tokenService.getTokenInfo(tokenId);
      return res.json({
        success: true,
        tokenInfo
      });
    } catch (error) {
      console.error('Error getting token info:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get token information',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Mint tokens
   */
  async mintToken(req: Request, res: Response): Promise<void> {
    try {
      const tokenId = req.params.tokenId;
      const { amount } = req.body;

      if (!tokenId) {
        res.status(400).json({ success: false, message: 'Token ID is required' });
        return;
      }

      if (!amount || isNaN(parseFloat(amount))) {
        res.status(400).json({ success: false, message: 'Valid amount is required' });
        return;
      }

      console.log(`Minting ${amount} tokens for ${tokenId}`);
      const parsedAmount = parseFloat(amount);
      
      // Mint tokens with enhanced collateral management
      const result = await tokenService.mintToken(tokenId, parsedAmount);
      
      // Add network information to the response
      const networkInfo = {
        network: process.env.HEDERA_NETWORK?.toLowerCase() || 'testnet',
        timestamp: new Date().toISOString(),
        fee: result.fee || 0.1 // Set approximate fee if not provided by service
      };
      
      // Combine mint result with network info
      const enhancedResult = {
        ...result,
        ...networkInfo
      };
      
      res.status(200).json(enhancedResult);
    } catch (error: any) {
      console.error(`Minting error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: error.message,
        details: error.details || 'No additional details available'
      });
    }
  }

  /**
   * Get collateral requirements for minting tokens
   */
  async getCollateralRequirements(req: Request, res: Response): Promise<void> {
    try {
      const { tokenId } = req.params;
      const { amount } = req.query;
      
      if (!tokenId) {
        res.status(400).json({ success: false, message: 'Token ID is required' });
        return;
      }
      
      if (!amount || isNaN(parseFloat(amount as string))) {
        res.status(400).json({ success: false, message: 'Valid amount is required as a query parameter' });
        return;
      }
      
      // Get token composition from token service
      const tokenInfo = await tokenService.getTokenInfo(tokenId);
      
      if (!tokenInfo || !tokenInfo.composition || tokenInfo.composition.length === 0) {
        res.status(404).json({ 
          success: false, 
          message: 'Token composition not found. Cannot calculate collateral requirements.' 
        });
        return;
      }
      
      // Calculate collateral requirements
      const parsedAmount = parseFloat(amount as string);
      const requirements = await collateralService.calculateCollateralRequirements(
        tokenId,
        parsedAmount,
        tokenInfo.composition
      );
      
      res.status(200).json({
        success: true,
        tokenId,
        amount: parsedAmount,
        requirements
      });
    } catch (error: any) {
      console.error(`Collateral requirements error: ${error.message}`);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get collateral records for a token
   */
  async getCollateralRecords(req: Request, res: Response): Promise<void> {
    try {
      const { tokenId } = req.params;
      
      if (!tokenId) {
        res.status(400).json({ success: false, message: 'Token ID is required' });
        return;
      }
      
      console.log(`Getting collateral records for token ${tokenId} from blockchain`);
      
      // Get real collateral records from blockchain
      const records = await collateralService.getRealCollateralFromBlockchain(tokenId);
      
      res.status(200).json({
        success: true,
        tokenId,
        recordCount: records.length,
        records,
        source: 'blockchain' // Indicate data source
      });
    } catch (error: any) {
      console.error(`Collateral records error: ${error.message}`);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get token balance for an account
   */
  async getTokenBalance(req: Request, res: Response): Promise<void> {
    try {
      const { tokenId } = req.params;
      // Se accountId non è specificato, usa l'account normale
      const accountId = req.query.accountId as string || process.env.HEDERA_ACCOUNT_ID || "0.0.6077195";
      
      if (!tokenId) {
        res.status(400).json({ success: false, message: 'Token ID is required' });
        return;
      }
      
      // Get token info first to get decimal places
      const tokenInfo = await tokenService.getTokenInfo(tokenId);
      
      if (!tokenInfo) {
        res.status(404).json({ 
          success: false, 
          message: 'Token not found'
        });
        return;
      }
      
      // Get account balance from Hedera
      const balance = await tokenService.getAccountTokenBalance(tokenId, accountId);
      
      res.status(200).json({
        success: true,
        tokenId,
        accountId,
        balance,
        formattedBalance: balance.displayValue,
        rawBalance: balance.rawValue,
        decimals: tokenInfo.decimals
      });
    } catch (error: any) {
      console.error(`Token balance error: ${error.message}`);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Get all tokens from Hedera Mirror Node API
   */
  async getAllTokens(req: Request, res: Response) {
    try {
      console.log('Getting all tokens from Hedera Mirror Node API');
      
      // Check if we should include full metadata (similar to getTokenInfo)
      const includeMetadata = req.query.includeMetadata === 'true';
      console.log(`Include full metadata: ${includeMetadata}`);
      
      const result = await tokenService.getAllTokens(includeMetadata);
      
      return res.json(result);
    } catch (error) {
      console.error('Error getting all tokens from Hedera Mirror Node:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get tokens from Hedera network',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Utility function to validate token composition
   */
  private validateComposition(composition: any[]): { valid: boolean; message?: string } {
    // Check if composition has at least one asset
    if (composition.length === 0) {
      return { valid: false, message: 'Composition must contain at least one asset' };
    }

    // Check if all items have the required fields
    for (const asset of composition) {
      if (!asset.value || !asset.label || typeof asset.allocation !== 'number') {
        return {
          valid: false,
          message: 'Each asset must have value, label, and allocation properties'
        };
      }
    }

    // Check if allocation sums to 100%
    const totalAllocation = composition.reduce(
      (sum, asset) => sum + (asset.allocation || 0),
      0
    );

    if (Math.abs(totalAllocation - 100) > 0.01) {
      return {
        valid: false,
        message: `Total allocation must equal 100%, got ${totalAllocation}%`
      };
    }

    return { valid: true };
  }

  /**
   * Debug token memo
   * @param tokenId Token ID to debug
   * @returns Debug information
   */
  async debugTokenMemo(tokenId: string): Promise<any> {
    if (!tokenId) {
      throw new Error('Token ID is required');
    }
    
    return await tokenService.debugTokenMemo(tokenId);
  }

  /**
   * Burn tokens
   */
  async burnToken(req: Request, res: Response): Promise<void> {
    try {
      const tokenId = req.params.tokenId;
      const { amount } = req.body;

      if (!tokenId) {
        res.status(400).json({ success: false, message: 'Token ID is required' });
        return;
      }

      if (!amount || isNaN(parseFloat(amount))) {
        res.status(400).json({ success: false, message: 'Valid amount is required' });
        return;
      }

      console.log(`Burning ${amount} tokens for ${tokenId}`);
      const parsedAmount = parseFloat(amount);
      
      // Burn tokens with collateral release
      const result = await tokenService.burnToken(tokenId, parsedAmount);
      
      // Add network information to the response
      const networkInfo = {
        network: process.env.HEDERA_NETWORK?.toLowerCase() || 'testnet',
        timestamp: new Date().toISOString(),
        fee: result.fee || 0.1 // Set approximate fee if not provided by service
      };
      
      // Combine burn result with network info
      const enhancedResult = {
        ...result,
        ...networkInfo
      };
      
      res.status(200).json(enhancedResult);
    } catch (error: any) {
      console.error(`Burning error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: error.message,
        details: error.details || 'No additional details available'
      });
    }
  }
}

// Create a singleton instance
export const tokenController = new TokenController(); 