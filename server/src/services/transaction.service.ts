import config from "../config";
import axios from "axios";

/**
 * Interfaccia per le transazioni
 */
export interface Transaction {
  transaction_id: string;
  consensus_timestamp: string;
  type: string;
  result: string;
  memo_base64?: string;
  transfers?: any[];
  token_transfers?: any[];
  transaction_hash?: string;
  valid_start_timestamp?: string;
  charged_tx_fee?: number;
  max_fee?: string;
  node?: string;
  scheduled?: boolean;
  entity_id?: string;
}

/**
 * Interfaccia per la categoria di transazione
 */
export interface TransactionCategory {
  type: string;
  label: string;
  description: string;
  color?: string;
  icon?: string;
}

/**
 * Servizio per la gestione delle transazioni
 */
class TransactionService {
  private accountId: string;
  private tokenInfoCache: Map<string, any>;

  constructor() {
    this.accountId = config.hedera.accountId;
    this.tokenInfoCache = new Map();
  }

  /**
   * Ottiene tutte le transazioni di un account
   * @param accountId Account ID dell'utente (opzionale, usa quello di default se non specificato)
   * @param limit Numero massimo di transazioni da recuperare (default 50)
   * @param order Ordine di ordinamento (default 'desc')
   * @returns Array di transazioni
   */
  async getAccountTransactions(
    accountId?: string, 
    limit: number = 50, 
    order: 'asc' | 'desc' = 'desc'
  ): Promise<Transaction[]> {
    try {
      // Usa l'account ID specificato o quello di default
      const userAccountId = accountId || this.accountId;
      console.log(`Getting transactions for account ${userAccountId}`);

      // Utilizziamo Mirror Node API
      const network = config.hedera.network.toLowerCase();
      const mirrorNodeBaseUrl = network === 'mainnet' 
        ? 'https://mainnet-public.mirrornode.hedera.com'
        : 'https://testnet.mirrornode.hedera.com';
      
      // Configurazione axios
      const axiosConfig = {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      };
      
      // URL per ottenere le transazioni dell'account
      const url = `${mirrorNodeBaseUrl}/api/v1/transactions?account.id=${userAccountId}&limit=${limit}&order=${order}`;
      console.log(`Requesting transactions from Mirror Node API: ${url}`);
      
      // Ottieni le transazioni dall'API Mirror Node
      const response = await axios.get(url, axiosConfig);
      
      if (!response.data.transactions || response.data.transactions.length === 0) {
        console.log('No transactions found for this account');
        return [];
      }
      
      console.log(`Retrieved ${response.data.transactions.length} transactions from Mirror Node API for account ${userAccountId}`);
      
      return response.data.transactions;
    } catch (error) {
      console.error("Error getting account transactions:", error);
      throw error;
    }
  }

  /**
   * Ottiene le transazioni relative a un token specifico
   * @param tokenId ID del token
   * @param limit Numero massimo di transazioni da recuperare (default 50)
   * @param order Ordine di ordinamento (default 'desc')
   * @returns Array di transazioni
   */
  async getTokenTransactions(
    tokenId: string,
    limit: number = 50,
    order: 'asc' | 'desc' = 'desc'
  ): Promise<Transaction[]> {
    try {
      if (!tokenId) {
        throw new Error('Token ID is required');
      }

      console.log(`Getting transactions for token ${tokenId}`);

      // Utilizziamo Mirror Node API
      const network = config.hedera.network.toLowerCase();
      const mirrorNodeBaseUrl = network === 'mainnet'
        ? 'https://mainnet-public.mirrornode.hedera.com'
        : 'https://testnet.mirrornode.hedera.com';

      // Configurazione axios
      const axiosConfig = {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      };

      // URL corretto per ottenere le transazioni relative a un token
      // Invece di usare ?token.id=, che non è supportato, usiamo l'endpoint corretto
      const url = `${mirrorNodeBaseUrl}/api/v1/tokens/${tokenId}/transactions?limit=${limit}&order=${order}`;
      console.log(`Requesting token transactions from Mirror Node API: ${url}`);

      // Ottieni le transazioni dall'API Mirror Node
      const response = await axios.get(url, axiosConfig);

      if (!response.data.transactions || response.data.transactions.length === 0) {
        console.log(`No transactions found for token ${tokenId}`);
        return [];
      }

      console.log(`Retrieved ${response.data.transactions.length} transactions from Mirror Node API for token ${tokenId}`);

      return response.data.transactions;
    } catch (error) {
      // Se c'è un errore specifico o se l'endpoint non esiste (404), 
      // proviamo a ottenere tutte le transazioni e filtrarle lato server
      console.error(`Error getting token transactions for ${tokenId}:`, error);
      
      console.log(`Falling back to manual filtering for token ${tokenId}`);
      
      try {
        // Ottieni tutte le transazioni dell'account
        const allTransactions = await this.getAccountTransactions(undefined, 100, order);
        
        console.log(`Checking ${allTransactions.length} total transactions for token ${tokenId}`);
        
        // Log di debug per verificare la struttura dei dati
        if (allTransactions.length > 0) {
          console.log("First transaction sample structure:", JSON.stringify(allTransactions[0], null, 2));
          
          // Controlla se ci sono token_transfers nel primo elemento
          if (allTransactions[0].token_transfers && allTransactions[0].token_transfers.length > 0) {
            console.log("First token_transfer sample:", JSON.stringify(allTransactions[0].token_transfers[0], null, 2));
          } else {
            console.log("No token_transfers in the first transaction");
          }
          
          // Controlla anche per transazioni di creazione token
          console.log("Checking for token creation transactions...");
          const creationTx = allTransactions.find(tx => 
            tx.entity_id === tokenId && 
            (tx.type === "TOKENCREATION" || tx.type === "CRYPTOTRANSFERTREATE")
          );
          
          if (creationTx) {
            console.log("Found token creation transaction:", JSON.stringify(creationTx, null, 2));
          } else {
            console.log("No token creation transaction found");
          }
        }
        
        // Filtra manualmente le transazioni che coinvolgono il token
        const tokenTransactions = allTransactions.filter(tx => {
          // Controlla nei token_transfers
          if (tx.token_transfers && Array.isArray(tx.token_transfers)) {
            const hasToken = tx.token_transfers.some(transfer => {
              // Il transfer.token_id contiene l'ID del token coinvolto
              const matches = transfer.token_id === tokenId;
              if (matches) {
                console.log(`Found a matching token transfer: ${JSON.stringify(transfer)}`);
              }
              return matches;
            });
            
            if (hasToken) return true;
          }
          
          // Considera anche le transazioni di creazione del token
          if (tx.entity_id === tokenId) {
            console.log(`Found transaction with matching entity_id: ${tx.transaction_id}`);
            return true;
          }
          
          return false;
        });
        
        console.log(`Manually filtered ${tokenTransactions.length} transactions for token ${tokenId}`);
        
        return tokenTransactions;
      } catch (fallbackError) {
        console.error(`Fallback filtering also failed for token ${tokenId}:`, fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * Ottiene informazioni su un token specifico
   * @param tokenId ID del token
   * @returns Informazioni sul token
   */
  async getTokenInfo(tokenId: string): Promise<any> {
    try {
      // Verifica se abbiamo già le informazioni in cache
      if (this.tokenInfoCache.has(tokenId)) {
        return this.tokenInfoCache.get(tokenId);
      }

      console.log(`Getting token info for ${tokenId}`);

      // Utilizziamo Mirror Node API
      const network = config.hedera.network.toLowerCase();
      const mirrorNodeBaseUrl = network === 'mainnet'
        ? 'https://mainnet-public.mirrornode.hedera.com'
        : 'https://testnet.mirrornode.hedera.com';

      // Configurazione axios
      const axiosConfig = {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 5000, // 5 second timeout
      };

      // URL per ottenere informazioni sul token
      const url = `${mirrorNodeBaseUrl}/api/v1/tokens/${tokenId}`;
      
      // Ottieni le informazioni sul token
      const response = await axios.get(url, axiosConfig);
      
      // Salva le informazioni in cache
      this.tokenInfoCache.set(tokenId, response.data);
      
      return response.data;
    } catch (error) {
      console.error(`Error getting token info for ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Decodifica il memo di una transazione da base64
   * @param memoBase64 Memo in formato base64
   * @returns Memo decodificato
   */
  decodeMemo(memoBase64?: string): string {
    if (!memoBase64) return '';
    try {
      return Buffer.from(memoBase64, 'base64').toString();
    } catch (error) {
      console.error("Error decoding memo:", error);
      return '';
    }
  }

  /**
   * Categorizza una transazione
   * @param transaction Transazione da categorizzare
   * @returns Categoria di transazione
   */
  categorizeTransaction(transaction: any): TransactionCategory {
    const type = transaction.type?.toLowerCase() || '';
    const accountId = this.accountId;
    
    // Categoria di default
    let category: TransactionCategory = {
      type: 'transaction',
      label: 'Transaction',
      description: 'Generic transaction',
      color: 'gray',
      icon: 'arrow-down-up'
    };
    
    // PRIORITY 1: Riconoscimento specifico dei tipi di transazione Hedera
    
    // Transazione di BURN TOKEN
    if (type.includes('tokenburn') || type === 'tokenburn') {
      category = {
        type: 'token_burn',
        label: 'Token Burn',
        description: 'Tokens permanently destroyed',
        color: 'red',
        icon: 'trending-down'
      };
      return category;
    }
    
    // Transazione di MINT TOKEN
    if (type.includes('tokenmint') || type === 'tokenmint') {
      category = {
        type: 'token_mint',
        label: 'Token Mint',
        description: 'New tokens created',
        color: 'green',
        icon: 'trending-up'
      };
      return category;
    }
    
    // Transazione di CREAZIONE TOKEN
    if (type.includes('tokencreation') || type === 'tokencreation' || (type.includes('token') && type.includes('create'))) {
      category = {
        type: 'token_create',
        label: 'Token Creation',
        description: 'New token created',
        color: 'indigo',
        icon: 'database'
      };
      return category;
    }
    
    // Transazione di ASSOCIAZIONE TOKEN
    if (type.includes('tokenassociate') || type === 'tokenassociate') {
      category = {
        type: 'token_associate',
        label: 'Token Association',
        description: 'Token associated with account',
        color: 'blue',
        icon: 'database'
      };
      return category;
    }
    
    // PRIORITY 2: Analisi dei trasferimenti token
    if (transaction.tokenTransfers && transaction.tokenTransfers.length > 0) {
      const tokenTransfers = transaction.tokenTransfers;
      let incomingTransfer = false;
      let outgoingTransfer = false;
      
      // Verifica la direzione dei trasferimenti
      for (const transfer of tokenTransfers) {
        const to = transfer.to || transfer.account_id;
        const from = transfer.from || '';
        
        if (to === accountId) incomingTransfer = true;
        if (from === accountId) outgoingTransfer = true;
      }
      
      if (incomingTransfer && outgoingTransfer) {
        category = {
          type: 'token_exchange',
          label: 'Token Exchange',
          description: 'Token exchange transaction',
          color: 'blue',
          icon: 'arrow-down-up'
        };
      } else if (incomingTransfer) {
        category = {
          type: 'token_receive',
          label: 'Token Purchase',
          description: 'Tokens received',
          color: 'green',
          icon: 'trending-up'
        };
      } else if (outgoingTransfer) {
        category = {
          type: 'token_send',
          label: 'Token Sale',
          description: 'Tokens sent',
          color: 'red',
          icon: 'trending-down'
        };
      } else {
        category = {
          type: 'token_transaction',
          label: 'Token Transfer',
          description: 'Token transaction',
          color: 'blue',
          icon: 'database'
        };
      }
      
      return category;
    }
    
    // PRIORITY 3: Analisi dei trasferimenti HBAR
    if (type.includes('transfer') && transaction.transfers && transaction.transfers.length > 0) {
      const transfers = transaction.transfers;
      let incomingTransfer = false;
      let outgoingTransfer = false;
      
      // Verifica la direzione dei trasferimenti
      for (const transfer of transfers) {
        const account = transfer.account || '';
        const amount = transfer.amount || 0;
        
        if (account === accountId && amount > 0) incomingTransfer = true;
        if (account === accountId && amount < 0) outgoingTransfer = true;
      }
      
      if (incomingTransfer) {
        category = {
          type: 'hbar_receive',
          label: 'HBAR Received',
          description: 'HBAR funds received',
          color: 'green',
          icon: 'corner-down-right'
        };
      }
      
      if (outgoingTransfer) {
        category = {
          type: 'hbar_send',
          label: 'HBAR Sent',
          description: 'HBAR funds sent',
          color: 'red',
          icon: 'corner-up-right'
        };
      }
      
      return category;
    }
    
    // PRIORITY 4: Altri tipi di transazione
    
    // Transazione di creazione account
    if (type.includes('crypt') && type.includes('create')) {
      category = {
        type: 'account_create',
        label: 'Account Creation',
        description: 'Account creation',
        color: 'purple',
        icon: 'file-plus'
      };
      return category;
    }
    
    return category;
  }

  /**
   * Formatta una transazione per visualizzazione
   * @param transaction Transazione da formattare
   * @returns Transazione formattata
   */
  formatTransaction(transaction: Transaction): any {
    // Crea l'oggetto base della transazione formattata
    const formattedTx: {
      id: string;
      timestamp: string;
      type: string;
      result: string;
      memo: string;
      transfers: any[];
      tokenTransfers: any[];
      date: string;
      hash: string;
      fee: number;
      entity_id: string | null;
      category?: TransactionCategory;
    } = {
      id: transaction.transaction_id,
      timestamp: transaction.consensus_timestamp,
      type: transaction.type,
      result: transaction.result,
      memo: this.decodeMemo(transaction.memo_base64),
      transfers: transaction.transfers || [],
      tokenTransfers: transaction.token_transfers || [],
      date: new Date(Number(transaction.consensus_timestamp) * 1000).toISOString(),
      hash: transaction.transaction_hash || '',
      fee: transaction.charged_tx_fee || 0,
      entity_id: transaction.entity_id || null
    };

    // Aggiungi la categorizzazione
    const category = this.categorizeTransaction(formattedTx);
    formattedTx.category = category;

    // Aggiungi dettagli specifici per transazioni di token burn/mint
    if (category.type === 'token_burn' || category.type === 'token_mint') {
      // Per transazioni burn/mint, il token ID dovrebbe essere nell'entity_id o nei token_transfers
      let tokenId = formattedTx.entity_id;
      
      // Se non abbiamo entity_id, prova a trovarlo nei token_transfers
      if (!tokenId && formattedTx.tokenTransfers && formattedTx.tokenTransfers.length > 0) {
        tokenId = formattedTx.tokenTransfers[0].token_id;
      }
      
      // Aggiungi informazioni di contesto alla categoria
      if (tokenId) {
        const operation = category.type === 'token_burn' ? 'burned' : 'minted';
        formattedTx.category = {
          ...category,
          description: `Token ${operation} - ${tokenId}`,
        };
      }
    }

    // Aggiungi i dettagli di direzione per i trasferimenti
    if (formattedTx.tokenTransfers && formattedTx.tokenTransfers.length > 0) {
      formattedTx.tokenTransfers = formattedTx.tokenTransfers.map((transfer: any) => {
        // Determina la direzione del trasferimento rispetto all'account dell'utente
        if (transfer.account_id === this.accountId) {
          transfer.direction = transfer.amount > 0 ? 'incoming' : 'outgoing';
        } else if (transfer.to === this.accountId) {
          transfer.direction = 'incoming';
        } else if (transfer.from === this.accountId) {
          transfer.direction = 'outgoing';
        } else {
          transfer.direction = 'external';
        }
        
        return transfer;
      });
    }

    return formattedTx;
  }
}

// Crea un'istanza singleton
export const transactionService = new TransactionService(); 