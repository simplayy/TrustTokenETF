"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { tokenApi, TokenInfo, Asset } from "@/services/api.service";
import { oracleApi } from "@/services/oracle.service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, LayoutDashboard, Briefcase, DollarSign, TrendingUp } from "lucide-react";
import { CollateralDisplay } from "@/components/CollateralDisplay";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';

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

export default function TokenDetail() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [tokenPrice, setTokenPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [assetPrices, setAssetPrices] = useState<{[key: string]: number}>({});
  const [tokenPriceHistory, setTokenPriceHistory] = useState<Array<{timestamp: number, price: number, date: string, time: string}>>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTokenInfo = async () => {
      try {
        const result = await tokenApi.getTokenInfo(id as string);
        setTokenInfo(result.tokenInfo);
        
        // Calculate token price after getting token info
        if (result.tokenInfo) {
          calculateTokenPrice(result.tokenInfo);
        }
      } catch (err) {
        console.error("Error fetching token info:", err);
        setError(err instanceof Error ? err.message : "Failed to load token information");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchTokenInfo();
    }
  }, [id]);

  // Calculate token price based on composition
  const calculateTokenPrice = async (tokenInfo: TokenInfo) => {
    if (!tokenInfo.composition || tokenInfo.composition.length === 0) return;
    
    setPriceLoading(true);
    setPriceError(null);
    
    try {
      // Get asset symbols from composition
      const symbols = tokenInfo.composition.map(asset => 
        getOracleSymbol(asset.value)
      );
      
      // Fetch prices for all assets in this token's composition
      const pricesResult = await oracleApi.getPrices(symbols);
      
      // Calculate total token value and store individual asset prices
      let totalValue = 0;
      const assetPrices: {[key: string]: number} = {};
      
      tokenInfo.composition.forEach(asset => {
        const symbol = getOracleSymbol(asset.value);
        const price = pricesResult.prices[symbol];
        const allocation = asset.allocation || 0;
        
        if (price && allocation > 0) {
          // Store individual asset price for display
          assetPrices[symbol] = price;
          // Each token represents 1 unit of the basket
          const assetValue = (price * allocation / 100);
          totalValue += assetValue;
        }
      });
      
      setTokenPrice(totalValue);
      // Store asset prices for individual display (we'll need to add this state)
      setAssetPrices(assetPrices);
      
      // Calculate price history after we have the current prices
      calculateTokenPriceHistory(tokenInfo, 7);
    } catch (error) {
      console.error('Error calculating token price:', error);
      setPriceError(error instanceof Error ? error.message : 'Failed to calculate token price');
    } finally {
      setPriceLoading(false);
    }
  };

  // Calculate token price history based on composition
  const calculateTokenPriceHistory = async (tokenInfo: TokenInfo, days: number = 7) => {
    if (!tokenInfo.composition || tokenInfo.composition.length === 0) return;
    
    setChartLoading(true);
    setChartError(null);
    
    try {
      // Get historical data for all assets in the token's composition
      const assetHistoryPromises = tokenInfo.composition.map(async (asset) => {
        const symbol = getOracleSymbol(asset.value);
        try {
          const historyData = await oracleApi.getHistoricalPrices(symbol, days);
          return {
            symbol,
            allocation: asset.allocation || 0,
            history: historyData.priceData || []
          };
        } catch (error) {
          console.error(`Error fetching history for ${symbol}:`, error);
          return {
            symbol,
            allocation: asset.allocation || 0,
            history: []
          };
        }
      });
      
      const assetHistories = await Promise.all(assetHistoryPromises);
      
      // Calculate token price for each timestamp
      const priceHistory: Array<{timestamp: number, price: number, date: string, time: string}> = [];
      
      // Find the common timestamps (use the first asset's timestamps as reference)
      const referenceHistory = assetHistories.find(ah => ah.history.length > 0)?.history || [];
      
      referenceHistory.forEach((point: {timestamp: number, price: number}, index: number) => {
        let tokenPrice = 0;
        let hasAllPrices = true;
        
        // Calculate token price at this timestamp
        assetHistories.forEach(assetHistory => {
          if (assetHistory.history[index] && assetHistory.allocation > 0) {
            const assetPrice = assetHistory.history[index].price;
            const assetValue = (assetPrice * assetHistory.allocation / 100);
            tokenPrice += assetValue;
          } else {
            hasAllPrices = false;
          }
        });
        
        // Only add to history if we have prices for all assets
        if (hasAllPrices && tokenPrice > 0) {
          const timestamp = referenceHistory[index].timestamp;
          const date = new Date(timestamp);
          priceHistory.push({
            timestamp,
            price: tokenPrice,
            date: date.toLocaleDateString('en-GB'),
            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
      });
      
      // Add current price as the last point to ensure consistency
      if (priceHistory.length > 0) {
        const now = Date.now();
        const currentDate = new Date(now);
        
        // Calculate current token price again to ensure it matches
        let currentTokenPrice = 0;
        tokenInfo.composition.forEach(asset => {
          const symbol = getOracleSymbol(asset.value);
          const price = assetPrices[symbol]; // Use the prices we already fetched
          const allocation = asset.allocation || 0;
          
          if (price && allocation > 0) {
            const assetValue = (price * allocation / 100);
            currentTokenPrice += assetValue;
          }
        });
        
        if (currentTokenPrice > 0) {
          priceHistory.push({
            timestamp: now,
            price: currentTokenPrice,
            date: currentDate.toLocaleDateString('en-GB'),
            time: currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
      }
      
      // Sort price history by timestamp
      priceHistory.sort((a, b) => a.timestamp - b.timestamp);
      
      setTokenPriceHistory(priceHistory);
    } catch (error) {
      console.error('Error calculating token price history:', error);
      setChartError(error instanceof Error ? error.message : 'Failed to calculate token price history');
    } finally {
      setChartLoading(false);
    }
  };

  const handleMint = async () => {
    try {
      setLoading(true);
      await tokenApi.mintToken(id as string, 100);
      // Refresh token info
      const result = await tokenApi.getTokenInfo(id as string);
      setTokenInfo(result.tokenInfo);
      setError(null);
    } catch (err) {
      console.error("Error minting tokens:", err);
      setError(err instanceof Error ? err.message : "Failed to mint tokens");
    } finally {
      setLoading(false);
    }
  };

  const fetchFileContent = async () => {
    if (!tokenInfo?.metadataFileId) return;
    
    setFileLoading(true);
    setFileError(null);
    try {
      const response = await fetch(`http://localhost:3002/api/file-content?fileId=${tokenInfo.metadataFileId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch file content');
      }
      const data = await response.json();
      setFileContent(data.content);
    } catch (err) {
      console.error("Error fetching file content:", err);
      setFileError(err instanceof Error ? err.message : "Failed to fetch file content");
    } finally {
      setFileLoading(false);
    }
  };

  // Generate Hedera Explorer links for token and files
  const getHederaExplorerTokenLink = (tokenId: string) => {
    return `https://hashscan.io/testnet/token/${tokenId}`;
  };
  
  // Generate HashScan link for file transaction
  const getFileTransactionLink = (fileId: string, fileTransactionId?: string) => {
    // Se abbiamo il transaction ID dal backend, lo usiamo
    if (fileTransactionId) {
      return `https://hashscan.io/testnet/transaction/${fileTransactionId}`;
    }
    
    // Fallback per i file creati prima dell'implementazione del transaction ID
    const transactionMap: {[key: string]: string} = {
      "0.0.5992257": "0.0.5782104-1747127372-710744746",
      "0.0.5992109": "0.0.5782104-1747126200-771277688"
    };
    
    return transactionMap[fileId] ? 
      `https://hashscan.io/testnet/transaction/${transactionMap[fileId]}` : 
      `https://hashscan.io/testnet/account/0.0.5782104`;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 max-w-3xl">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="text-center py-8">
            <div className="animate-pulse text-gray-500">Loading token information...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 max-w-3xl">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="text-center py-8">
            <div className="text-red-500 mb-4">{error}</div>
            <Link href="/create-token">
              <Button>Create New Token</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Token Details</h1>
        <div className="flex gap-2">
          <Link href="/dashboard">
            <Button variant="outline" className="flex items-center gap-2">
              <LayoutDashboard size={16} />
              Dashboard
            </Button>
          </Link>
          <Link href="/portfolio">
            <Button variant="outline" className="flex items-center gap-2">
              <Briefcase size={16} />
              My Portfolio
            </Button>
          </Link>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
        {tokenInfo ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-gray-500">Token Name</h2>
                <p className="text-lg font-medium">{tokenInfo.name}</p>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-gray-500">Token Symbol</h2>
                <p className="text-lg font-medium">{tokenInfo.symbol}</p>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-gray-500">Token ID</h2>
                <div className="flex items-center">
                  <p className="text-lg font-mono">{tokenInfo.tokenId}</p>
                  <a 
                    href={getHederaExplorerTokenLink(tokenInfo.tokenId)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 hover:text-blue-800"
                    title="View on Hedera Explorer"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-gray-500">Total Supply</h2>
                <p className="text-lg font-medium">{(parseInt(tokenInfo.totalSupply) / Math.pow(10, tokenInfo.decimals || 6)).toLocaleString()}</p>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-gray-500">Decimals</h2>
                <p className="text-lg font-medium">{tokenInfo.decimals}</p>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-sm font-medium text-gray-500">Treasury</h2>
                <p className="text-lg font-mono truncate">{tokenInfo.treasury}</p>
              </div>
            </div>

            {/* Token Composition Section */}
            {tokenInfo.composition && tokenInfo.composition.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <h2 className="text-xl font-semibold mb-2">Token Composition</h2>
                <div className="flex items-center mb-4">
                  <div className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Stored on Hedera Network
                  </div>
                  {tokenInfo.metadataFileId && (
                    <div className="ml-2 text-xs text-gray-500 flex items-center">
                      File ID: 
                      <span className="font-mono ml-1">{tokenInfo.metadataFileId}</span>
                      <Button 
                        onClick={fetchFileContent}
                        variant="ghost" 
                        size="sm"
                        className="ml-1 p-0 h-auto"
                        disabled={fileLoading}
                      >
                        <ExternalLink size={14} className="text-blue-600 hover:text-blue-800" />
                      </Button>
                    </div>
                  )}
                </div>
                <Card className="p-4">
                  <div className="space-y-3">
                    {tokenInfo.composition.map((asset: Asset, index: number) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{asset.label}</span>
                          <div className="text-right">
                            <span className="text-sm font-medium">{asset.allocation}%</span>
                            {tokenPrice !== null && !priceLoading && asset.allocation && (
                              <div className="text-xs text-gray-600">
                                {(() => {
                                  const symbol = getOracleSymbol(asset.value);
                                  const assetPrice = assetPrices[symbol];
                                  const assetValue = assetPrice ? (assetPrice * asset.allocation / 100) : 0;
                                  return (
                                    <div>
                                      <div>Asset: ${assetPrice?.toFixed(4) || 'N/A'}</div>
                                      <div>Value: ${assetValue.toFixed(4)}</div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                        <Progress value={asset.allocation} className="h-2" />
                      </div>
                    ))}
                  </div>
                  
                  {tokenPrice !== null && !priceLoading && (
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <div className="flex justify-between items-center text-sm font-medium">
                        <span>Total Token Value:</span>
                        <span className="text-green-600 text-lg">${tokenPrice.toFixed(4)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Based on current market prices of underlying assets
                      </p>
                    </div>
                  )}
                </Card>

                {/* Token Price History Chart */}
                {tokenInfo.composition && tokenInfo.composition.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold flex items-center">
                        <TrendingUp className="mr-2 h-5 w-5" />
                        Token Price History (7 days)
                      </h2>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        ETF Token
                      </Badge>
                    </div>
                    <Card className="p-4">
                      {chartLoading ? (
                        <div className="h-[300px] flex items-center justify-center">
                          <div className="animate-pulse text-gray-500">Loading price history...</div>
                        </div>
                      ) : chartError ? (
                        <div className="h-[300px] flex items-center justify-center text-red-500">
                          {chartError}
                        </div>
                      ) : tokenPriceHistory.length > 0 ? (
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={tokenPriceHistory}
                              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => {
                                  if (typeof value === 'string' && value.includes('/')) {
                                    const parts = value.split('/');
                                    if (parts.length === 3) {
                                      return `${parts[0]}/${parts[1]}`;
                                    }
                                  }
                                  return value;
                                }}
                              />
                              <YAxis 
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => `$${value.toFixed(2)}`}
                              />
                              <Tooltip 
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-white border border-gray-300 p-3 rounded-md shadow-lg">
                                        <p className="text-sm font-medium">{`${data.date} ${data.time}`}</p>
                                        <p className="text-sm text-blue-600">{`Price: $${data.price.toFixed(4)}`}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="price"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6, fill: "#3b82f6" }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-gray-500">
                          No historical data available
                        </div>
                      )}
                      
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Token price calculated based on the weighted composition of underlying assets using real-time market prices.
                          Historical data uses mock data with realistic price movements for demonstration purposes.
                        </p>
                      </div>
                    </Card>
                  </div>
                )}

                {fileLoading && (
                  <div className="mt-2 p-2 bg-gray-50 rounded">
                    <div className="text-center text-sm text-gray-500">
                      Fetching file data from Hedera...
                    </div>
                  </div>
                )}

                {fileError && (
                  <div className="mt-2 p-2 bg-red-50 rounded">
                    <div className="text-sm text-red-500">{fileError}</div>
                  </div>
                )}

                {fileContent && (
                  <div className="mt-2 p-2 bg-gray-50 rounded">
                    <div className="text-xs font-mono overflow-auto">
                      <p className="font-semibold mb-1">File Content from Hedera:</p>
                      <pre className="whitespace-pre-wrap">{fileContent}</pre>
                    </div>
                  </div>
                )}

                <div className="mt-2 text-xs text-gray-500">
                  <p>Asset composition data is stored and retrieved directly from the Hedera network using Hedera File Service (HFS)</p>
                  <p>This approach is in line with the Hedera Asset Tokenization Studio (ATS) methodology.</p>
                </div>
              </div>
            )}
            
            <div className="border-t pt-4 mt-4">
              <h2 className="text-xl font-semibold mb-4">Token Actions</h2>
              <div className="flex gap-4">
                <Link href={`/token/${id}/mint`}>
                  <Button>Mint Tokens</Button>
                </Link>
                <Link href={`/token/${id}/burn`}>
                  <Button variant="outline" className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200">
                    Burn Tokens
                  </Button>
                </Link>
                <Link href="/create-token">
                  <Button variant="outline">Create Another Token</Button>
                </Link>
              </div>
            </div>

            {/* Hedera Explorer Section */}
            <div className="border-t pt-4 mt-4">
              <h2 className="text-xl font-semibold mb-2">Verify on Hedera</h2>
              <p className="text-sm text-gray-600 mb-3">
                Verify this token's data directly on the Hedera network using HashScan explorer and Mirror Node API.
              </p>
              <div className="space-y-2">
                <a 
                  href={getHederaExplorerTokenLink(tokenInfo.tokenId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink size={16} className="mr-1" />
                  View Token on HashScan
                </a>
                
                {tokenInfo.metadataFileId && (
                  <div className="mt-3 p-3 border border-blue-100 rounded-md bg-blue-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-medium text-blue-800">File Verification</h3>
                        <p className="text-xs text-gray-600 mt-1">
                          File ID: <span className="font-mono">{tokenInfo.metadataFileId}</span>
                        </p>
                      </div>
                      <div className="flex">
                        <Button 
                          onClick={fetchFileContent}
                          variant="ghost" 
                          size="sm"
                          className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
                          disabled={fileLoading}
                        >
                          <ExternalLink size={16} className="mr-1" />
                          View File Content
                        </Button>
                        <a 
                          href={getFileTransactionLink(tokenInfo.metadataFileId || "", tokenInfo.fileTransactionId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-600 hover:text-blue-800 flex items-center text-sm"
                        >
                          <ExternalLink size={16} className="mr-1" />
                          View Transaction
                        </a>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Il contenuto del file è memorizzato sulla blockchain Hedera. Puoi visualizzare il contenuto direttamente 
                      qui oppure verificare la transazione di creazione su HashScan.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Collateral Information Section */}
            <CollateralDisplay tokenId={tokenInfo.tokenId} />
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-500">No token information available</div>
          </div>
        )}
      </div>
    </div>
  );
} 