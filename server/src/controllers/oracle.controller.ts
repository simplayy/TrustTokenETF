import { Request, Response } from 'express';
import oracleService from '../services/oracle.service';
import hederaOracleService from '../services/hedera-oracle.service';

/**
 * OracleController - Handles API requests for price data
 */
export class OracleController {
  /**
   * Get current price for an asset
   */
  public async getPrice(req: Request, res: Response): Promise<void> {
    try {
      // Decode the asset symbol from the URL
      const asset = decodeURIComponent(req.params.asset);
      
      if (!asset) {
        res.status(400).json({ error: 'Asset symbol is required' });
        return;
      }
      
      const price = await oracleService.getPrice(asset);
      const assetType = oracleService.getAssetType(asset);
      res.json({ 
        asset, 
        price, 
        assetType, 
        timestamp: Date.now(),
        isMockData: oracleService.isUsingMockData()
      });
    } catch (error: any) {
      console.error('[ORACLE CONTROLLER] Error getting price:', error);
      res.status(500).json({ 
        error: 'Failed to get price data',
        message: error.message 
      });
    }
  }

  /**
   * Get historical price data for an asset
   */
  public async getHistoricalPrices(req: Request, res: Response): Promise<void> {
    try {
      // Decode the asset symbol from the URL
      const asset = decodeURIComponent(req.params.asset);
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      
      if (!asset) {
        res.status(400).json({ error: 'Asset symbol is required' });
        return;
      }
      
      if (isNaN(days) || days <= 0 || days > 365) {
        res.status(400).json({ error: 'Days must be a number between 1 and 365' });
        return;
      }
      
      const priceData = await oracleService.getHistoricalPrices(asset, days);
      const assetType = oracleService.getAssetType(asset);
      res.json({ 
        asset, 
        assetType,
        days,
        priceData
      });
    } catch (error: any) {
      console.error('[ORACLE CONTROLLER] Error getting historical prices:', error);
      res.status(500).json({ 
        error: 'Failed to get historical price data',
        message: error.message 
      });
    }
  }

  /**
   * Get prices for multiple assets
   */
  public async getPrices(req: Request, res: Response): Promise<void> {
    try {
      const { assets } = req.query;
      
      if (!assets) {
        res.status(400).json({ error: 'Assets parameter is required (comma-separated list)' });
        return;
      }
      
      const assetList = (assets as string).split(',').map(a => a.trim());
      
      if (assetList.length === 0) {
        res.status(400).json({ error: 'At least one asset is required' });
        return;
      }
      
      const results: Record<string, number> = {};
      const assetTypes: Record<string, string> = {};
      const errors: Record<string, string> = {};
      
      // Fetch all prices in parallel
      await Promise.all(
        assetList.map(async (asset) => {
          try {
            const price = await oracleService.getPrice(asset);
            results[asset] = price;
            assetTypes[asset] = oracleService.getAssetType(asset);
          } catch (error: any) {
            errors[asset] = error.message;
          }
        })
      );
      
      res.json({
        timestamp: Date.now(),
        prices: results,
        assetTypes,
        isMockData: oracleService.isUsingMockData(),
        errors: Object.keys(errors).length > 0 ? errors : undefined
      });
    } catch (error: any) {
      console.error('[ORACLE CONTROLLER] Error getting multiple prices:', error);
      res.status(500).json({ 
        error: 'Failed to get price data',
        message: error.message 
      });
    }
  }

  /**
   * Get all available assets by type
   */
  public async getAvailableAssets(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.query;
      
      const assets = oracleService.getAvailableAssets(type as string);
      const assetTypes = oracleService.getAssetTypes();
      
      res.json({
        assets,
        availableTypes: assetTypes
      });
    } catch (error: any) {
      console.error('[ORACLE CONTROLLER] Error getting available assets:', error);
      res.status(500).json({ 
        error: 'Failed to get available assets',
        message: error.message 
      });
    }
  }

  /**
   * Get current HBAR price
   */
  public async getHbarPrice(req: Request, res: Response): Promise<void> {
    try {
      const price = await hederaOracleService.getHbarPrice();
      res.json({ 
        asset: 'HBAR', 
        assetType: 'crypto',
        price, 
        timestamp: Date.now(),
        isMockData: true // Since we enabled mock mode in hedera oracle
      });
    } catch (error: any) {
      console.error('[ORACLE CONTROLLER] Error getting HBAR price:', error);
      res.status(500).json({ 
        error: 'Failed to get HBAR price data',
        message: error.message 
      });
    }
  }

  /**
   * Get price for a specific Hedera token by ID
   */
  public async getHederaTokenPrice(req: Request, res: Response): Promise<void> {
    try {
      const { tokenId } = req.params;
      
      if (!tokenId) {
        res.status(400).json({ error: 'Token ID is required' });
        return;
      }
      
      const price = await hederaOracleService.getTokenPrice(tokenId);
      res.json({ 
        tokenId, 
        price, 
        timestamp: Date.now() 
      });
    } catch (error: any) {
      console.error('[ORACLE CONTROLLER] Error getting Hedera token price:', error);
      res.status(500).json({ 
        error: 'Failed to get token price data',
        message: error.message 
      });
    }
  }

  /**
   * Get debug information about oracle cache and status
   */
  public async getDebugInfo(req: Request, res: Response): Promise<void> {
    try {
      const hederaCacheStatus = hederaOracleService.getCacheStatus();
      const hasHbarCache = hederaOracleService.hasCachedHbarPrice();
      
      res.json({
        success: true,
        timestamp: Date.now(),
        hedera: {
          cacheStatus: hederaCacheStatus,
          hasCachedHbarPrice: hasHbarCache
        },
        general: {
          message: 'Oracle services running normally'
        }
      });
    } catch (error: any) {
      console.error('[ORACLE CONTROLLER] Error getting debug info:', error);
      res.status(500).json({ 
        error: 'Failed to get debug information',
        message: error.message 
      });
    }
  }

  /**
   * Toggle mock data mode
   */
  public async toggleMockMode(req: Request, res: Response): Promise<void> {
    try {
      const { useMock } = req.body;
      
      if (typeof useMock !== 'boolean') {
        res.status(400).json({ error: 'useMock parameter must be a boolean' });
        return;
      }
      
      oracleService.setUseMockData(useMock);
      
      res.json({
        success: true,
        useMockData: useMock,
        message: `Oracle ${useMock ? 'enabled' : 'disabled'} mock data mode`
      });
    } catch (error: any) {
      console.error('[ORACLE CONTROLLER] Error toggling mock mode:', error);
      res.status(500).json({ 
        error: 'Failed to toggle mock mode',
        message: error.message 
      });
    }
  }

  /**
   * Get oracle status
   */
  public async getStatus(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        isUsingMockData: oracleService.isUsingMockData(),
        availableAssetTypes: oracleService.getAssetTypes(),
        cacheStatus: 'active' // Could add more cache info here
      });
    } catch (error: any) {
      console.error('[ORACLE CONTROLLER] Error getting status:', error);
      res.status(500).json({ 
        error: 'Failed to get oracle status',
        message: error.message 
      });
    }
  }
}

export default new OracleController(); 