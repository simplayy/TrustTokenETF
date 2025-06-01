import { Request, Response } from 'express';
import { hederaService } from '../services/hedera.service';

/**
 * Controller for Hedera-related endpoints
 */
export class HederaController {
  /**
   * Check Hedera connection status
   */
  async checkConnection(req: Request, res: Response) {
    try {
      const connectionStatus = await hederaService.checkConnection();
      return res.json(connectionStatus);
    } catch (error) {
      console.error('Error checking Hedera connection:', error);
      return res.status(500).json({
        connected: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(req: Request, res: Response) {
    try {
      const accountInfo = await hederaService.getAccountInfo();
      
      // Get treasury account info as well
      const treasuryId = process.env.HEDERA_TREASURY_ID || "0.0.5845721";
      const treasuryInfo = await hederaService.getAccountBalanceById(treasuryId);
      
      return res.json({
        success: true,
        accountInfo,
        treasuryInfo: {
          accountId: treasuryId,
          balance: treasuryInfo.balanceNumber,
          balanceString: treasuryInfo.balance,
          network: accountInfo.network
        }
      });
    } catch (error) {
      console.error('Error getting account info:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get account information',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get HBAR balance for the current account
   */
  async getHbarBalance(req: Request, res: Response) {
    try {
      const accountInfo = await hederaService.getAccountInfo();
      
      return res.json({
        success: true,
        balance: accountInfo.balance,
        balanceString: accountInfo.balanceString,
        accountId: accountInfo.accountId,
        network: accountInfo.network,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting HBAR balance:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get HBAR balance',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get network and client information for debugging
   */
  async getDebugInfo(req: Request, res: Response) {
    try {
      // Get client info
      const client = hederaService.getClient();
      
      // Get account info
      const connectionStatus = await hederaService.checkConnection();
      
      // Return debug information
      return res.json({
        success: true,
        clientInitialized: client !== null,
        network: process.env.HEDERA_NETWORK || 'testnet',
        operatorAccountId: process.env.HEDERA_ACCOUNT_ID,
        connection: connectionStatus,
        environmentVariables: {
          networkDefined: !!process.env.HEDERA_NETWORK,
          accountIdDefined: !!process.env.HEDERA_ACCOUNT_ID,
          privateKeyDefined: !!process.env.HEDERA_PRIVATE_KEY,
          treasuryIdDefined: !!process.env.HEDERA_TREASURY_ID,
          treasuryKeyDefined: !!process.env.HEDERA_TREASURY_KEY
        }
      });
    } catch (error) {
      console.error('Error getting debug info:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get debug information',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Create a singleton instance
export const hederaController = new HederaController(); 