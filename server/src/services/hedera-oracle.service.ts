import { Client, PrivateKey } from '@hashgraph/sdk';
import axios, { AxiosError } from 'axios';
import config from '../config';

/**
 * HederaOracleService - Specialized oracle service for Hedera tokens
 * 
 * This service provides price data specifically for tokens on the Hedera network
 * by integrating with Hedera's APIs and third-party data providers.
 */
export class HederaOracleService {
  private static instance: HederaOracleService;
  private client: Client;
  private priceCache: Map<string, { price: number, timestamp: number }> = new Map();
  private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  private readonly EXTENDED_CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes for fallback
  
  // Rate limiting and retry configuration
  private lastApiCallTime: number = 0;
  private readonly MIN_API_INTERVAL_MS = 1000; // Minimum 1 second between API calls
  private readonly MAX_RETRIES = 3;
  private readonly BASE_RETRY_DELAY_MS = 1000; // Start with 1 second delay
  
  // Fallback HBAR price for when all API calls fail
  private readonly FALLBACK_HBAR_PRICE = 0.08; // Conservative estimate
  
  // Mock mode flag - set to true to use fake prices
  private readonly USE_MOCK_PRICES = true;
  
  private constructor() {
    // Initialize Hedera client
    // Use the appropriate client initialization based on network
    if (config.hedera.network === 'testnet') {
      this.client = Client.forTestnet();
    } else if (config.hedera.network === 'mainnet') {
      this.client = Client.forMainnet();
    } else {
      // Default to testnet if network is not recognized
      this.client = Client.forTestnet();
    }
    
    this.client.setOperator(
      config.hedera.accountId,
      PrivateKey.fromStringECDSA(config.hedera.privateKey)
    );
    
    console.log(`[HEDERA ORACLE] Initialized with account ${config.hedera.accountId} on ${config.hedera.network}`);
  }
  
  /**
   * Get singleton instance of HederaOracleService
   */
  public static getInstance(): HederaOracleService {
    if (!HederaOracleService.instance) {
      HederaOracleService.instance = new HederaOracleService();
    }
    return HederaOracleService.instance;
  }

  /**
   * Sleep utility function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Rate-limited API call wrapper
   */
  private async rateLimitedApiCall<T>(apiCall: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCallTime;
    
    if (timeSinceLastCall < this.MIN_API_INTERVAL_MS) {
      const delayMs = this.MIN_API_INTERVAL_MS - timeSinceLastCall;
      console.log(`[HEDERA ORACLE] Rate limiting: waiting ${delayMs}ms before API call`);
      await this.sleep(delayMs);
    }
    
    this.lastApiCallTime = Date.now();
    return await apiCall();
  }

  /**
   * Fetch HBAR price with retry logic and exponential backoff
   */
  private async fetchHbarPriceWithRetry(retryCount: number = 0): Promise<number> {
    try {
      return await this.rateLimitedApiCall(async () => {
        console.log(`[HEDERA ORACLE] Fetching HBAR price (attempt ${retryCount + 1}/${this.MAX_RETRIES + 1})`);
        
        const response = await axios.get(
          'https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd',
          {
            timeout: 10000, // 10 second timeout
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'TrustTokenETF/1.0'
            }
          }
        );
        
        const price = response.data['hedera-hashgraph']?.usd;
        if (!price || typeof price !== 'number') {
          throw new Error('HBAR price not available in API response');
        }
        
        console.log(`[HEDERA ORACLE] Successfully fetched HBAR price: $${price}`);
        return price;
      });
    } catch (error) {
      console.error(`[HEDERA ORACLE] API call failed (attempt ${retryCount + 1}):`, error instanceof Error ? error.message : 'Unknown error');
      
      // Handle rate limiting specifically
      if (error instanceof AxiosError) {
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '0', 10);
          const delayMs = retryAfter > 0 ? retryAfter * 1000 : this.BASE_RETRY_DELAY_MS * Math.pow(2, retryCount);
          
          console.log(`[HEDERA ORACLE] Rate limited (429). Retry after: ${delayMs}ms`);
          
          if (retryCount < this.MAX_RETRIES) {
            await this.sleep(delayMs);
            return await this.fetchHbarPriceWithRetry(retryCount + 1);
          }
        } else if (error.response && error.response.status >= 500 && retryCount < this.MAX_RETRIES) {
          // Server error, retry with exponential backoff
          const delayMs = this.BASE_RETRY_DELAY_MS * Math.pow(2, retryCount);
          console.log(`[HEDERA ORACLE] Server error (${error.response.status}). Retrying in ${delayMs}ms`);
          await this.sleep(delayMs);
          return await this.fetchHbarPriceWithRetry(retryCount + 1);
        }
      } else if (retryCount < this.MAX_RETRIES) {
        // Network or other error, retry with exponential backoff
        const delayMs = this.BASE_RETRY_DELAY_MS * Math.pow(2, retryCount);
        console.log(`[HEDERA ORACLE] Network error. Retrying in ${delayMs}ms`);
        await this.sleep(delayMs);
        return await this.fetchHbarPriceWithRetry(retryCount + 1);
      }
      
      // If all retries failed, throw the error
      throw error;
    }
  }
  
  /**
   * Get price of HBAR in USD
   * Uses a third-party API (CoinGecko) for now, but could be replaced with a direct
   * integration with a Hedera-native price oracle in the future
   * 
   * @returns The current price of HBAR in USD
   */
  public async getHbarPrice(): Promise<number> {
    try {
      // If mock mode is enabled, return mock HBAR price
      if (this.USE_MOCK_PRICES) {
        const mockPrice = 0.087; // Fixed mock HBAR price - matches main oracle service
        console.log(`[HEDERA ORACLE] Using mock HBAR price: $${mockPrice}`);
        
        // Still cache the mock price for consistency
        this.priceCache.set('HBAR', {
          price: mockPrice,
          timestamp: Date.now()
        });
        
        return mockPrice;
      }
      
      // Check for fresh cached price first
      const cached = this.priceCache.get('HBAR');
      if (cached && Date.now() - cached.timestamp < this.CACHE_EXPIRY_MS) {
        console.log(`[HEDERA ORACLE] Using fresh cached HBAR price: $${cached.price}`);
        return cached.price;
      }
      
      // Try to fetch new price with retry logic
      const price = await this.fetchHbarPriceWithRetry();
      
      // Update cache with fresh price
      this.priceCache.set('HBAR', {
        price,
        timestamp: Date.now()
      });
      
      return price;
    } catch (error) {
      console.error('[HEDERA ORACLE] Error fetching HBAR price after all retries:', error);
      
      // Check for stale cached price (extended expiry)
      const cached = this.priceCache.get('HBAR');
      if (cached && Date.now() - cached.timestamp < this.EXTENDED_CACHE_EXPIRY_MS) {
        console.log(`[HEDERA ORACLE] Using stale cached HBAR price due to API failure: $${cached.price}`);
        return cached.price;
      }
      
      // If no cache available, use fallback price
      console.warn(`[HEDERA ORACLE] No cached price available, using fallback HBAR price: $${this.FALLBACK_HBAR_PRICE}`);
      
      // Store fallback price in cache with short expiry
      this.priceCache.set('HBAR', {
        price: this.FALLBACK_HBAR_PRICE,
        timestamp: Date.now() - (this.CACHE_EXPIRY_MS - 30000) // Expire in 30 seconds
      });
      
      return this.FALLBACK_HBAR_PRICE;
    }
  }
  
  /**
   * Get price of a Hedera token by its token ID
   * 
   * Note: For now, this is a mock implementation as most custom Hedera tokens
   * don't have reliable price feeds. In a production environment, this would
   * integrate with a proper Hedera price oracle or derive prices from DEX liquidity.
   * 
   * @param tokenId The ID of the token on Hedera
   * @returns The current price in USD
   */
  public async getTokenPrice(tokenId: string): Promise<number> {
    try {
      const cached = this.priceCache.get(tokenId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_EXPIRY_MS) {
        return cached.price;
      }
      
      // For now, we'll simulate price data for custom tokens
      // In a real implementation, you would query a Hedera-native price oracle or DEX
      
      // Mock implementation - in reality, you would use a price oracle or DEX data
      const mockPrice = this.getMockPrice(tokenId);
      
      // Update cache
      this.priceCache.set(tokenId, {
        price: mockPrice,
        timestamp: Date.now()
      });
      
      return mockPrice;
    } catch (error) {
      console.error(`[HEDERA ORACLE] Error fetching token price for ${tokenId}:`, error);
      
      // If we have a cached price, return it as fallback
      const cached = this.priceCache.get(tokenId);
      if (cached) {
        return cached.price;
      }
      
      throw new Error(`Failed to get price for token ${tokenId}`);
    }
  }
  
  /**
   * Get the type of a token
   * For now, all Hedera tokens are considered "crypto" type
   * 
   * @param tokenId The ID of the token on Hedera
   * @returns The token type
   */
  public getTokenType(tokenId: string): string {
    // In a real implementation, you might have different types of tokens on Hedera
    // For now, we'll consider all tokens as crypto
    return 'crypto';
  }

  /**
   * Check if cached data is available for HBAR price
   */
  public hasCachedHbarPrice(): boolean {
    const cached = this.priceCache.get('HBAR');
    return !!(cached && Date.now() - cached.timestamp < this.EXTENDED_CACHE_EXPIRY_MS);
  }

  /**
   * Get cache status for debugging
   */
  public getCacheStatus(): { [key: string]: { price: number; age: number; isFresh: boolean } } {
    const status: { [key: string]: { price: number; age: number; isFresh: boolean } } = {};
    
    this.priceCache.forEach((value, key) => {
      const age = Date.now() - value.timestamp;
      status[key] = {
        price: value.price,
        age: Math.floor(age / 1000), // Age in seconds
        isFresh: age < this.CACHE_EXPIRY_MS
      };
    });
    
    return status;
  }
  
  /**
   * Generate a mock price for a token based on its ID
   * This is only for demonstration purposes
   */
  private getMockPrice(tokenId: string): number {
    // Extract numeric portion of token ID (if any) to use as a seed
    const numericPart = tokenId.match(/\d+/g);
    let seed = 1;
    
    if (numericPart && numericPart.length > 0) {
      // Use the last few digits as a seed for pseudo-randomness
      const digits = numericPart[0].slice(-4);
      seed = parseInt(digits) / 10000;
    }
    
    // Base price between $0.10 and $100
    const basePrice = 0.1 + (seed * 99.9);
    
    // Add some "random" daily fluctuation based on the current day
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    const dailyFactor = Math.sin(dayOfYear * 0.1) * 0.05; // ±5% daily fluctuation
    
    return basePrice * (1 + dailyFactor);
  }
}

export default HederaOracleService.getInstance(); 