import { Request, Response } from 'express';
import { transactionService } from '../services/transaction.service';
import config from '../config';

/**
 * Controller per le operazioni di transazioni
 */
export class TransactionController {
  /**
   * Ottiene le transazioni dell'utente
   */
  async getTransactions(req: Request, res: Response) {
    try {
      // Parametri opzionali dalla richiesta
      const accountId = req.query.accountId as string || undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const order = (req.query.order as 'asc' | 'desc') || 'desc';
      const includeTokenInfo = req.query.includeTokenInfo === 'true';

      // Ottieni le transazioni
      const transactions = await transactionService.getAccountTransactions(accountId, limit, order);
      
      // Formatta le transazioni per la visualizzazione
      const formattedTransactions = transactions.map(tx => 
        transactionService.formatTransaction(tx)
      );

      // Se richiesto, aggiungi informazioni sui token per transazioni di token
      if (includeTokenInfo) {
        await this.enrichTransactionsWithTokenInfo(formattedTransactions);
      }
      
      return res.json({
        success: true,
        count: formattedTransactions.length,
        transactions: formattedTransactions,
        network: config.hedera.network.toLowerCase(),
        accountId: accountId || config.hedera.accountId
      });
    } catch (error) {
      console.error('Error getting transactions:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve transactions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Ottiene le transazioni per un token specifico
   */
  async getTokenTransactions(req: Request, res: Response) {
    try {
      // Ottieni il token ID dai parametri della richiesta
      const tokenId = req.params.tokenId;

      if (!tokenId) {
        return res.status(400).json({
          success: false,
          message: 'Token ID is required'
        });
      }

      // Parametri opzionali dalla richiesta
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const order = (req.query.order as 'asc' | 'desc') || 'desc';
      const includeTokenInfo = req.query.includeTokenInfo === 'true';

      // Ottieni le transazioni del token
      const transactions = await transactionService.getTokenTransactions(tokenId, limit, order);
      
      // Formatta le transazioni per la visualizzazione
      const formattedTransactions = transactions.map(tx => 
        transactionService.formatTransaction(tx)
      );

      // Ottieni informazioni sul token
      const tokenInfo = await transactionService.getTokenInfo(tokenId);
      
      // Se richiesto, aggiungi informazioni sui token per transazioni di token
      if (includeTokenInfo) {
        await this.enrichTransactionsWithTokenInfo(formattedTransactions);
      }
      
      return res.json({
        success: true,
        count: formattedTransactions.length,
        transactions: formattedTransactions,
        network: config.hedera.network.toLowerCase(),
        tokenId,
        tokenInfo
      });
    } catch (error) {
      console.error('Error getting token transactions:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve token transactions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Arricchisce le transazioni con informazioni sui token
   * @param transactions Transazioni da arricchire
   */
  private async enrichTransactionsWithTokenInfo(transactions: any[]) {
    const tokenCache = new Map<string, any>();

    for (const tx of transactions) {
      // Controlla se ci sono trasferimenti di token
      if (tx.tokenTransfers && Array.isArray(tx.tokenTransfers) && tx.tokenTransfers.length > 0) {
        // Organizza le informazioni sui token
        tx.tokens = {};

        for (const transfer of tx.tokenTransfers) {
          const tokenId = transfer.token_id;
          if (!tokenId) continue;

          // Ottieni informazioni sul token (dall'API o dalla cache)
          if (!tokenCache.has(tokenId)) {
            const tokenInfo = await transactionService.getTokenInfo(tokenId);
            if (tokenInfo) {
              tokenCache.set(tokenId, tokenInfo);
            }
          }

          const tokenInfo = tokenCache.get(tokenId);
          
          // Se abbiamo informazioni sul token, aggiungiamole alla transazione
          if (tokenInfo) {
            if (!tx.tokens[tokenId]) {
              tx.tokens[tokenId] = {
                id: tokenId,
                name: tokenInfo.name || 'Unknown',
                symbol: tokenInfo.symbol || '',
                decimals: tokenInfo.decimals || 0,
                transfers: []
              };
            }
            
            // Aggiungi il trasferimento alle informazioni del token
            tx.tokens[tokenId].transfers.push(transfer);
          }
        }
      }

      // Controlla se è una transazione di creazione token
      if (tx.entity_id && tx.type.includes('TOKEN')) {
        // Ottieni informazioni sul token creato
        if (!tokenCache.has(tx.entity_id)) {
          const tokenInfo = await transactionService.getTokenInfo(tx.entity_id);
          if (tokenInfo) {
            tokenCache.set(tx.entity_id, tokenInfo);
            
            // Aggiungi informazioni sul token alla transazione
            tx.createdToken = {
              id: tx.entity_id,
              name: tokenInfo.name || 'Unknown',
              symbol: tokenInfo.symbol || '',
              decimals: tokenInfo.decimals || 0
            };
          }
        } else {
          const tokenInfo = tokenCache.get(tx.entity_id);
          tx.createdToken = {
            id: tx.entity_id,
            name: tokenInfo.name || 'Unknown',
            symbol: tokenInfo.symbol || '',
            decimals: tokenInfo.decimals || 0
          };
        }
      }
    }
  }
}

// Crea un'istanza singleton
export const transactionController = new TransactionController(); 