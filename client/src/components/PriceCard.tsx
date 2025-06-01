import { useState, useEffect } from 'react';
import { oracleApi, PriceData } from '@/services/oracle.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';
import { Badge } from '@/components/ui/badge';

interface PriceCardProps {
  asset: string;
  refreshInterval?: number; // in milliseconds
}

export function PriceCard({ asset, refreshInterval = 60000 }: PriceCardProps) {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceChange, setPriceChange] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        setLoading(true);
        const oldPrice = priceData?.price;
        const data = await oracleApi.getPrice(asset);
        setPriceData(data);
        
        // Determine if price went up or down for animation
        if (oldPrice && data.price !== oldPrice) {
          setPriceChange(data.price > oldPrice ? 'up' : 'down');
          // Reset after animation
          setTimeout(() => setPriceChange(null), 2000);
        }
        
        setError(null);
      } catch (err: any) {
        console.error(`Error fetching price for ${asset}:`, err);
        setError(err.message || 'Failed to fetch price');
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchPrice();
    
    // Set up interval for refresh
    const intervalId = setInterval(fetchPrice, refreshInterval);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [asset, refreshInterval]);

  // Format price with appropriate decimal places
  const formatPrice = (price: number) => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (price >= 1) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    } else {
      return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
    }
  };

  // Format timestamp to local time
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Get color for asset type badge
  const getAssetTypeColor = (assetType: string) => {
    switch (assetType) {
      case 'crypto':
        return 'bg-orange-500 hover:bg-orange-600';
      case 'stock':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'commodity':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'forex':
        return 'bg-green-500 hover:bg-green-600';
      case 'etf':
        return 'bg-purple-500 hover:bg-purple-600';
      case 'bond':
        return 'bg-gray-500 hover:bg-gray-600';
      default:
        return 'bg-slate-500 hover:bg-slate-600';
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/20 pb-2">
        <CardTitle className="text-lg font-medium flex items-center justify-between">
          <span>{asset}</span>
          {priceData?.assetType && (
            <Badge className={getAssetTypeColor(priceData.assetType)}>
              {priceData.assetType}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {loading && !priceData ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : error ? (
          <div className="text-destructive text-sm">{error}</div>
        ) : priceData ? (
          <div className="space-y-1">
            <div className="flex items-baseline">
              <span className={`text-2xl font-bold ${
                priceChange === 'up' ? 'text-green-500' : 
                priceChange === 'down' ? 'text-red-500' : ''
              }`}>
                ${formatPrice(priceData.price)}
              </span>
              {priceChange === 'up' && (
                <ArrowUpIcon className="h-4 w-4 text-green-500 ml-1" />
              )}
              {priceChange === 'down' && (
                <ArrowDownIcon className="h-4 w-4 text-red-500 ml-1" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Updated: {formatTimestamp(priceData.timestamp)}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
} 