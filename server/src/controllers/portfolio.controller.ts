import { Request, Response } from 'express';
import { portfolioService } from '../services/portfolio.service';

/**
 * Controller per le operazioni di portfolio
 */
export class PortfolioController {
  /**
   * Ottiene il portfolio dell'utente
   */
  async getPortfolio(req: Request, res: Response) {
    try {
      // In una versione più complessa, qui si potrebbe recuperare l'ID dell'account
      // dell'utente autenticato. Per ora, utilizziamo l'ID dell'account configurato
      const accountId = req.query.accountId as string || undefined;

      const result = await portfolioService.getUserPortfolio(accountId);
      
      return res.json({
        success: true,
        holdings: result
      });
    } catch (error) {
      console.error('Error getting user portfolio:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve portfolio',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Aggiunge un token al portfolio (simulazione)
   */
  async addToPortfolio(req: Request, res: Response) {
    try {
      const { tokenId, amount } = req.body;

      if (!tokenId || !amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({
          success: false,
          message: 'Token ID and valid amount are required'
        });
      }

      const result = await portfolioService.addToPortfolio(tokenId, parseFloat(amount));
      
      return res.json({
        success: true,
        message: `Added ${amount} ${result.tokenInfo?.symbol || ''} to portfolio`,
        holding: result
      });
    } catch (error) {
      console.error('Error adding to portfolio:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to add token to portfolio',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Creare un'istanza singleton
export const portfolioController = new PortfolioController(); 