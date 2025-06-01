"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { tokenApi, CollateralRecord } from "@/services/api.service";
import { Shield, Info, Database, AlertCircle, History, TrendingUp, TrendingDown } from "lucide-react";

interface CollateralDisplayProps {
  tokenId: string;
}

export function CollateralDisplay({ tokenId }: CollateralDisplayProps) {
  const [collateralRecords, setCollateralRecords] = useState<CollateralRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [dataFetched, setDataFetched] = useState<boolean>(false);

  useEffect(() => {
    const fetchCollateralRecords = async () => {
      if (!tokenId || !expanded) return;
      
      try {
        setLoading(true);
        setError(null);
        const result = await tokenApi.getCollateralRecords(tokenId);
        setCollateralRecords(result);
        setDataFetched(true);
        
      } catch (err) {
        console.error("Error fetching collateral records:", err);
        setError(err instanceof Error ? err.message : "Failed to load collateral information");
        setDataFetched(false);
      } finally {
        setLoading(false);
      }
    };

    if (expanded) {
      fetchCollateralRecords();
    }
  }, [tokenId, expanded]);

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Format timestamp to a readable format
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Calculate total collateral amount per asset type
  const calculateTotalCollateral = () => {
    if (collateralRecords.length === 0) return [];
    
    const totals: Record<string, { label: string; amount: number }> = {};
    
    collateralRecords.forEach(record => {
      record.assets.forEach(asset => {
        if (!totals[asset.assetId]) {
          totals[asset.assetId] = { label: asset.label, amount: 0 };
        }
        totals[asset.assetId].amount += asset.amount;
      });
    });
    
    return Object.values(totals);
  };

  const totalCollateral = calculateTotalCollateral();

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <Shield className="h-5 w-5 mr-2 text-green-600" />
          Collateral Information
        </h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={toggleExpanded}
        >
          {expanded ? "Hide Details" : "Show Details"}
        </Button>
      </div>
      
      {!expanded ? (
        <div className="text-sm text-gray-600 flex items-center">
          <Info className="h-4 w-4 mr-2 text-blue-600" />
          Click "Show Details" to view the collateral backing this token
        </div>
      ) : loading ? (
        <div className="text-center py-4">
          <div className="animate-pulse text-gray-500">Loading collateral information...</div>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : collateralRecords.length === 0 ? (
        <div className="text-center py-4 text-sm text-gray-600">
          No collateral records found for this token.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Total Collateral Summary */}
          <Card className="p-4 bg-green-50 border-green-100">
            <div className="flex items-center mb-2">
              <Database className="h-4 w-4 mr-2 text-green-600" />
              <h3 className="text-md font-semibold text-green-800">Total Collateral</h3>
            </div>
            <div className="space-y-2">
              {totalCollateral.map((asset, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="font-medium">{asset.label}</span>
                  <span>{asset.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </Card>
          
          {/* Collateral Records Timeline */}
          <h3 className="text-md font-semibold mt-4 mb-2">Collateral History</h3>
          <div className="space-y-3">
            {collateralRecords.map((record, index) => (
              <Card key={index} className="p-3 border border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="text-sm font-semibold">Transaction {index + 1}</h4>
                    <p className="text-xs text-gray-500">{formatDate(record.timestamp)}</p>
                  </div>
                  {record.transactionId && (
                    <div className="text-xs text-gray-500">
                      <span className="font-mono">TX: {record.transactionId.substring(0, 8)}...</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  {record.assets.map((asset, assetIndex) => (
                    <div key={assetIndex} className="flex justify-between">
                      <span>{asset.label}</span>
                      <span className="font-medium">{asset.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          
          <div className="text-xs text-gray-500 mt-2">
            <p>All tokens are fully backed by collateral assets held in the treasury account.</p>
            <p>This ensures the value and stability of the token.</p>
          </div>
        </div>
      )}
    </div>
  );
} 