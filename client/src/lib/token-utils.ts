/**
 * Utility functions for token calculations and display
 */

export interface TokenPricingInfo {
  pricePerToken: number;
  pricePerShare: number;
  shareRatio: number;
  displayFormat: 'unit' | 'share';
  recommendedMinInvestment: number;
}

/**
 * Calculate smart token pricing to make tokens accessible
 * This function automatically scales tokens to be in a reasonable price range
 */
export function calculateSmartTokenPricing(
  assetComposition: Array<{value: string, allocation: number}>,
  assetPrices: {[key: string]: number}
): TokenPricingInfo {
  // Calculate raw basket value (1 unit of each asset according to allocation)
  let rawBasketValue = 0;
  
  assetComposition.forEach(asset => {
    const price = assetPrices[asset.value] || 0;
    const allocation = asset.allocation || 0;
    rawBasketValue += (price * allocation / 100);
  });

  // If basket value is too high (> $100), use share-based approach
  if (rawBasketValue > 100) {
    // Calculate how many shares to represent $1 worth of assets
    const shareRatio = rawBasketValue; // 1 token = 1/shareRatio of the basket
    const pricePerShare = 1.0; // Each share represents $1 worth
    
    return {
      pricePerToken: rawBasketValue,
      pricePerShare: pricePerShare,
      shareRatio: shareRatio,
      displayFormat: 'share',
      recommendedMinInvestment: 1.0 // $1 minimum
    };
  } else {
    // Use unit-based approach for reasonably priced baskets
    return {
      pricePerToken: rawBasketValue,
      pricePerShare: rawBasketValue,
      shareRatio: 1,
      displayFormat: 'unit',
      recommendedMinInvestment: Math.max(0.01, rawBasketValue * 0.001) // 0.1% of basket or $0.01
    };
  }
}

/**
 * Format token amount for display based on the pricing strategy
 */
export function formatTokenAmount(
  amount: number, 
  pricingInfo: TokenPricingInfo,
  precision: number = 6
): string {
  if (pricingInfo.displayFormat === 'share') {
    // For share-based tokens, show as shares with appropriate precision
    if (amount >= 1) {
      return `${amount.toFixed(2)} shares`;
    } else {
      return `${amount.toFixed(precision)} shares`;
    }
  } else {
    // For unit-based tokens, show as tokens
    if (amount >= 1) {
      return `${amount.toFixed(2)} tokens`;
    } else {
      return `${amount.toFixed(precision)} tokens`;
    }
  }
}

/**
 * Calculate USD value for a given token amount
 */
export function calculateUsdValue(
  tokenAmount: number,
  pricingInfo: TokenPricingInfo
): number {
  if (pricingInfo.displayFormat === 'share') {
    return tokenAmount * pricingInfo.pricePerShare;
  } else {
    return tokenAmount * pricingInfo.pricePerToken;
  }
}

/**
 * Calculate token amount for a given USD value
 */
export function calculateTokensForUsd(
  usdAmount: number,
  pricingInfo: TokenPricingInfo
): number {
  if (pricingInfo.displayFormat === 'share') {
    return usdAmount / pricingInfo.pricePerShare;
  } else {
    return usdAmount / pricingInfo.pricePerToken;
  }
}

/**
 * Get smart default amount for minting based on pricing
 */
export function getSmartDefaultAmount(pricingInfo: TokenPricingInfo): number {
  if (pricingInfo.displayFormat === 'share') {
    return 10; // 10 shares = $10
  } else {
    // For unit-based, start with a reasonable fraction
    return Math.max(0.000001, pricingInfo.recommendedMinInvestment);
  }
}

/**
 * Get quick amount options for UI buttons
 */
export function getQuickAmountOptions(pricingInfo: TokenPricingInfo): Array<{usd: number, tokens: number}> {
  const usdAmounts = [1, 5, 10, 25, 50, 100];
  
  return usdAmounts.map(usd => ({
    usd,
    tokens: calculateTokensForUsd(usd, pricingInfo)
  }));
} 