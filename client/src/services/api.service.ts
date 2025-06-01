/**
 * API Service for communicating with the backend
 */

// Base URL for API requests
const API_BASE_URL = 'http://localhost:3002/api';

// Types
export interface Asset {
  value: string;
  label: string;
  allocation?: number;
}

export interface TokenCreateRequest {
  name: string;
  symbol: string;
  composition: Asset[];
}

export interface TokenInfo {
  tokenId: string;
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  treasury: string;
  memo?: string;
  composition?: Asset[];
  metadataFileId?: string;
  metadataSource?: 'hedera' | 'unavailable';
  createdAt?: string;
  fileTransactionId?: string;
}

/**
 * Interfaccia per la richiesta di collaterale
 */
export interface CollateralAsset {
  assetId: string;
  assetType: 'HBAR' | 'TOKEN' | 'NFT';
  label: string;
  amount: number;
  usdValue?: number; // USD value of the asset
  hbarEquivalent?: number; // HBAR equivalent for the asset
}

/**
 * Interfaccia per i record di collaterale
 */
export interface CollateralRecord {
  tokenId: string;
  assets: CollateralAsset[];
  timestamp: string;
  transactionId?: string;
}

/**
 * Interfaccia per una partecipazione nel portafoglio
 */
export interface PortfolioHolding {
  tokenId: string;
  balance: number;
  acquisitionDate: string;
  acquisitionPrice?: number;
  tokenInfo?: TokenInfo;
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
 * Interfaccia per le informazioni di token in una transazione
 */
export interface TransactionTokenInfo {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  transfers: any[];
}

/**
 * Interfaccia per una transazione
 */
export interface Transaction {
  id: string;
  timestamp: string;
  date: string;
  type: string;
  result: string;
  memo: string;
  transfers: any[];
  tokenTransfers: any[];
  hash: string;
  fee: number;
  entity_id?: string; // ID dell'entità creata (per transazioni di creazione)
  category?: TransactionCategory; // Categoria della transazione
  tokens?: Record<string, TransactionTokenInfo>; // Informazioni sui token coinvolti
  createdToken?: { // Informazioni sul token creato (per transazioni di creazione token)
    id: string;
    name: string;
    symbol: string;
    decimals: number;
  };
}

/**
 * Interface for token minting result
 */
export interface TokenMintResult {
  success: boolean;
  transactionId: string;
  amount: number;
  mintStatus: string;
  collateralDeposited?: number; // HBAR amount deposited as collateral
  message?: string;
  fee?: number;
  timestamp?: string;
  network?: 'mainnet' | 'testnet';
  collateralError?: boolean; // True if collateral transfer failed
}

/**
 * Interface for token burn result
 */
export interface TokenBurnResult {
  success: boolean;
  transactionId: string;
  collateralTransactionId?: string; // Transaction ID for collateral release
  amount: number;
  burnStatus: string;
  collateralReleased?: number; // HBAR amount released as collateral
  message?: string;
  fee?: number;
  timestamp?: string;
  network?: 'mainnet' | 'testnet';
  collateralError?: boolean; // True if collateral release failed
}

/**
 * API service for token operations
 */
export const tokenApi = {
  /**
   * Create a new token
   * @param data Token creation data
   * @returns Promise with token creation result
   */
  async createToken(data: TokenCreateRequest) {
    try {
      // Ensure all allocations are valid numbers
      const compositionWithValidAllocations = data.composition.map(asset => ({
        ...asset,
        allocation: asset.allocation || 0
      }));

      const requestData = {
        ...data,
        composition: compositionWithValidAllocations
      };

      const response = await fetch(`${API_BASE_URL}/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create token');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating token:', error);
      throw error;
    }
  },

  /**
   * Get token information
   * @param tokenId Token ID to fetch
   * @returns Promise with token info
   */
  async getTokenInfo(tokenId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get token info');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting token info:', error);
      throw error;
    }
  },

  /**
   * Mint new tokens
   * @param tokenId Token ID to mint
   * @param amount Amount to mint
   * @returns Promise with minting result
   */
  async mintToken(tokenId: string, amount: number): Promise<TokenMintResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mint tokens');
      }

      const result = await response.json();
      
      // Add current timestamp if not provided by the server
      if (!result.timestamp) {
        result.timestamp = new Date().toISOString();
      }
      
      // Set default network if not provided
      if (!result.network) {
        result.network = 'testnet';
      }
      
      return result;
    } catch (error) {
      console.error('Error minting tokens:', error);
      throw error;
    }
  },

  /**
   * Get all tokens
   * @returns Promise with all token information
   */
  async getAllTokens() {
    try {
      const response = await fetch(`${API_BASE_URL}/tokens`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch tokens');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting tokens:', error);
      throw error;
    }
  },

  /**
   * Get token balance for an account
   * @param tokenId Token ID to check balance for
   * @param accountId Optional account ID (default is user's account)
   * @returns Promise with account balance for the token
   */
  async getTokenBalance(tokenId: string, accountId?: string) {
    try {
      const url = accountId 
        ? `${API_BASE_URL}/tokens/${tokenId}/balance?accountId=${accountId}`
        : `${API_BASE_URL}/tokens/${tokenId}/balance`;
        
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get token balance');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting token balance:', error);
      throw error;
    }
  },

  /**
   * Burn tokens
   * @param tokenId Token ID to burn
   * @param amount Amount to burn
   * @returns Promise with burning result
   */
  async burnToken(tokenId: string, amount: number): Promise<TokenBurnResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/burn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to burn tokens');
      }

      const result = await response.json();
      
      // Add current timestamp if not provided by the server
      if (!result.timestamp) {
        result.timestamp = new Date().toISOString();
      }
      
      // Set default network if not provided
      if (!result.network) {
        result.network = 'testnet';
      }
      
      return result;
    } catch (error) {
      console.error('Error burning tokens:', error);
      throw error;
    }
  },

  /**
   * Get token transactions
   * @param tokenId Token ID to fetch transactions for
   * @param limit Maximum number of transactions to return
   * @param order Order of transactions (asc or desc)
   * @param includeTokenInfo Whether to include token information
   * @returns Promise with token transactions
   */
  async getTokenTransactions(tokenId: string, limit: number = 50, order: 'asc' | 'desc' = 'desc', includeTokenInfo: boolean = true) {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        order,
        includeTokenInfo: includeTokenInfo.toString()
      });

      const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/transactions?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get token transactions');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting token transactions:', error);
      throw error;
    }
  },

  /**
   * Get collateral records for a token
   * @param tokenId Token ID to fetch collateral records for
   * @returns Promise with collateral records
   */
  async getCollateralRecords(tokenId: string): Promise<CollateralRecord[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/collateral-records`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get collateral records');
      }

      const data = await response.json();
      return data.records || [];
    } catch (error) {
      console.error('Error getting collateral records:', error);
      throw error;
    }
  }
};

/**
 * API service for portfolio operations
 */
export const portfolioApi = {
  /**
   * Get user portfolio holdings
   * @returns Promise with user portfolio holdings
   */
  async getPortfolio() {
    try {
      const response = await fetch(`${API_BASE_URL}/portfolio`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get portfolio');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting portfolio:', error);
      throw error;
    }
  },
  
  /**
   * Add token to portfolio (simulation)
   * @param tokenId Token ID to add
   * @param amount Amount to add
   * @returns Promise with added token information
   */
  async addToPortfolio(tokenId: string, amount: number) {
    try {
      const response = await fetch(`${API_BASE_URL}/portfolio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokenId, amount }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add to portfolio');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error adding to portfolio:', error);
      throw error;
    }
  }
};

/**
 * API service for Hedera connection status
 */
export const hederaApi = {
  /**
   * Check Hedera connection status
   * @returns Promise with connection status
   */
  async checkStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/hedera/status`);
      
      if (!response.ok) {
        throw new Error('Failed to check Hedera status');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error checking Hedera status:', error);
      throw error;
    }
  },

  /**
   * Get account information including HBAR balance
   * @returns Promise with account information
   */
  async getAccountInfo() {
    try {
      const response = await fetch(`${API_BASE_URL}/hedera/account`);
      
      if (!response.ok) {
        throw new Error('Failed to get account information');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting account information:', error);
      throw error;
    }
  },

  /**
   * Get HBAR balance for the current account
   * @returns Promise with HBAR balance information
   */
  async getHbarBalance() {
    try {
      const response = await fetch(`${API_BASE_URL}/hedera/hbar-balance`);
      
      if (!response.ok) {
        throw new Error('Failed to get HBAR balance');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting HBAR balance:', error);
      throw error;
    }
  },
};

/**
 * API service for transaction operations
 */
export const transactionApi = {
  /**
   * Get account transactions
   * @param limit Number of transactions to retrieve (default 50)
   * @param order Order of transactions (asc or desc) (default desc)
   * @param includeTokenInfo Whether to include token information (default true)
   * @returns Promise with transactions
   */
  async getTransactions(limit: number = 50, order: 'asc' | 'desc' = 'desc', includeTokenInfo: boolean = true) {
    try {
      const response = await fetch(`${API_BASE_URL}/transactions?limit=${limit}&order=${order}&includeTokenInfo=${includeTokenInfo}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get transactions');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw error;
    }
  },

  /**
   * Get transactions for a specific token
   * @param tokenId Token ID to get transactions for
   * @param limit Number of transactions to retrieve (default 50)
   * @param order Order of transactions (asc or desc) (default desc)
   * @param includeTokenInfo Whether to include token information (default true)
   * @returns Promise with token transactions
   */
  async getTokenTransactions(tokenId: string, limit: number = 50, order: 'asc' | 'desc' = 'desc', includeTokenInfo: boolean = true) {
    try {
      const response = await fetch(`${API_BASE_URL}/transactions/token/${tokenId}?limit=${limit}&order=${order}&includeTokenInfo=${includeTokenInfo}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get token transactions');
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error getting transactions for token ${tokenId}:`, error);
      throw error;
    }
  }
};

export default {
  token: tokenApi,
  hedera: hederaApi,
  portfolio: portfolioApi,
  transaction: transactionApi
}; 