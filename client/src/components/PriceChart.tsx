import { useState, useEffect } from 'react';
import { oracleApi, HistoricalPriceData } from '@/services/oracle.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface PriceChartProps {
  asset: string;
  days?: number;
  height?: number;
}

export function PriceChart({ asset, days = 7, height = 300 }: PriceChartProps) {
  const [priceData, setPriceData] = useState<HistoricalPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistoricalPrices = async () => {
      try {
        setLoading(true);
        const data = await oracleApi.getHistoricalPrices(asset, days);
        setPriceData(data);
        setError(null);
      } catch (err: any) {
        console.error(`Error fetching historical prices for ${asset}:`, err);
        setError(err.message || 'Failed to fetch historical prices');
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalPrices();
  }, [asset, days]);

  // Format data for chart
  const formatChartData = () => {
    if (!priceData?.priceData) return [];
    
    return priceData.priceData.map(point => ({
      date: new Date(point.timestamp).toLocaleDateString(),
      time: new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: point.timestamp,
      price: point.price
    }));
  };

  // Calculate min and max for Y axis
  const calculateYDomain = () => {
    if (!priceData?.priceData || priceData.priceData.length === 0) return [0, 1];
    
    const prices = priceData.priceData.map(point => point.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    
    // Add 5% padding to top and bottom
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding];
  };

  // Format price for tooltip
  const formatPrice = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border p-2 rounded-md shadow-md">
          <p className="text-sm font-medium">{`${data.date} ${data.time}`}</p>
          <p className="text-sm text-primary">{`Price: ${formatPrice(data.price)}`}</p>
        </div>
      );
    }
    return null;
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

  // Get line color based on asset type
  const getLineColor = (assetType: string) => {
    switch (assetType) {
      case 'crypto':
        return '#f97316'; // orange-500
      case 'stock':
        return '#3b82f6'; // blue-500
      case 'commodity':
        return '#eab308'; // yellow-500
      case 'forex':
        return '#22c55e'; // green-500
      case 'etf':
        return '#a855f7'; // purple-500
      case 'bond':
        return '#6b7280'; // gray-500
      default:
        return '#3b82f6'; // blue-500 (default)
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/20 pb-2">
        <CardTitle className="text-lg font-medium flex items-center justify-between">
          <span>{asset} Price History ({days} days)</span>
          {priceData?.assetType && (
            <Badge className={getAssetTypeColor(priceData.assetType)}>
              {priceData.assetType}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : error ? (
          <div className="text-destructive text-sm h-[300px] flex items-center justify-center">
            {error}
          </div>
        ) : priceData ? (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height={height}>
              <LineChart
                data={formatChartData()}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#444" opacity={0.1} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    // Show fewer ticks for better readability
                    const date = new Date(value);
                    return date.getDate() + '/' + (date.getMonth() + 1);
                  }}
                />
                <YAxis 
                  domain={calculateYDomain()}
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatPrice}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={priceData.assetType ? getLineColor(priceData.assetType) : "#3b82f6"}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                {/* Reference line for current price */}
                {priceData.priceData.length > 0 && (
                  <ReferenceLine 
                    y={priceData.priceData[priceData.priceData.length - 1].price} 
                    stroke={priceData.assetType ? getLineColor(priceData.assetType) : "#3b82f6"}
                    strokeDasharray="3 3"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
} 