import { useState, useEffect } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { oracleApi } from "@/services/oracle.service";

// Asset categories and items
const assetCategories = [
  {
    name: "Cryptocurrencies",
    assets: [
      { value: "bitcoin", label: "Bitcoin (BTC)" },
      { value: "ethereum", label: "Ethereum (ETH)" },
      { value: "cardano", label: "Cardano (ADA)" },
      { value: "solana", label: "Solana (SOL)" },
      { value: "polkadot", label: "Polkadot (DOT)" },
      { value: "avalanche", label: "Avalanche (AVAX)" },
      { value: "chainlink", label: "Chainlink (LINK)" },
      { value: "polygon", label: "Polygon (MATIC)" },
      { value: "uniswap", label: "Uniswap (UNI)" },
      { value: "aave", label: "Aave (AAVE)" },
    ]
  },
  {
    name: "Stocks",
    assets: [
      { value: "aapl", label: "Apple Inc. (AAPL)" },
      { value: "msft", label: "Microsoft Corp. (MSFT)" },
      { value: "googl", label: "Alphabet Inc. (GOOGL)" },
      { value: "amzn", label: "Amazon.com Inc. (AMZN)" },
      { value: "nvda", label: "NVIDIA Corp. (NVDA)" },
      { value: "meta", label: "Meta Platforms Inc. (META)" },
      { value: "tsla", label: "Tesla Inc. (TSLA)" },
      { value: "brk.a", label: "Berkshire Hathaway (BRK.A)" },
      { value: "v", label: "Visa Inc. (V)" },
      { value: "jnj", label: "Johnson & Johnson (JNJ)" },
      { value: "wmt", label: "Walmart Inc. (WMT)" },
      { value: "pg", label: "Procter & Gamble (PG)" },
      { value: "dis", label: "Walt Disney Co. (DIS)" },
      { value: "ko", label: "Coca-Cola Co. (KO)" },
      { value: "nke", label: "Nike Inc. (NKE)" },
    ]
  },
  {
    name: "Commodities",
    assets: [
      { value: "gold", label: "Gold (XAU)" },
      { value: "silver", label: "Silver (XAG)" },
      { value: "oil", label: "Crude Oil (WTI)" },
      { value: "natgas", label: "Natural Gas (NG)" },
      { value: "copper", label: "Copper (HG)" },
    ]
  }
];

// Flatten asset list for backward compatibility
const allAssets = assetCategories.flatMap(category => category.assets);

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

export interface Asset {
  value: string;
  label: string;
  allocation?: number;
}

interface AssetSelectorProps {
  onSelect: (asset: Asset) => void;
  selectedAssets: Asset[];
}

export function AssetSelector({ onSelect, selectedAssets }: AssetSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [assetPrices, setAssetPrices] = useState<{[key: string]: number}>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  
  // Get all available assets (not already selected)
  const selectedAssetValues = selectedAssets.map(asset => asset.value);

  // Fetch prices for visible assets
  useEffect(() => {
    const fetchPrices = async () => {
      // Get all assets that are currently visible (not selected and match search)
      const visibleAssets = allAssets
        .filter(asset => 
          !selectedAssetValues.includes(asset.value) &&
          asset.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .map(asset => {
          // Convert asset value to symbol format for API
          const symbol = getOracleSymbol(asset.value);
          return symbol;
        });

      if (visibleAssets.length === 0) return;

      try {
        setLoadingPrices(true);
        const result = await oracleApi.getPrices(visibleAssets);
        setAssetPrices(result.prices);
      } catch (error) {
        console.error('Error fetching asset prices:', error);
        // Continue without prices
      } finally {
        setLoadingPrices(false);
      }
    };

    if (open) {
      fetchPrices();
    }
  }, [open, searchTerm, selectedAssetValues]);

  const formatPrice = (price: number, symbol: string): string => {
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedAssets.length === allAssets.length 
            ? "All assets selected" 
            : "Select asset..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-4" align="start">
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search assets..."
            className="w-full p-2 border rounded-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          {loadingPrices && (
            <div className="text-center text-xs text-gray-500">Loading prices...</div>
          )}
          
          <div className="max-h-[300px] overflow-y-auto space-y-4">
            {assetCategories.map((category) => {
              // Filter assets in this category that are not selected and match search term
              const filteredAssets = category.assets.filter(
                (asset) => 
                  !selectedAssetValues.includes(asset.value) &&
                  asset.label.toLowerCase().includes(searchTerm.toLowerCase())
              );
              
              // Don't show category if it has no matching assets
              if (filteredAssets.length === 0) return null;
              
              return (
                <div key={category.name} className="space-y-2">
                  <h3 className="text-sm font-medium text-slate-700">{category.name}</h3>
                  <div className="space-y-1 pl-2">
                    {filteredAssets.map((asset) => {
                      const price = getAssetPrice(asset.value);
                      return (
                        <div 
                          key={asset.value} 
                          className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-md cursor-pointer"
                          onClick={() => {
                            onSelect(asset);
                            setOpen(false);
                            setSearchTerm("");
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm">{asset.label}</span>
                            {price && (
                              <span className="text-xs text-green-600 font-mono">
                                {formatPrice(price, asset.value)}
                              </span>
                            )}
                          </div>
                          <Plus className="h-4 w-4 text-slate-400" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {assetCategories.every(category => 
              category.assets.every(asset => 
                selectedAssetValues.includes(asset.value) || 
                !asset.label.toLowerCase().includes(searchTerm.toLowerCase())
              )
            ) && (
              <div className="text-center py-2 text-slate-500">
                {searchTerm ? "No matching assets found" : "All assets have been selected"}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
} 