import { useState, useEffect } from 'react';
import { oracleApi, TokenPriceData } from '@/services/oracle.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface TokenPriceCardProps {
  tokenId: string;
  tokenName?: string;
  tokenSymbol?: string;
  refreshInterval?: number; // in milliseconds
}

export function TokenPriceCard({ 
  tokenId, 
  tokenName, 
  tokenSymbol, 
  refreshInterval = 60000 
}: TokenPriceCardProps) {
  const [priceData, setPriceData] = useState<TokenPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        setLoading(true);
        const data = await oracleApi.getTokenPrice(tokenId);
        setPriceData(data);
        setError(null);
      } catch (err: any) {
        console.error(`Error fetching price for token ${tokenId}:`, err);
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
  }, [tokenId, refreshInterval]);

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

  // Display name based on available info
  const displayName = tokenSymbol || tokenName || tokenId;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/20 pb-2">
        <CardTitle className="text-lg font-medium flex items-center justify-between">
          <span>{displayName}</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Token
            </Badge>
            <span className="text-xs text-muted-foreground">{tokenId}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : error ? (
          <div className="text-destructive text-sm">{error}</div>
        ) : priceData ? (
          <div className="space-y-1">
            <div className="text-2xl font-bold">
              ${formatPrice(priceData.price)}
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