/**
 * Shared utility function to map asset names to oracle symbols
 * This ensures consistency between frontend and backend calculations
 */
export const mapAssetNameToSymbol = (assetName: string): string => {
  const mapping: Record<string, string> = {
    // Crypto mappings
    'bitcoin': 'BTC',
    'ethereum': 'ETH', 
    'hedera': 'HBAR',
    'polygon': 'MATIC',
    'solana': 'SOL',
    'cardano': 'ADA',
    'polkadot': 'DOT',
    'avalanche': 'AVAX',
    'chainlink': 'LINK',
    'uniswap': 'UNI',
    'aave': 'AAVE',
    
    // Stock mappings (keep uppercase)
    'v': 'V',
    'apple': 'AAPL',
    'microsoft': 'MSFT',
    'amazon': 'AMZN',
    'googl': 'GOOGL',
    'google': 'GOOGL',
    'meta': 'META',
    'tesla': 'TSLA',
    'nvidia': 'NVDA',
    'berkshire': 'BRK-A',
    'johnson': 'JNJ',
    'walmart': 'WMT',
    'disney': 'DIS',
    'coca-cola': 'KO',
    'nike': 'NKE',
    'jpmorgan': 'JPM',
    
    // Commodities mappings
    'gold': 'GOLD',
    'silver': 'SILVER',
    'oil': 'OIL',
    'natgas': 'NATGAS',
    'copper': 'COPPER'
  };
  
  return mapping[assetName.toLowerCase()] || assetName.toUpperCase().replace(/\./g, '-');
};

/**
 * Calculate token price based on composition and current asset prices
 * This uses the same logic as the backend to ensure consistency
 */
export const calculateTokenPrice = (composition: Array<{value: string, allocation?: number}>, assetPrices: Record<string, number>): number => {
  let tokenPrice = 0;
  
  composition.forEach(asset => {
    const symbol = mapAssetNameToSymbol(asset.value);
    const price = assetPrices[symbol];
    const allocation = asset.allocation || 0;
    
    if (price && allocation > 0) {
      // Each token represents 1 unit of the basket (same logic as backend)
      const assetValue = (price * allocation / 100);
      tokenPrice += assetValue;
    }
  });
  
  return tokenPrice;
}; 