import React, { useState, useEffect } from "react";
import { Asset } from "./asset-selector";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { oracleApi } from "@/services/oracle.service";

// Function to convert asset value to the correct symbol for the oracle API
const getOracleSymbol = (assetValue: string): string => {
  const symbolMap: { [key: string]: string } = {
    // Cryptocurrencies
    'bitcoin': 'BTC',
    'ethereum': 'ETH', 
    'cardano': 'ADA',
    'solana': 'SOL',
    'polkadot': 'DOT',
    'avalanche': 'AVAX',
    'chainlink': 'LINK',
    'polygon': 'MATIC',
    'uniswap': 'UNI',
    'aave': 'AAVE',
    
    // Stocks (these are already correct)
    'aapl': 'AAPL',
    'msft': 'MSFT',
    'googl': 'GOOGL',
    'amzn': 'AMZN',
    'nvda': 'NVDA',
    'meta': 'META',
    'tsla': 'TSLA',
    'brk.a': 'BRK-A',
    'v': 'V',
    'jnj': 'JNJ',
    'wmt': 'WMT',
    'pg': 'PG',
    'dis': 'DIS',
    'ko': 'KO',
    'nke': 'NKE',
    
    // Commodities
    'gold': 'GOLD',
    'silver': 'SILVER',
    'oil': 'OIL',
    'natgas': 'NATGAS',
    'copper': 'COPPER'
  };
  
  return symbolMap[assetValue.toLowerCase()] || assetValue.toUpperCase().replace(/\./g, '-');
};

// Helper function to determine asset type based on value
function getAssetCategory(assetValue: string): string {
  // Crypto assets
  if (["bitcoin", "ethereum", "cardano", "solana", "polkadot", "avalanche", 
       "chainlink", "polygon", "uniswap", "aave"].includes(assetValue)) {
    return "Crypto";
  }
  
  // Stock assets
  if (["aapl", "msft", "googl", "amzn", "nvda", "meta", "tsla", "brk.a", 
       "v", "jnj", "wmt", "pg", "dis", "ko", "nke"].includes(assetValue)) {
    return "Stock";
  }
  
  // Commodity assets
  if (["gold", "silver", "oil", "natgas", "copper"].includes(assetValue)) {
    return "Commodity";
  }
  
  return "Other";
}

// Color mapping for asset categories
const categoryColors: Record<string, string> = {
  Crypto: "bg-blue-100 text-blue-800",
  Stock: "bg-green-100 text-green-800",
  Commodity: "bg-yellow-100 text-yellow-800",
  Other: "bg-gray-100 text-gray-800"
};

interface PercentageAllocationProps {
  assets: Asset[];
  onUpdate: (assets: Asset[]) => void;
  onRemove: (assetValue: string) => void;
}

export function PercentageAllocation({
  assets,
  onUpdate,
  onRemove,
}: PercentageAllocationProps) {
  const [assetPrices, setAssetPrices] = useState<{[key: string]: number}>({});
  const [loadingPrices, setLoadingPrices] = useState(false);

  const totalAllocation = assets.reduce(
    (sum, asset) => sum + (asset.allocation || 0),
    0
  );

  const isValid = totalAllocation === 100;

  // Fetch prices for selected assets
  useEffect(() => {
    const fetchPrices = async () => {
      if (assets.length === 0) {
        setAssetPrices({});
        return;
      }

      try {
        setLoadingPrices(true);
        const symbols = assets.map(asset => getOracleSymbol(asset.value));
        const result = await oracleApi.getPrices(symbols);
        setAssetPrices(result.prices);
      } catch (error) {
        console.error('Error fetching asset prices:', error);
      } finally {
        setLoadingPrices(false);
      }
    };

    fetchPrices();
    
    // Refresh prices every 2 minutes
    const interval = setInterval(fetchPrices, 120000);
    return () => clearInterval(interval);
  }, [assets]);

  const handleAllocationChange = (value: string, assetValue: string) => {
    const newAllocation = parseInt(value) || 0;
    
    const updatedAssets = assets.map((asset) => {
      if (asset.value === assetValue) {
        return { ...asset, allocation: newAllocation };
      }
      return asset;
    });
    
    onUpdate(updatedAssets);
  };

  // Automatically distribute percentages evenly
  const distributeEvenly = () => {
    if (assets.length === 0) return;
    
    const evenPercentage = Math.floor(100 / assets.length);
    const remainder = 100 - (evenPercentage * assets.length);
    
    const updatedAssets = assets.map((asset, index) => ({
      ...asset,
      allocation: evenPercentage + (index === 0 ? remainder : 0)
    }));
    
    onUpdate(updatedAssets);
  };

  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return `$${price.toLocaleString()}`;
    } else if (price >= 1) {
      return `$${price.toFixed(2)}`;
    } else {
      return `$${price.toFixed(4)}`;
    }
  };

  const getAssetPrice = (assetValue: string): number | null => {
    const symbol = getOracleSymbol(assetValue);
    return assetPrices[symbol] || null;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Asset Allocation</h3>
        <div className="flex items-center gap-4">
          {loadingPrices && (
            <span className="text-xs text-gray-500">Updating prices...</span>
          )}
          <div 
            className={cn(
              "text-sm font-medium",
              isValid ? "text-green-600" : "text-red-600"
            )}
          >
            Total: {totalAllocation}%
            {!isValid && (
              <span className="ml-2">
                (Must equal 100%)
              </span>
            )}
          </div>
        </div>
      </div>

      {assets.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={distributeEvenly}
            type="button"
          >
            Distribute Evenly
          </Button>
        </div>
      )}
      
      <div className="space-y-2">
        {assets.map((asset) => {
          const category = getAssetCategory(asset.value);
          const categoryColor = categoryColors[category];
          const price = getAssetPrice(asset.value);
          
          return (
            <div 
              key={asset.value} 
              className="flex items-center gap-3 p-3 border rounded-md bg-slate-50"
            >
              <div className="flex-grow">
                <div className="font-medium">{asset.label}</div>
                <div className="text-xs mt-1 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full ${categoryColor}`}>
                    {category}
                  </span>
                  {price && (
                    <span className="text-green-600 font-mono">
                      {formatPrice(price)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={asset.allocation || ""}
                  onChange={(e) => handleAllocationChange(e.target.value, asset.value)}
                  className="w-16 px-2 py-1 border rounded text-right"
                />
                <span className="ml-1">%</span>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onRemove(asset.value)}
                className="h-8 w-8"
                type="button"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove</span>
              </Button>
            </div>
          );
        })}
        
        {assets.length === 0 && (
          <div className="text-center py-6 text-slate-500">
            Select assets to add to your ETF
          </div>
        )}
      </div>
    </div>
  );
} 