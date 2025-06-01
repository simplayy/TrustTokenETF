import axios from 'axios';
import { EventEmitter } from 'events';

/**
 * OracleService - Handles price feed integration for token assets
 * 
 * This service provides real-time and historical price data for various assets
 * including cryptocurrencies, stocks, commodities, and forex.
 */
export class OracleService {
  private static instance: OracleService;
  private priceCache: Map<string, { price: number, timestamp: number }>;
  private updateInterval: NodeJS.Timeout | null = null;
  private priceUpdateEmitter: EventEmitter;
  private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  private readonly UPDATE_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
  private useMockData: boolean = true;

  // Asset types supported by the oracle
  public readonly ASSET_TYPES = {
    CRYPTO: 'crypto',
    STOCK: 'stock',
    COMMODITY: 'commodity',
    FOREX: 'forex',
    ETF: 'etf',
    BOND: 'bond'
  };

  // Mock data for development when API is unavailable
  private mockPrices: Record<string, {price: number, type: string}> = {
    // Cryptocurrencies - Updated with more realistic current prices
    'BTC': {price: 67542.30, type: 'crypto'},      // Bitcoin
    'ETH': {price: 3789.45, type: 'crypto'},       // Ethereum
    'HBAR': {price: 0.087, type: 'crypto'},        // Hedera
    'SOL': {price: 198.67, type: 'crypto'},        // Solana
    'ADA': {price: 0.58, type: 'crypto'},          // Cardano
    'DOT': {price: 7.89, type: 'crypto'},          // Polkadot
    'AVAX': {price: 42.30, type: 'crypto'},        // Avalanche
    'MATIC': {price: 0.89, type: 'crypto'},        // Polygon
    'LINK': {price: 18.45, type: 'crypto'},        // Chainlink
    'UNI': {price: 9.87, type: 'crypto'},          // Uniswap
    'AAVE': {price: 145.60, type: 'crypto'},       // Aave
    'USDC': {price: 1.00, type: 'crypto'},         // USD Coin
    'USDT': {price: 1.00, type: 'crypto'},         // Tether
    'DAI': {price: 1.00, type: 'crypto'},          // Dai
    
    // Stocks - Updated with realistic prices
    'AAPL': {price: 189.84, type: 'stock'},        // Apple
    'MSFT': {price: 425.52, type: 'stock'},        // Microsoft
    'AMZN': {price: 178.08, type: 'stock'},        // Amazon
    'GOOGL': {price: 165.86, type: 'stock'},       // Alphabet/Google
    'META': {price: 474.99, type: 'stock'},        // Meta/Facebook
    'TSLA': {price: 177.58, type: 'stock'},        // Tesla
    'NVDA': {price: 1023.89, type: 'stock'},       // NVIDIA
    'BRK-A': {price: 544200.00, type: 'stock'},    // Berkshire Hathaway A
    'V': {price: 275.96, type: 'stock'},           // Visa
    'JNJ': {price: 156.72, type: 'stock'},         // Johnson & Johnson
    'WMT': {price: 68.89, type: 'stock'},          // Walmart
    'PG': {price: 165.43, type: 'stock'},          // Procter & Gamble
    'DIS': {price: 114.56, type: 'stock'},         // Disney
    'KO': {price: 62.78, type: 'stock'},           // Coca-Cola
    'NKE': {price: 79.34, type: 'stock'},          // Nike
    'JPM': {price: 198.73, type: 'stock'},         // JPMorgan Chase
    
    // Commodities
    'GOLD': {price: 2385.30, type: 'commodity'},   // Gold (per oz)
    'SILVER': {price: 28.15, type: 'commodity'},   // Silver (per oz)
    'OIL': {price: 78.26, type: 'commodity'},      // Crude Oil WTI
    'NATGAS': {price: 2.14, type: 'commodity'},    // Natural Gas
    'COPPER': {price: 4.23, type: 'commodity'},    // Copper
    
    // Forex
    'EUR/USD': {price: 1.0876, type: 'forex'},
    'USD/JPY': {price: 151.62, type: 'forex'},
    'GBP/USD': {price: 1.2841, type: 'forex'},
    
    // ETFs
    'SPY': {price: 511.34, type: 'etf'},
    'QQQ': {price: 434.28, type: 'etf'},
    'VTI': {price: 244.39, type: 'etf'},
    
    // Bonds
    'US10Y': {price: 4.25, type: 'bond'},
    'US30Y': {price: 4.38, type: 'bond'},
  };

  private constructor() {
    this.priceCache = new Map();
    this.priceUpdateEmitter = new EventEmitter();
    this.startPeriodicUpdates();
    
    // Log mock data status on initialization
    if (this.useMockData) {
      console.log('[ORACLE] 🎭 MOCK DATA MODE ENABLED - Using fake prices for all assets');
    }
  }

  /**
   * Get singleton instance of OracleService
   */
  public static getInstance(): OracleService {
    if (!OracleService.instance) {
      OracleService.instance = new OracleService();
    }
    return OracleService.instance;
  }

  /**
   * Enable or disable mock data mode
   */
  public setUseMockData(useMock: boolean): void {
    this.useMockData = useMock;
    console.log(`[ORACLE] ${useMock ? 'Enabled' : 'Disabled'} mock data mode`);
  }

  /**
   * Start periodic price updates
   */
  private startPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(async () => {
      try {
        // Get list of assets that need updating
        const assetsToUpdate = Array.from(this.priceCache.keys());
        if (assetsToUpdate.length > 0) {
          console.log(`[ORACLE] Updating prices for ${assetsToUpdate.length} assets`);
          for (const asset of assetsToUpdate) {
            await this.fetchPriceForAsset(asset);
          }
        }
      } catch (error) {
        console.error('[ORACLE] Error updating prices:', error);
      }
    }, this.UPDATE_INTERVAL_MS);
  }

  /**
   * Stop periodic price updates
   */
  public stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Subscribe to price updates for a specific asset
   */
  public onPriceUpdate(asset: string, callback: (price: number) => void): void {
    this.priceUpdateEmitter.on(`price:${asset}`, callback);
  }

  /**
   * Unsubscribe from price updates
   */
  public offPriceUpdate(asset: string, callback: (price: number) => void): void {
    this.priceUpdateEmitter.off(`price:${asset}`, callback);
  }

  /**
   * Get current price for an asset
   * @param asset Asset symbol (e.g., "BTC", "AAPL")
   * @returns Price in USD
   */
  public async getPrice(asset: string): Promise<number> {
    const normalizedAsset = asset.toUpperCase();
    const cached = this.priceCache.get(normalizedAsset);
    
    // If we have a recent price in cache, return it
    if (cached && Date.now() - cached.timestamp < this.CACHE_EXPIRY_MS) {
      return cached.price;
    }
    
    // Otherwise fetch a new price
    return this.fetchPriceForAsset(normalizedAsset);
  }

  /**
   * Determine the asset type from the asset symbol
   * @param asset Asset symbol
   * @returns Asset type (crypto, stock, etc.)
   */
  public getAssetType(asset: string): string {
    const normalizedAsset = asset.toUpperCase();
    
    // Check if we have this asset in our mock data with a defined type
    if (this.mockPrices[normalizedAsset]) {
      return this.mockPrices[normalizedAsset].type;
    }
    
    // Try to infer type from symbol
    if (normalizedAsset.includes('/')) {
      return this.ASSET_TYPES.FOREX;
    }
    
    // Default to crypto if we can't determine
    return this.ASSET_TYPES.CRYPTO;
  }

  /**
   * Fetch price data for a specific asset from external API
   * @param asset Asset symbol
   * @returns Current price in USD
   */
  private async fetchPriceForAsset(asset: string): Promise<number> {
    try {
      // If mock data mode is enabled, return mock price
      if (this.useMockData) {
        return this.getMockPrice(asset);
      }
      
      const assetType = this.getAssetType(asset);
      let price: number;
      
      switch (assetType) {
        case this.ASSET_TYPES.CRYPTO:
          price = await this.fetchCryptoPrice(asset);
          break;
        case this.ASSET_TYPES.STOCK:
          price = await this.fetchStockPrice(asset);
          break;
        case this.ASSET_TYPES.COMMODITY:
          price = await this.fetchCommodityPrice(asset);
          break;
        case this.ASSET_TYPES.FOREX:
          price = await this.fetchForexPrice(asset);
          break;
        case this.ASSET_TYPES.ETF:
          price = await this.fetchStockPrice(asset); // ETFs use the same API as stocks
          break;
        case this.ASSET_TYPES.BOND:
          price = await this.fetchBondPrice(asset);
          break;
        default:
          throw new Error(`Unknown asset type for ${asset}`);
      }
      
      // Update cache
      this.priceCache.set(asset, {
        price,
        timestamp: Date.now()
      });
      
      // Emit price update event
      this.priceUpdateEmitter.emit(`price:${asset}`, price);
      
      return price;
    } catch (error) {
      console.error(`[ORACLE] Error fetching price for ${asset}:`, error);
      
      // If we have any cached price, return it as fallback
      const cached = this.priceCache.get(asset);
      if (cached) {
        return cached.price;
      }
      
      // If no cache and API failed, use mock data as fallback
      if (!this.useMockData) {
        console.log(`[ORACLE] Falling back to mock data for ${asset}`);
        return this.getMockPrice(asset);
      }
      
      throw new Error(`Failed to get price for ${asset}`);
    }
  }

  /**
   * Fetch cryptocurrency price from CoinGecko API
   */
  private async fetchCryptoPrice(asset: string): Promise<number> {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${this.mapCryptoToId(asset)}&vs_currencies=usd`,
        {
          timeout: 10000, // 10 second timeout
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'TrustTokenETF/1.0'
          }
        }
      );
      
      const assetId = this.mapCryptoToId(asset);
      const price = response.data[assetId]?.usd;
      
      if (!price || typeof price !== 'number') {
        throw new Error(`Price not available for ${asset}`);
      }
      
      return price;
    } catch (error) {
      console.error(`[ORACLE] Error fetching crypto price for ${asset}:`, error);
      
      // If it's a rate limiting error, suggest using cached data or fallback
      if (error instanceof Error && error.message.includes('429')) {
        console.warn(`[ORACLE] Rate limited while fetching ${asset} price. Consider using cached data.`);
      }
      
      throw error;
    }
  }

  /**
   * Fetch stock price from an API (in a real implementation, this would use a stock API)
   */
  private async fetchStockPrice(asset: string): Promise<number> {
    // Example implementation with Alpha Vantage (you need an API key)
    // For now, we'll throw an error to trigger the mock data fallback
    // 
    // const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
    // if (!ALPHA_VANTAGE_API_KEY) {
    //   throw new Error('Alpha Vantage API key not configured');
    // }
    // 
    // const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${asset}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    // const response = await axios.get(url);
    // const quote = response.data['Global Quote'];
    // if (!quote || !quote['05. price']) {
    //   throw new Error(`No price data found for ${asset}`);
    // }
    // return parseFloat(quote['05. price']);
    
    throw new Error('Stock API not implemented, using mock data');
  }

  /**
   * Fetch commodity price from an API
   */
  private async fetchCommodityPrice(asset: string): Promise<number> {
    // In a real implementation, you would use a commodity API
    throw new Error('Commodity API not implemented, using mock data');
  }

  /**
   * Fetch forex price from an API
   */
  private async fetchForexPrice(asset: string): Promise<number> {
    // In a real implementation, you would use a forex API
    throw new Error('Forex API not implemented, using mock data');
  }

  /**
   * Fetch bond price/yield from an API
   */
  private async fetchBondPrice(asset: string): Promise<number> {
    // In a real implementation, you would use a bond API
    throw new Error('Bond API not implemented, using mock data');
  }

  /**
   * Get a mock price for an asset (for development/testing)
   * @param asset Asset symbol
   * @returns Mock price in USD
   */
  private getMockPrice(asset: string): number {
    const normalizedAsset = asset.toUpperCase();
    let basePrice: number;
    
    if (this.mockPrices[normalizedAsset]) {
      basePrice = this.mockPrices[normalizedAsset].price;
    } else {
      // Generate a consistent price for unknown assets
      const assetChars = normalizedAsset.split('');
      basePrice = assetChars.reduce((sum, char) => sum + char.charCodeAt(0), 0) / 10;
    }
    
    // Use the exact mock price without any variation for consistency
    const price = basePrice;
    
    // Update cache
    this.priceCache.set(normalizedAsset, {
      price,
      timestamp: Date.now()
    });
    
    // Emit price update event
    this.priceUpdateEmitter.emit(`price:${normalizedAsset}`, price);
    
    return price;
  }

  /**
   * Map crypto asset symbol to CoinGecko ID
   * @param asset Asset symbol
   * @returns CoinGecko asset ID
   */
  private mapCryptoToId(asset: string): string {
    // This is a simple mapping for common assets
    // In production, you would have a more comprehensive mapping
    const mapping: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'HBAR': 'hedera-hashgraph',
      'SOL': 'solana',
      'ADA': 'cardano',
      'DOT': 'polkadot',
      'AVAX': 'avalanche-2',
      'MATIC': 'matic-network',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'DAI': 'dai',
    };
    
    return mapping[asset] || asset.toLowerCase();
  }

  /**
   * Get historical price data for an asset
   * @param asset Asset symbol
   * @param days Number of days of historical data
   * @returns Array of price points
   */
  public async getHistoricalPrices(asset: string, days: number = 7): Promise<Array<{timestamp: number, price: number}>> {
    try {
      // If mock data mode is enabled, return mock historical data
      if (this.useMockData) {
        return this.getMockHistoricalPrices(asset, days);
      }
      
      const assetType = this.getAssetType(asset);
      
      switch (assetType) {
        case this.ASSET_TYPES.CRYPTO:
          return await this.fetchCryptoHistoricalPrices(asset, days);
        case this.ASSET_TYPES.STOCK:
        case this.ASSET_TYPES.ETF:
          return await this.fetchStockHistoricalPrices(asset, days);
        case this.ASSET_TYPES.COMMODITY:
          return await this.fetchCommodityHistoricalPrices(asset, days);
        case this.ASSET_TYPES.FOREX:
          return await this.fetchForexHistoricalPrices(asset, days);
        case this.ASSET_TYPES.BOND:
          return await this.fetchBondHistoricalPrices(asset, days);
        default:
          throw new Error(`Unknown asset type for ${asset}`);
      }
    } catch (error) {
      console.error(`[ORACLE] Error fetching historical prices for ${asset}:`, error);
      
      // If API failed, use mock data as fallback
      if (!this.useMockData) {
        console.log(`[ORACLE] Falling back to mock historical data for ${asset}`);
        return this.getMockHistoricalPrices(asset, days);
      }
      
      throw new Error(`Failed to get historical prices for ${asset}`);
    }
  }

  /**
   * Fetch historical cryptocurrency prices from CoinGecko API
   */
  private async fetchCryptoHistoricalPrices(asset: string, days: number): Promise<Array<{timestamp: number, price: number}>> {
    try {
      const assetId = this.mapCryptoToId(asset.toUpperCase());
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${assetId}/market_chart?vs_currency=usd&days=${days}`,
        {
          timeout: 15000, // 15 second timeout for historical data
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'TrustTokenETF/1.0'
          }
        }
      );
      
      // Format the response to a more usable structure
      return response.data.prices.map((item: [number, number]) => ({
        timestamp: item[0],
        price: item[1]
      }));
    } catch (error) {
      console.error(`[ORACLE] Error fetching historical crypto prices for ${asset}:`, error);
      
      // If it's a rate limiting error, provide helpful message
      if (error instanceof Error && error.message.includes('429')) {
        console.warn(`[ORACLE] Rate limited while fetching historical ${asset} prices. Using fallback data.`);
      }
      
      throw error;
    }
  }

  /**
   * Fetch historical stock prices (in a real implementation, this would use a stock API)
   */
  private async fetchStockHistoricalPrices(asset: string, days: number): Promise<Array<{timestamp: number, price: number}>> {
    // In a real implementation, you would use a stock API
    throw new Error('Stock historical API not implemented, using mock data');
  }

  /**
   * Fetch historical commodity prices
   */
  private async fetchCommodityHistoricalPrices(asset: string, days: number): Promise<Array<{timestamp: number, price: number}>> {
    // In a real implementation, you would use a commodity API
    throw new Error('Commodity historical API not implemented, using mock data');
  }

  /**
   * Fetch historical forex prices
   */
  private async fetchForexHistoricalPrices(asset: string, days: number): Promise<Array<{timestamp: number, price: number}>> {
    // In a real implementation, you would use a forex API
    throw new Error('Forex historical API not implemented, using mock data');
  }

  /**
   * Fetch historical bond prices/yields
   */
  private async fetchBondHistoricalPrices(asset: string, days: number): Promise<Array<{timestamp: number, price: number}>> {
    // In a real implementation, you would use a bond API
    throw new Error('Bond historical API not implemented, using mock data');
  }

  /**
   * Generate mock historical price data for an asset
   * @param asset Asset symbol
   * @param days Number of days of historical data
   * @returns Array of mock price points
   */
  private getMockHistoricalPrices(asset: string, days: number): Array<{timestamp: number, price: number}> {
    const normalizedAsset = asset.toUpperCase();
    let basePrice: number;
    
    if (this.mockPrices[normalizedAsset]) {
      basePrice = this.mockPrices[normalizedAsset].price;
    } else {
      basePrice = 10; // Default price for unknown assets
    }
    
    const now = Date.now();
    const result: Array<{timestamp: number, price: number}> = [];
    
    // Generate data points (8 per day)
    const totalPoints = days * 8;
    const msPerPoint = (days * 24 * 60 * 60 * 1000) / totalPoints;
    
    // Get asset type for more realistic price movements
    const assetType = this.getAssetType(asset);
    
    // Create a deterministic seed based on asset name
    const seed = normalizedAsset.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Simple seeded random function
    const seededRandom = (index: number) => {
      const x = Math.sin(seed + index) * 10000;
      return x - Math.floor(x);
    };
    
    for (let i = 0; i < totalPoints; i++) {
      // Create a timestamp for this point
      const timestamp = now - (totalPoints - i) * msPerPoint;
      
      // Generate a price with some deterministic variation based on asset type
      const dayFactor = i / (totalPoints / days); // 0 to 'days'
      let trendFactor = Math.sin(dayFactor) * 0.2; // -0.2 to 0.2
      let randomFactor = (seededRandom(i) * 0.1) - 0.05; // -0.05 to 0.05 (deterministic)
      
      // Adjust volatility based on asset type
      switch (assetType) {
        case this.ASSET_TYPES.CRYPTO:
          // Higher volatility for crypto
          trendFactor *= 1.5;
          randomFactor *= 2;
          break;
        case this.ASSET_TYPES.STOCK:
        case this.ASSET_TYPES.ETF:
          // Medium volatility for stocks
          trendFactor *= 1;
          randomFactor *= 1;
          break;
        case this.ASSET_TYPES.COMMODITY:
          // Medium-low volatility for commodities
          trendFactor *= 0.8;
          randomFactor *= 0.8;
          break;
        case this.ASSET_TYPES.FOREX:
          // Low volatility for forex
          trendFactor *= 0.3;
          randomFactor *= 0.3;
          break;
        case this.ASSET_TYPES.BOND:
          // Very low volatility for bonds
          trendFactor *= 0.2;
          randomFactor *= 0.1;
          break;
      }
      
      const price = basePrice * (1 + trendFactor + randomFactor);
      
      result.push({ timestamp, price });
    }
    
    return result;
  }

  /**
   * Get all available assets by type
   * @param type Asset type (optional)
   * @returns Array of asset symbols
   */
  public getAvailableAssets(type?: string): string[] {
    if (!type) {
      return Object.keys(this.mockPrices);
    }
    
    return Object.entries(this.mockPrices)
      .filter(([_, data]) => data.type === type)
      .map(([symbol, _]) => symbol);
  }

  /**
   * Check if oracle is using mock data
   */
  public isUsingMockData(): boolean {
    return this.useMockData;
  }

  /**
   * Get available asset types
   */
  public getAssetTypes(): string[] {
    return Object.values(this.ASSET_TYPES);
  }
}

export default OracleService.getInstance(); 