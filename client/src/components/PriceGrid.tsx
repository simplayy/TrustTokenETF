import { useState, useEffect } from 'react';
import { PriceCard } from './PriceCard';
import { oracleApi } from '@/services/oracle.service';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

interface PriceGridProps {
  assets?: string[];
  columns?: number;
  refreshInterval?: number;
  filterByType?: boolean;
}

export function PriceGrid({ 
  assets, 
  columns = 3, 
  refreshInterval = 60000,
  filterByType = true
}: PriceGridProps) {
  const [assetsList, setAssetsList] = useState<string[]>(assets || []);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [loading, setLoading] = useState(!assets);
  const [error, setError] = useState<string | null>(null);
  const [assetsByType, setAssetsByType] = useState<Record<string, string[]>>({});

  // Fetch available assets if not provided
  useEffect(() => {
    const fetchAssets = async () => {
      if (assets) {
        setAssetsList(assets);
        return;
      }

      try {
        setLoading(true);
        const data = await oracleApi.getAvailableAssets();
        setAssetsList(data.assets);
        setAvailableTypes(data.availableTypes);
        setError(null);
        
        // Group assets by type
        const assetGroups: Record<string, string[]> = {};
        
        // Initialize with empty arrays for each type
        data.availableTypes.forEach(type => {
          assetGroups[type] = [];
        });
        
        // Get prices for all assets to determine their types
        const pricesData = await oracleApi.getPrices(data.assets);
        
        // Group assets by their type
        Object.entries(pricesData.assetTypes).forEach(([asset, type]) => {
          if (assetGroups[type]) {
            assetGroups[type].push(asset);
          }
        });
        
        setAssetsByType(assetGroups);
      } catch (err: any) {
        console.error('Error fetching available assets:', err);
        setError(err.message || 'Failed to fetch assets');
        setAssetsList([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, [assets]);

  // Use fixed Tailwind classes instead of dynamically generating column names
  let gridColsClass = "grid-cols-1 sm:grid-cols-2";
  
  if (columns === 3) {
    gridColsClass = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
  } else if (columns === 4) {
    gridColsClass = "grid-cols-1 sm:grid-cols-2 md:grid-cols-4";
  } else if (columns > 4) {
    gridColsClass = "grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5";
  }

  // Get assets for the selected type
  const getAssetsForType = (type: string): string[] => {
    if (type === 'all') {
      return assetsList;
    }
    return assetsByType[type] || [];
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <div className={`grid ${gridColsClass} gap-4`}>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive">{error}</div>;
  }

  if (assetsList.length === 0) {
    return <div className="text-muted-foreground">No assets available</div>;
  }

  return (
    <div className="space-y-4">
      {filterByType && availableTypes.length > 0 && (
        <Tabs defaultValue="all" value={selectedType} onValueChange={setSelectedType}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {availableTypes.map(type => (
              <TabsTrigger key={type} value={type}>{type}</TabsTrigger>
            ))}
          </TabsList>
          
          <TabsContent value={selectedType}>
            <div className={`grid ${gridColsClass} gap-4`}>
              {getAssetsForType(selectedType).map(asset => (
                <PriceCard 
                  key={asset} 
                  asset={asset} 
                  refreshInterval={refreshInterval} 
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
      
      {(!filterByType || availableTypes.length === 0) && (
        <div className={`grid ${gridColsClass} gap-4`}>
          {assetsList.map(asset => (
            <PriceCard 
              key={asset} 
              asset={asset} 
              refreshInterval={refreshInterval} 
            />
          ))}
        </div>
      )}
    </div>
  );
} 