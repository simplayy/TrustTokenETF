/**
 * Oracle Service for price feed integration
 */

// Base URL for API requests
const API_BASE_URL = 'http://localhost:3002/api';

// Types
export interface PriceData {
  asset: string;
  price: number;
  assetType: string;
  timestamp: number;
}

export interface HistoricalPricePoint {
  timestamp: number;
  price: number;
}

export interface HistoricalPriceData {
  asset: string;
  assetType: string;
  priceData: Array<{timestamp: number, price: number}>;
  days: number;
}

export interface MultiPriceData {
  success: boolean;
  prices: Record<string, number>;
  timestamp: number;
}

export interface TokenPriceData {
  tokenId: string;
  price: number;
  timestamp: number;
}

export interface AvailableAssetsData {
  assets: string[];
  availableTypes: string[];
}

// Utility functions for better error handling
const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

const isRateLimitError = (error: any): boolean => {
  return error?.response?.status === 429 || 
         error?.message?.includes('Too Many Requests') ||
         error?.message?.includes('Rate limit');
};

const getRetryDelayFromError = (error: any): number => {
  const retryAfter = error?.response?.headers?.['retry-after'];
  if (retryAfter) {
    const delay = parseInt(retryAfter, 10);
    return delay > 0 ? delay * 1000 : 5000; // Convert to ms or default to 5s
  }
  return 5000; // Default 5 second delay
};

/**
 * Enhanced fetch wrapper with retry logic for rate limiting
 */
const fetchWithRetry = async (
  url: string, 
  options: RequestInit = {}, 
  maxRetries: number = 2
): Promise<Response> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // If successful, return response
      if (response.ok) {
        return response;
      }

      // Handle rate limiting specifically
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
        
        if (attempt < maxRetries) {
          console.warn(`Rate limited. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await delay(delayMs);
          continue;
        }
      }

      // For other errors, throw immediately
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // If it's a network error and we have retries left, try again
      if (attempt < maxRetries && !isRateLimitError(error)) {
        const delayMs = 1000 * Math.pow(2, attempt); // Exponential backoff
        console.warn(`Network error. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await delay(delayMs);
        continue;
      }
      
      // If it's a rate limit error and we have retries left
      if (attempt < maxRetries && isRateLimitError(error)) {
        const delayMs = getRetryDelayFromError(error);
        console.warn(`Rate limited. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await delay(delayMs);
        continue;
      }
    }
  }
  
  throw lastError!;
};

/**
 * Oracle API service for price data
 */
export const oracleApi = {
  /**
   * Get current price for an asset
   * @param asset Asset symbol (e.g., "BTC", "ETH", "AAPL")
   * @returns Promise with price data
   */
  async getPrice(asset: string): Promise<PriceData> {
    try {
      const encodedAsset = encodeURIComponent(asset);
      const response = await fetchWithRetry(`${API_BASE_URL}/oracle/price/${encodedAsset}`);

      return await response.json();
    } catch (error) {
      console.error(`Error getting price for ${asset}:`, error);
      throw error;
    }
  },

  /**
   * Get historical price data for an asset
   * @param asset Asset symbol
   * @param days Number of days of historical data
   * @returns Promise with historical price data
   */
  async getHistoricalPrices(asset: string, days: number = 7): Promise<HistoricalPriceData> {
    try {
      const encodedAsset = encodeURIComponent(asset);
      const response = await fetchWithRetry(`${API_BASE_URL}/oracle/history/${encodedAsset}?days=${days}`);

      return await response.json();
    } catch (error) {
      console.error(`Error getting historical prices for ${asset}:`, error);
      throw error;
    }
  },

  /**
   * Get prices for multiple assets
   * @param assets Array of asset symbols
   * @returns Promise with multi-price data
   */
  async getPrices(assets: string[]): Promise<MultiPriceData> {
    try {
      const encodedAssets = assets.map(asset => encodeURIComponent(asset)).join(',');
      const response = await fetchWithRetry(`${API_BASE_URL}/oracle/prices?assets=${encodedAssets}`);

      return await response.json();
    } catch (error) {
      console.error('Error getting prices:', error);
      throw error;
    }
  },

  /**
   * Get all available assets, optionally filtered by type
   * @param type Optional asset type filter
   * @returns Promise with available assets data
   */
  async getAvailableAssets(type?: string): Promise<AvailableAssetsData> {
    try {
      const url = type 
        ? `${API_BASE_URL}/oracle/assets?type=${type}`
        : `${API_BASE_URL}/oracle/assets`;
        
      const response = await fetchWithRetry(url);

      return await response.json();
    } catch (error) {
      console.error('Error getting available assets:', error);
      throw error;
    }
  },

  /**
   * Get current HBAR price
   * @returns Promise with HBAR price data
   */
  async getHbarPrice(): Promise<PriceData> {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/oracle/hbar/price`);

      return await response.json();
    } catch (error) {
      console.error('Error getting HBAR price:', error);
      throw error;
    }
  },

  /**
   * Get price for a Hedera token
   * @param tokenId Hedera token ID
   * @returns Promise with token price data
   */
  async getTokenPrice(tokenId: string): Promise<TokenPriceData> {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/oracle/token/${tokenId}/price`);

      return await response.json();
    } catch (error) {
      console.error(`Error getting price for token ${tokenId}:`, error);
      throw error;
    }
  },

  /**
   * Get debug information about oracle services
   * @returns Promise with debug information
   */
  async getDebugInfo(): Promise<any> {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/oracle/debug`);
      return await response.json();
    } catch (error) {
      console.error('Error getting oracle debug info:', error);
      throw error;
    }
  },

  /**
   * Check if an error is due to rate limiting
   * @param error The error to check
   * @returns True if the error is due to rate limiting
   */
  isRateLimitError(error: any): boolean {
    return isRateLimitError(error);
  },

  /**
   * Get user-friendly error message
   * @param error The error object
   * @returns User-friendly error message
   */
  getUserFriendlyErrorMessage(error: any): string {
    if (isRateLimitError(error)) {
      return 'The price service is temporarily busy. Please wait a moment and try again.';
    }
    
    if (error?.message?.includes('Network Error') || error?.message?.includes('Failed to fetch')) {
      return 'Unable to connect to the price service. Please check your internet connection.';
    }
    
    if (error?.message?.includes('timeout')) {
      return 'The price service is taking too long to respond. Please try again.';
    }
    
    return error?.message || 'An unexpected error occurred while fetching price data.';
  }
}; 