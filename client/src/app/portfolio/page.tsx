"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { portfolioApi, PortfolioHolding, hederaApi, TokenInfo } from "@/services/api.service";
import { oracleApi } from "@/services/oracle.service";
import { mapAssetNameToSymbol } from "@/utils/asset-mapping";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Briefcase, ArrowUpRight, LayoutDashboard, Coins, TrendingUp } from "lucide-react";

// Interface for account balance information
interface AccountBalance {
  accountId: string;
  balance: string;
  network: string;
}

// Enhanced holding with value calculation
interface EnhancedHolding extends PortfolioHolding {
  portfolioValue?: number;
  loadingValue?: boolean;
}

export default function PortfolioPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<EnhancedHolding[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<AccountBalance | null>(null);
  const [treasuryInfo, setTreasuryInfo] = useState<AccountBalance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(true);
  const [hbarPrice, setHbarPrice] = useState<number | null>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await portfolioApi.getPortfolio();
        const enhancedHoldings = result.holdings.map((holding: PortfolioHolding) => ({
          ...holding,
          portfolioValue: undefined,
          loadingValue: true
        }));
        setHoldings(enhancedHoldings);
        
        // Calculate portfolio values
        calculatePortfolioValues(enhancedHoldings);
      } catch (err) {
        console.error("Error fetching portfolio:", err);
        setError(err instanceof Error ? err.message : "Failed to load portfolio");
      } finally {
        setLoading(false);
      }
    };

    const fetchAccountInfo = async () => {
      try {
        setLoadingBalance(true);
        const result = await hederaApi.getAccountInfo();
        if (result.success) {
          if (result.accountInfo) {
            setAccountInfo(result.accountInfo);
          }
          if (result.treasuryInfo) {
            setTreasuryInfo(result.treasuryInfo);
          }
        }
      } catch (err) {
        console.error("Error fetching account info:", err);
        // Don't set error state here to avoid blocking the portfolio display
      } finally {
        setLoadingBalance(false);
      }
    };

    const fetchHbarPrice = async () => {
      try {
        const priceData = await oracleApi.getHbarPrice();
        setHbarPrice(priceData.price);
      } catch (err) {
        console.error("Error fetching HBAR price:", err);
        
        // Show user-friendly error message for rate limiting
        if (oracleApi.isRateLimitError(err)) {
          console.warn("Rate limited while fetching HBAR price. Using cached/fallback data if available.");
          // Try to get debug info to see if we have cached data
          try {
            const debugInfo = await oracleApi.getDebugInfo();
            if (debugInfo.hedera?.hasCachedHbarPrice) {
              console.log("Using cached HBAR price data");
            }
          } catch (debugErr) {
            console.error("Could not get debug info:", debugErr);
          }
        }
      }
    };

    fetchPortfolio();
    fetchAccountInfo();
    fetchHbarPrice();
    
    // Refresh HBAR price every 2 minutes
    const priceInterval = setInterval(fetchHbarPrice, 120000);
    return () => clearInterval(priceInterval);
  }, []);

  // Calculate portfolio value for each holding
  const calculatePortfolioValues = async (holdingsList: EnhancedHolding[]) => {
    // First, show tokens immediately without values
    setHoldings(holdingsList.map(h => ({ ...h, loadingValue: true })));
    
    // Collect all unique asset symbols from all tokens using correct mapping
    const allSymbols = new Set<string>();
    holdingsList.forEach(holding => {
      if (holding.tokenInfo?.composition) {
        holding.tokenInfo.composition.forEach(asset => {
          allSymbols.add(mapAssetNameToSymbol(asset.value));
        });
      }
    });
    
    // Fetch all prices at once
    let allPrices: {[key: string]: number} = {};
    if (allSymbols.size > 0) {
      try {
        console.log(`Fetching prices for ${allSymbols.size} unique assets:`, Array.from(allSymbols));
        const pricesResult = await oracleApi.getPrices(Array.from(allSymbols));
        allPrices = pricesResult.prices;
      } catch (error) {
        console.error('Error fetching bulk prices:', error);
      }
    }
    
    // Calculate values for all holdings in parallel
    const valuePromises = holdingsList.map(async (holding) => {
      try {
        if (holding.tokenInfo?.composition && holding.tokenInfo.composition.length > 0) {
          let holdingValue = 0;
          // Use proper decimals from token info, default to 6 if not available
          const decimals = holding.tokenInfo.decimals || 6;
          const tokenBalance = (holding.balance || 0) / Math.pow(10, decimals); // Convert from tinybars to actual tokens using correct decimals
          
          holding.tokenInfo.composition.forEach(asset => {
            const symbol = mapAssetNameToSymbol(asset.value);
            const price = allPrices[symbol];
            const allocation = asset.allocation || 0;
            
            if (price && allocation > 0 && tokenBalance > 0) {
              // Calculate value using EXACT SAME logic as backend: token_balance * asset_price * allocation_percentage
              const assetValue = (tokenBalance * price * allocation / 100);
              holdingValue += assetValue;
            }
          });
          
          return { tokenId: holding.tokenId, value: holdingValue };
        }
        return { tokenId: holding.tokenId, value: undefined };
      } catch (error) {
        console.error(`Error calculating value for holding ${holding.tokenId}:`, error);
        return { tokenId: holding.tokenId, value: undefined };
      }
    });
    
    // Wait for all calculations and update holdings
    const results = await Promise.all(valuePromises);
    
    setHoldings(prevHoldings => 
      prevHoldings.map(h => {
        const result = results.find(r => r.tokenId === h.tokenId);
        return {
          ...h,
          portfolioValue: result?.value,
          loadingValue: false
        };
      })
    );
  };

  // Format token balance with proper decimals
  const formatTokenBalance = (balance: number, tokenInfo?: TokenInfo): number => {
    // Use proper decimals from token info, default to 6 if not available
    const decimals = tokenInfo?.decimals || 6;
    return (balance || 0) / Math.pow(10, decimals);
  };

  // Format HBAR balance with proper decimals
  const formatHbarBalance = (balance: string): string => {
    try {
      // HBAR balance is typically in the format "X.Y HBAR"
      const numericPart = parseFloat(balance);
      return numericPart.toFixed(4) + " ℏ";
    } catch (e) {
      return balance;
    }
  };

  // Calculate HBAR value in USD
  const calculateHbarValue = (balance: string): number => {
    try {
      const numericPart = parseFloat(balance);
      return hbarPrice ? numericPart * hbarPrice : 0;
    } catch (e) {
      return 0;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center">
          <Briefcase className="mr-2 h-6 w-6 sm:h-8 sm:w-8" />
          My Portfolio
        </h1>
        
        <Link href="/dashboard">
          <Button variant="outline" className="flex items-center gap-2">
            <LayoutDashboard size={16} />
            Dashboard
          </Button>
        </Link>
      </div>

      {/* HBAR Balance Cards */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Coins className="mr-2 h-5 w-5" />
          Available HBAR Balance
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Account Balance Card */}
          <Card className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-blue-100">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Main Account</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {accountInfo?.accountId || "Loading..."}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Balance</p>
                <p className="text-2xl font-bold text-blue-600">
                  {loadingBalance ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    accountInfo ? formatHbarBalance(accountInfo.balance) : "N/A"
                  )}
                </p>
                {accountInfo && hbarPrice && (
                  <p className="text-xs text-blue-500 font-mono">
                    ≈${calculateHbarValue(accountInfo.balance).toFixed(2)} USD
                  </p>
                )}
              </div>
            </div>
          </Card>
          
          {/* Treasury Account Card */}
          <Card className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-100">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Treasury Account</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {treasuryInfo?.accountId || "0.0.5845721"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Balance</p>
                <p className="text-2xl font-bold text-amber-600">
                  {loadingBalance ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    treasuryInfo ? formatHbarBalance(treasuryInfo.balance) : "~1000.0000 ℏ"
                  )}
                </p>
                {treasuryInfo && hbarPrice && (
                  <p className="text-xs text-amber-500 font-mono">
                    ≈${calculateHbarValue(treasuryInfo.balance).toFixed(2)} USD
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-pulse text-gray-500">Loading your tokens...</div>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : holdings.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-gray-500 mb-4">You don't have any tokens in your portfolio yet.</div>
          <Link href="/dashboard">
            <Button>View Available Tokens</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Show message if tokens are loaded but values are still calculating */}
          {holdings.length > 0 && holdings.some(h => h.loadingValue) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-blue-700">
                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <span className="text-sm">Calculating portfolio values...</span>
              </div>
            </div>
          )}
          
          {/* Desktop table view (hidden on mobile) */}
          <div className="hidden sm:block bg-white p-4 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Your Tokens</h2>
            <div className="overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price per Token</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {holdings.map((holding) => (
                    <tr key={holding.tokenId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {holding.tokenInfo?.name || holding.tokenId}
                            </div>
                            <div className="text-sm text-gray-500">
                              {holding.tokenInfo?.symbol || "Unknown"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {formatTokenBalance(holding.balance, holding.tokenInfo).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} 
                        {holding.tokenInfo?.symbol && ` ${holding.tokenInfo.symbol}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {holding.loadingValue ? (
                          <span className="text-gray-500 animate-pulse">Calculating...</span>
                        ) : holding.portfolioValue ? (
                          <div>
                            <div className="font-medium text-gray-700 text-sm">
                              ${(holding.portfolioValue / formatTokenBalance(holding.balance, holding.tokenInfo)).toFixed(4)}
                            </div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                              per token
                            </div>
                            <div className="text-xs text-green-600 mt-1">
                              Total: ${holding.portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <Link href={`/token/${holding.tokenId}`}>
                            <Button variant="outline" size="sm" className="text-blue-600 hover:text-blue-800">
                              View
                            </Button>
                          </Link>
                          <Link href={`/token/${holding.tokenId}/mint`}>
                            <Button variant="outline" size="sm" className="text-green-600 hover:text-green-800 border-green-200 bg-green-50">
                              Mint
                            </Button>
                          </Link>
                          <Link href={`/token/${holding.tokenId}/burn`}>
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-800 border-red-200 bg-red-50">
                              Burn
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Mobile card view (visible only on mobile) */}
          <div className="sm:hidden space-y-4">
            <h2 className="text-xl font-semibold">Your Tokens</h2>
            {holdings.map((holding) => (
              <Card key={holding.tokenId} className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-medium">{holding.tokenInfo?.name || holding.tokenId}</h3>
                    <p className="text-sm text-gray-500">{holding.tokenInfo?.symbol || "Unknown"}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {formatTokenBalance(holding.balance, holding.tokenInfo).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} 
                      {holding.tokenInfo?.symbol && ` ${holding.tokenInfo.symbol}`}
                    </div>
                    {/* Portfolio Value */}
                    <div className="mt-1">
                      {holding.loadingValue ? (
                        <span className="text-xs text-gray-500 animate-pulse">Calculating value...</span>
                      ) : holding.portfolioValue ? (
                        <div className="text-right">
                          <div className="font-medium text-gray-700 text-sm">
                            ${(holding.portfolioValue / formatTokenBalance(holding.balance, holding.tokenInfo)).toFixed(4)}
                          </div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                            per token
                          </div>
                          <div className="text-xs text-green-600 mt-1">
                            Total: ${holding.portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Value: N/A</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/token/${holding.tokenId}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-blue-600 hover:text-blue-800">
                      View
                    </Button>
                  </Link>
                  <Link href={`/token/${holding.tokenId}/mint`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-green-600 hover:text-green-800 border-green-200 bg-green-50">
                      Mint
                    </Button>
                  </Link>
                  <Link href={`/token/${holding.tokenId}/burn`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-red-600 hover:text-red-800 border-red-200 bg-red-50">
                      Burn
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
          
          <div className="text-center mt-8">
            <p className="text-sm text-gray-500">
              Click on "View" to see detailed information about each token.
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 