"use client";

import { useState, useEffect } from "react";
import { Transaction, transactionApi } from "@/services/api.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ChevronDown, RefreshCw, ArrowDownUp, ExternalLink, Plus, Info } from "lucide-react";
import { formatDistance } from "date-fns";
import Link from "next/link";

interface TokenTransactionsListProps {
  tokenId: string;
  limit?: number;
}

export function TokenTransactionsList({ tokenId, limit = 20 }: TokenTransactionsListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [showAll, setShowAll] = useState<boolean>(false);
  const [network, setNetwork] = useState<'testnet' | 'mainnet'>('testnet');

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`Fetching transactions for token ${tokenId}...`);
      // Use the token-specific transactions API
      const result = await transactionApi.getTokenTransactions(tokenId, 100, order);
      console.log(`Successfully retrieved ${result.transactions?.length || 0} transactions for token ${tokenId}`);
      
      setTransactions(result.transactions || []);
      
      // Set network information
      if (result.network) {
        setNetwork(result.network as 'testnet' | 'mainnet');
      }
    } catch (err) {
      console.error(`Error fetching transactions for token ${tokenId}:`, err);
      setError(err instanceof Error ? err.message : "Failed to load token transactions");
      
      // Try to fall back to the general transactions API
      try {
        console.log("Falling back to general transactions API with client-side filtering");
        const allResult = await transactionApi.getTransactions(100, order);
        
        // Filter transactions manually on the client side
        const filteredTransactions = allResult.transactions.filter((tx: Transaction) => {
          // Check for token transfers
          if (tx.tokenTransfers && Array.isArray(tx.tokenTransfers)) {
            return tx.tokenTransfers.some((transfer: any) => {
              const transferTokenId = 
                transfer.token_id || 
                transfer.tokenId || 
                transfer.token;
                
              return transferTokenId === tokenId;
            });
          }
          
          // Check for entity_id for token creation transactions
          if (tx.entity_id === tokenId) {
            return true;
          }
          
          // Check memos that might contain the token ID
          if (tx.memo && tx.memo.includes(tokenId)) {
            return true;
          }
          
          return false;
        });
        
        console.log(`Client fallback: found ${filteredTransactions.length} transactions for token ${tokenId}`);
        setTransactions(filteredTransactions);
        setError(null);
        
        if (allResult.network) {
          setNetwork(allResult.network as 'testnet' | 'mainnet');
        }
      } catch (fallbackErr) {
        console.error("Fallback also failed:", fallbackErr);
        // Keep the original error
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tokenId) {
      fetchTransactions();
    }
  }, [tokenId, order]);

  const toggleOrder = () => {
    setOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const getTimeAgo = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return formatDistance(date, new Date(), { addSuffix: true });
    } catch (e) {
      return "Unknown date";
    }
  };

  const getTransactionType = (tx: Transaction) => {
    // Check if it's a token creation transaction
    if (tx.entity_id === tokenId && tx.type?.includes("TOKEN")) {
      return "Token Creation";
    }
    
    // Check if it's a mint transaction
    if (tx.tokenTransfers && tx.tokenTransfers.some((transfer: any) => 
      (transfer.token_id === tokenId || transfer.tokenId === tokenId) && 
      (transfer.from === null || transfer.from === "0.0.0.0")
    )) {
      return "Token Mint";
    }
    
    // Standard token transfer
    if (tx.tokenTransfers && tx.tokenTransfers.some((transfer: any) => 
      (transfer.token_id === tokenId || transfer.tokenId === tokenId)
    )) {
      return "Token Transfer";
    }
    
    // Transaction mentions the token
    if (tx.memo && tx.memo.includes(tokenId)) {
      return "Token Related";
    }
    
    return tx.type || "Unknown";
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status) return "bg-gray-100 text-gray-800";
    
    switch (status.toLowerCase()) {
      case 'success':
        return "bg-green-100 text-green-800";
      case 'failure':
        return "bg-red-100 text-red-800";
      case 'pending':
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatHederaAddress = (id: string) => {
    if (!id) return "-";
    if (id.length > 16) {
      return `${id.substring(0, 8)}...${id.substring(id.length - 8)}`;
    }
    return id;
  };

  // Generate HashScan URL for a transaction
  const getHashscanUrl = (txId: string) => {
    if (!txId) return '';
    return `https://hashscan.io/${network}/transaction/${txId}`;
  };

  // Helper to get token transfer information
  const getTokenTransferInfo = (tx: Transaction) => {
    // For token creation transactions
    if (tx.entity_id === tokenId && tx.type?.includes("TOKEN")) {
      return "Token created on Hedera network";
    }
    
    if (!tx.tokenTransfers || !Array.isArray(tx.tokenTransfers)) {
      if (tx.memo && tx.memo.includes(tokenId)) {
        return `Memo: ${tx.memo}`;
      }
      return 'No token transfers';
    }

    // Since we're now using a dedicated token API, all transfers should be relevant
    // but we'll still filter just to be safe
    const relevantTransfers = tx.tokenTransfers.filter((transfer: any) => {
      const transferTokenId = 
        transfer.token_id || 
        transfer.tokenId || 
        transfer.token;
        
      return transferTokenId === tokenId;
    });
    
    if (relevantTransfers.length === 0) {
      return 'No transfers for this token';
    }
    
    // Create a string describing the transfers
    return relevantTransfers.map((transfer: any) => {
      const amount = transfer.amount || transfer.value || 0;
      const from = transfer.from || transfer.sender || transfer.account || 'unknown';
      const to = transfer.to || transfer.receiver || 'unknown';
      
      // Check if it's a mint (from = null or 0.0.0.0)
      if (from === null || from === '0.0.0.0' || from === 'unknown') {
        return `Minted ${amount} tokens to ${formatHederaAddress(to)}`;
      }
      
      return `${amount} tokens from ${formatHederaAddress(from)} to ${formatHederaAddress(to)}`;
    }).join(', ');
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Token Transactions</CardTitle>
            <CardDescription>Transaction history for token {tokenId}</CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleOrder}
              className="flex items-center"
            >
              <ArrowDownUp className="mr-2 h-4 w-4" /> 
              {order === 'desc' ? 'Newest First' : 'Oldest First'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchTransactions}
              className="flex items-center"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-6">
            <div className="animate-pulse text-gray-500">Loading token transactions...</div>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : transactions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500 mb-4">No transactions found for this token</p>
            <div className="flex flex-col space-y-2 items-center">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchTransactions}
                className="flex items-center"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
              
              <Link href={`/token/${tokenId}/mint`}>
                <Button 
                  variant="default" 
                  size="sm"
                  className="flex items-center"
                >
                  <Plus className="mr-2 h-4 w-4" /> Mint Tokens
                </Button>
              </Link>
              
              <a 
                href={`https://hashscan.io/${network}/token/${tokenId}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center mt-4"
              >
                <Info className="mr-2 h-4 w-4" />
                View on HashScan Explorer
              </a>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, showAll ? transactions.length : limit).map((tx: Transaction, idx: number) => (
                  <TableRow key={tx.id || idx} className="hover:bg-gray-50">
                    <TableCell className="whitespace-nowrap">
                      <div className="font-medium">{getTimeAgo(tx.date)}</div>
                      <div className="text-xs text-gray-500">{new Date(tx.date).toLocaleString()}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatHederaAddress(tx.id)}
                      {tx.id && (
                        <a 
                          href={getHashscanUrl(tx.id)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="ml-2 text-blue-600 hover:text-blue-800 inline-flex items-center"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${tx.result === 'SUCCESS' ? 'bg-green-50' : ''}`}>
                        {getTransactionType(tx)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="text-xs">{getTokenTransferInfo(tx)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        
        {transactions.length > limit && !showAll && (
          <div className="mt-4 text-center">
            <Button 
              variant="ghost" 
              onClick={() => setShowAll(true)}
              className="flex items-center mx-auto"
            >
              Show All Transactions <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 