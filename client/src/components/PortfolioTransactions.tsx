"use client";

import React from "react";
import { useState, useEffect } from "react";
import { Transaction, transactionApi, TransactionCategory } from "@/services/api.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertCircle, 
  ChevronDown, 
  RefreshCw, 
  ArrowDownUp, 
  ExternalLink, 
  TrendingUp, 
  TrendingDown,
  CornerUpRight,
  CornerDownRight,
  FilePlus,
  Database
} from "lucide-react";
import { formatDistance } from "date-fns";
import Link from "next/link";

interface PortfolioTransactionsProps {
  limit?: number;
}

// Mapping degli iconi in base al tipo di icona dal backend
const iconMapping: Record<string, React.ReactNode> = {
  'trending-up': <TrendingUp className="h-3 w-3" />,
  'trending-down': <TrendingDown className="h-3 w-3" />,
  'arrow-down-up': <ArrowDownUp className="h-3 w-3" />,
  'database': <Database className="h-3 w-3" />,
  'corner-up-right': <CornerUpRight className="h-3 w-3" />,
  'corner-down-right': <CornerDownRight className="h-3 w-3" />,
  'file-plus': <FilePlus className="h-3 w-3" />
};

// Mapping dei colori in base al colore dal backend
const colorMapping: Record<string, string> = {
  'green': 'bg-green-50 text-green-700',
  'red': 'bg-red-50 text-red-700',
  'blue': 'bg-blue-50 text-blue-700',
  'gray': 'bg-gray-50 text-gray-700',
  'purple': 'bg-purple-50 text-purple-700',
  'indigo': 'bg-indigo-50 text-indigo-700'
};

export function PortfolioTransactions({ limit = 10 }: PortfolioTransactionsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<'testnet' | 'mainnet'>('testnet');

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      // Richiamiamo l'API con l'opzione includeTokenInfo per ottenere informazioni arricchite
      const result = await transactionApi.getTransactions(100, 'desc', true);
      console.log("All transactions:", result.transactions.length);
      
      // Non filtriamo più le transazioni, mostriamo tutto
      setTransactions(result.transactions || []);
      
      if (result.network) {
        setNetwork(result.network as 'testnet' | 'mainnet');
      }
    } catch (err) {
      console.error("Error fetching portfolio transactions:", err);
      setError(err instanceof Error ? err.message : "Failed to load transaction history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const getTimeAgo = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return formatDistance(date, new Date(), { addSuffix: true });
    } catch (e) {
      return "Unknown date";
    }
  };

  const formatHederaAddress = (id: string) => {
    if (!id) return "-";
    if (id.length > 12) {
      return `${id.substring(0, 6)}...${id.substring(id.length - 6)}`;
    }
    return id;
  };

  const getHashscanUrl = (txId: string) => {
    if (!txId) return '';
    return `https://hashscan.io/${network}/transaction/${txId}`;
  };
  
  const getTokenUrl = (tokenId: string) => {
    if (!tokenId) return '';
    return `/token/${tokenId}`;
  };

  // Determina il tipo di transazione
  const getTransactionCategory = (tx: Transaction): TransactionCategory => {
    // Usa la categoria fornita dal backend se disponibile
    if (tx.category) {
      return tx.category;
    }
    
    // Fallback nel caso in cui il backend non fornisca la categoria
    const type = tx.type?.toLowerCase() || '';
    
    // Categoria di default
    return {
      type: type || 'transaction',
      label: type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Transaction',
      description: tx.memo ? `Memo: ${tx.memo}` : (tx.type || 'Transaction'),
      color: 'gray',
      icon: 'arrow-down-up'
    };
  };

  // Ottiene l'icona corrispondente alla categoria
  const getCategoryIcon = (category: TransactionCategory) => {
    if (!category.icon) return null;
    return iconMapping[category.icon] || null;
  };
  
  // Ottiene il colore corrispondente alla categoria
  const getCategoryColor = (category: TransactionCategory) => {
    if (!category.color) return 'bg-gray-50 text-gray-700';
    return colorMapping[category.color] || 'bg-gray-50 text-gray-700';
  };

  // Formatta una descrizione dettagliata della transazione
  const getTransactionDetails = (tx: Transaction): React.ReactNode => {
    if (tx.createdToken) {
      // Se è una transazione di creazione token
      return (
        <div>
          <div className="text-sm font-medium">Created token {tx.createdToken.name} ({tx.createdToken.symbol})</div>
          <div className="text-xs text-gray-600">
            <Link href={getTokenUrl(tx.createdToken.id)}>
              <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
                {formatHederaAddress(tx.createdToken.id)}
              </span>
            </Link>
          </div>
        </div>
      );
    }
    
    if (tx.tokens && Object.keys(tx.tokens).length > 0) {
      // Se ci sono token coinvolti nella transazione
      return (
        <div>
          <div className="text-sm font-medium">{tx.category?.description || 'Token transaction'}</div>
          <div className="mt-1 text-xs space-y-1">
            {Object.values(tx.tokens).map((token, i) => (
              <div key={i} className="flex items-center">
                <Link href={getTokenUrl(token.id)}>
                  <span className="text-blue-600 hover:text-blue-800 cursor-pointer mr-1">
                    {token.name || formatHederaAddress(token.id)}
                  </span>
                </Link>
                {token.transfers.map((transfer: any, j: number) => {
                  const amount = Math.abs(transfer.amount || 0) / 100;
                  return (
                    <span key={j} className={transfer.direction === 'incoming' ? 'text-green-600 ml-1' : 'text-red-600 ml-1'}>
                      {transfer.direction === 'incoming' ? '+' : '-'}{amount.toLocaleString()}
                      {token.symbol && ` ${token.symbol}`}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    // Se è una transazione HBAR
    if (tx.transfers && tx.transfers.length > 0 && tx.category && (tx.category.type === 'hbar_receive' || tx.category.type === 'hbar_send')) {
      const incomingTransfer = tx.transfers.find((t: any) => 
        (t.account === "0.0.5782104" && t.amount > 0) || (t.to === "0.0.5782104")
      );
      
      const outgoingTransfer = tx.transfers.find((t: any) => 
        (t.account === "0.0.5782104" && t.amount < 0) || (t.from === "0.0.5782104")
      );
      
      if (incomingTransfer) {
        const amount = Math.abs(incomingTransfer.amount || 0);
        return (
          <div className="text-sm">
            <span className="font-medium">Received </span>
            <span className="text-green-600 font-medium">{amount} HBAR</span>
          </div>
        );
      }
      
      if (outgoingTransfer) {
        const amount = Math.abs(outgoingTransfer.amount || 0);
        return (
          <div className="text-sm">
            <span className="font-medium">Sent </span>
            <span className="text-red-600 font-medium">{amount} HBAR</span>
          </div>
        );
      }
    }
    
    // Fallback per altri tipi di transazioni
    return <div className="text-sm">{tx.category?.description || tx.memo || tx.type || 'Transaction'}</div>;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Your account activity on Hedera network</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchTransactions}
            className="flex items-center"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-6">
            <div className="animate-pulse text-gray-500">Loading transaction history...</div>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : transactions.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 mb-2">No transactions found</p>
            <p className="text-sm text-gray-400">Create or import tokens to start your portfolio</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, limit).map((tx, idx) => {
                  const category = getTransactionCategory(tx);
                  return (
                    <TableRow key={tx.id || idx} className="hover:bg-gray-50">
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium">{getTimeAgo(tx.date)}</div>
                        <div className="text-xs text-gray-500">{new Date(tx.date).toLocaleString()}</div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`${getCategoryColor(category)} flex items-center gap-1`}
                        >
                          {getCategoryIcon(category)}
                          {category.label}
                        </Badge>
                        {tx.entity_id && tx.type.includes('TOKEN') && (
                          <div className="mt-1 text-xs text-gray-600">
                            Token: {formatHederaAddress(tx.entity_id)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getTransactionDetails(tx)}
                      </TableCell>
                      <TableCell>
                        <Badge className={tx.result === 'SUCCESS' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {tx.result || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <a 
                          href={getHashscanUrl(tx.id)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center justify-end"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          <span>View</span>
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {transactions.length > limit && (
              <div className="mt-4 text-center">
                <Link href="/transactions">
                  <Button 
                    variant="outline"
                    className="flex items-center mx-auto"
                  >
                    View All Transactions <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 