"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { tokenApi, TokenInfo } from "@/services/api.service";
import { oracleApi } from "@/services/oracle.service";
import { ExternalLink, Search, Filter, PlusCircle, Briefcase, DollarSign, TrendingUp } from "lucide-react";

// Enhanced token info with price data
interface TokenWithValue extends TokenInfo {
  portfolioValue?: number;
  loadingValue?: boolean;
}

export default function Dashboard() {
  const [tokens, setTokens] = useState<TokenWithValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSupply, setFilterSupply] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTokens() {
      try {
        setLoading(true);
        const response = await tokenApi.getAllTokens();
        if (response.success) {
          const tokensWithValue = response.tokens.map((token: TokenInfo) => ({
            ...token,
            portfolioValue: undefined,
            loadingValue: true
          }));
          setTokens(tokensWithValue);
          
          // Fetch portfolio values for each token
          fetchPortfolioValues(tokensWithValue);
        } else {
          setError("Failed to fetch tokens");
        }
      } catch (err) {
        console.error("Error fetching tokens:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchTokens();
  }, []);

  // Calculate portfolio value for each token
  const fetchPortfolioValues = async (tokensList: TokenWithValue[]) => {
    for (const token of tokensList) {
      try {
        if (token.composition && token.composition.length > 0) {
          // Get asset symbols from composition
          const symbols = token.composition.map(asset => 
            asset.value.toUpperCase().replace(/\./g, '-')
          );
          
          // Fetch prices for all assets in this token's composition
          const pricesResult = await oracleApi.getPrices(symbols);
          
          // Calculate portfolio value based on actual token supply (not fixed $1000)
          let totalValue = 0;
          const tokenSupply = parseInt(token.totalSupply || "0") / 100; // Convert from tinybars to actual tokens
          
          token.composition.forEach(asset => {
            const symbol = asset.value.toUpperCase().replace(/\./g, '-');
            const price = pricesResult.prices[symbol];
            const allocation = asset.allocation || 0;
            
            if (price && allocation > 0 && tokenSupply > 0) {
              // Calculate value based on actual token supply and asset allocation
              const assetValue = (tokenSupply * price * allocation / 100);
              totalValue += assetValue;
            }
          });
          
          // Update token with calculated value
          setTokens(prevTokens => 
            prevTokens.map(t => 
              t.tokenId === token.tokenId 
                ? { ...t, portfolioValue: totalValue, loadingValue: false }
                : t
            )
          );
        } else {
          // No composition data, mark as complete
          setTokens(prevTokens => 
            prevTokens.map(t => 
              t.tokenId === token.tokenId 
                ? { ...t, loadingValue: false }
                : t
            )
          );
        }
      } catch (error) {
        console.error(`Error calculating portfolio value for token ${token.tokenId}:`, error);
        setTokens(prevTokens => 
          prevTokens.map(t => 
            t.tokenId === token.tokenId 
              ? { ...t, loadingValue: false }
              : t
          )
        );
      }
    }
  };

  // Generate Hedera Explorer links for token
  const getHederaExplorerTokenLink = (tokenId: string) => {
    return `https://hashscan.io/testnet/token/${tokenId}`;
  };

  // Filter tokens based on search term and supply filter
  const filteredTokens = tokens.filter(token => {
    // Filter by search term
    const matchesSearch = searchTerm === "" || 
      token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.tokenId.includes(searchTerm);
      
    // Filter by supply
    const matchesSupply = filterSupply === null || 
      (filterSupply === "no-supply" && token.totalSupply === "0") ||
      (filterSupply === "has-supply" && parseInt(token.totalSupply) > 0);
      
    return matchesSearch && matchesSupply;
  });
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">ETF Token Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/portfolio">
            <Button variant="outline" className="flex items-center gap-2">
              <Briefcase size={16} />
              My Portfolio
            </Button>
          </Link>
          <Link href="/create-token">
            <Button className="flex items-center gap-2">
              <PlusCircle size={16} />
              Create New Token
            </Button>
          </Link>
        </div>
      </div>
      
      <p className="text-slate-600 mb-8">
        Manage your ETF tokens and track their performance.
      </p>
      
      {/* Filtri e Ricerca */}
      {tokens.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by name, symbol or ID..."
                className="pl-10 w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-500" />
              <select
                className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterSupply || ""}
                onChange={(e) => setFilterSupply(e.target.value === "" ? null : e.target.value)}
              >
                <option value="">All Tokens</option>
                <option value="no-supply">No Supply</option>
                <option value="has-supply">Has Supply</option>
              </select>
            </div>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-pulse text-gray-500">Loading tokens...</div>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-md border border-red-200 text-red-700 mb-6">
          <p>{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      ) : tokens.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <h2 className="text-xl font-semibold mb-4">No Tokens Found</h2>
          <p className="text-slate-500 mb-4">You don't have any tokens yet.</p>
          <Link href="/create-token">
            <Button>Create Your First Token</Button>
          </Link>
        </div>
      ) : filteredTokens.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <h2 className="text-xl font-semibold mb-4">No Tokens Match Your Filters</h2>
          <p className="text-slate-500 mb-4">Try adjusting your search criteria.</p>
          <Button variant="outline" onClick={() => {setSearchTerm(""); setFilterSupply(null);}}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTokens.map((token) => (
            <Card key={token.tokenId} className="p-6 shadow-md hover:shadow-lg transition-shadow border-t-4 border-blue-500">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{token.name}</h3>
                  <div className="text-sm text-gray-500">Symbol: {token.symbol}</div>
                </div>
                <div className={`${
                  token.totalSupply === "0" 
                    ? "bg-yellow-100 text-yellow-800" 
                    : "bg-green-100 text-green-800"
                } text-xs font-medium px-2.5 py-0.5 rounded`}>
                  {token.totalSupply === "0" ? "No Supply" : `Supply: ${(parseInt(token.totalSupply) / 100).toLocaleString()}`}
                </div>
              </div>

              {/* Portfolio Value Display */}
              {token.composition && token.composition.length > 0 && (
                <div className="mb-4 p-3 bg-green-50 rounded-md border border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign size={14} className="text-green-600" />
                    <span className="text-sm font-medium text-green-800">Total Token Value</span>
                  </div>
                  {token.loadingValue ? (
                    <div className="text-xs text-green-600 animate-pulse">Calculating...</div>
                  ) : token.portfolioValue ? (
                    <div className="text-sm text-green-700">
                      <span className="font-mono font-medium">${token.portfolioValue.toFixed(2)}</span>
                      <span className="text-xs ml-1">(total supply value)</span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">Price data unavailable</div>
                  )}
                  
                  {/* Show top assets in composition */}
                  {token.composition && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {token.composition.slice(0, 3).map(asset => (
                        <span key={asset.value} className="text-xs bg-white px-2 py-0.5 rounded border text-gray-600">
                          {asset.allocation}% {asset.label.split(' ')[0]}
                        </span>
                      ))}
                      {token.composition.length > 3 && (
                        <span className="text-xs text-gray-500">+{token.composition.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className="border-t pt-4 mt-2">
                <div className="text-sm text-gray-500 mb-2">
                  Token ID: <span className="font-mono">{token.tokenId}</span>
                </div>
                {token.memo && (
                  <div className="text-sm text-gray-500 mb-2">
                    Memo: <span className="font-mono">{token.memo}</span>
                  </div>
                )}
                {token.metadataFileId && (
                  <div className="text-sm text-gray-500 mb-2">
                    Metadata File: <span className="font-mono">{token.metadataFileId}</span>
                  </div>
                )}
                <div className="flex justify-between items-center mt-4">
                  <Link href={`/token/${token.tokenId}`}>
                    <Button variant="outline" size="sm">View Details</Button>
                  </Link>
                  <a 
                    href={getHederaExplorerTokenLink(token.tokenId)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
                  >
                    <ExternalLink size={16} className="mr-1" />
                    HashScan
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 