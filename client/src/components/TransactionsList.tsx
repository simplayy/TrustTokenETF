"use client";

import { useState, useEffect } from "react";
import { Transaction, transactionApi } from "@/services/api.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ChevronDown, RefreshCw, ArrowDownUp, ExternalLink } from "lucide-react";
import { formatDistance } from "date-fns";
import Link from "next/link";

interface TransactionsListProps {
  limit?: number;
}

export function TransactionsList({ limit = 50 }: TransactionsListProps) {
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
      const result = await transactionApi.getTransactions(limit, order);
      console.log("Transactions retrieved:", result.transactions);
      setTransactions(result.transactions || []);
      
      // Check if we have network info in the result
      if (result.network) {
        setNetwork(result.network as 'testnet' | 'mainnet');
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [order]);

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

  // Genera l'URL di HashScan per una transazione
  const getHashscanUrl = (txId: string) => {
    if (!txId) return '';
    return `https://hashscan.io/${network}/transaction/${txId}`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Recent account activity on Hedera network</CardDescription>
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
            <div className="animate-pulse text-gray-500">Loading transactions...</div>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : transactions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500">No transactions found for this account</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, showAll ? transactions.length : 10).map((tx, idx) => (
                  <TableRow key={tx.id || idx} className="hover:bg-gray-50">
                    <TableCell className="whitespace-nowrap">
                      <div className="font-medium">{getTimeAgo(tx.date)}</div>
                      <div className="text-xs text-gray-500">{new Date(tx.date).toLocaleString()}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(tx.result)}>{tx.result || "Unknown"}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatHederaAddress(tx.id)}
                    </TableCell>
                    <TableCell>
                      {tx.id && (
                        <a 
                          href={getHashscanUrl(tx.id)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          <span>View</span>
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        
        {transactions.length > 10 && !showAll && (
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