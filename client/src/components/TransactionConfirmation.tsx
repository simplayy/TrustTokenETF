"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  Coins, 
  ExternalLink, 
  Copy, 
  FileText,
  Check
} from "lucide-react";
import { useState } from "react";

interface TransactionDetails {
  transactionId: string;
  timestamp: string;
  tokenId: string;
  tokenSymbol: string;
  amount: number;
  fee?: number;
  network: 'mainnet' | 'testnet';
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
}

interface TransactionConfirmationProps {
  transaction: TransactionDetails;
  onClose?: () => void;
}

export function TransactionConfirmation({ 
  transaction, 
  onClose 
}: TransactionConfirmationProps) {
  const [copied, setCopied] = useState(false);

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Get Hashscan URL
  const getHashscanUrl = (txId: string) => {
    const baseUrl = transaction.network === 'mainnet' 
      ? 'https://hashscan.io/mainnet' 
      : 'https://hashscan.io/testnet';
    return `${baseUrl}/transaction/${txId}`;
  };

  // Get token Explorer URL
  const getTokenExplorerUrl = (tokenId: string) => {
    const baseUrl = transaction.network === 'mainnet' 
      ? 'https://hashscan.io/mainnet' 
      : 'https://hashscan.io/testnet';
    return `${baseUrl}/token/${tokenId}`;
  };

  // Copy transaction ID to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-green-100 bg-green-50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center">
            <CheckCircle2 className="mr-2 h-5 w-5 text-green-600" />
            <div>
              <CardTitle className="text-green-800">Transaction Successful</CardTitle>
              <CardDescription className="text-green-700">
                Your token minting transaction has been confirmed
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className={
            transaction.status === 'SUCCESS' ? 'bg-green-100 text-green-800' : 
            transaction.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 
            'bg-red-100 text-red-800'
          }>
            {transaction.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-md border border-green-100">
            <h3 className="text-sm font-medium mb-2 flex items-center">
              <Coins className="h-4 w-4 mr-2 text-green-600" />
              Transaction Details
            </h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Amount:</span>
                <span className="font-medium">{transaction.amount} {transaction.tokenSymbol}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500">Date:</span>
                <span>{formatTimestamp(transaction.timestamp)}</span>
              </div>
              
              {transaction.fee !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Network Fee:</span>
                  <span>{transaction.fee} HBAR</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-500">Network:</span>
                <span className="capitalize">{transaction.network}</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Transaction ID:</span>
              <div className="flex items-center">
                <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                  {transaction.transactionId.substring(0, 12)}...
                </code>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 ml-1" 
                  onClick={() => copyToClipboard(transaction.transactionId)}
                >
                  {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Token ID:</span>
              <div className="flex items-center">
                <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                  {transaction.tokenId}
                </code>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col space-y-2 pt-2">
            <a 
              href={getHashscanUrl(transaction.transactionId)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full"
            >
              <Button variant="outline" className="w-full flex items-center justify-center" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Transaction on Hashscan
              </Button>
            </a>
            
            <a 
              href={getTokenExplorerUrl(transaction.tokenId)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full"
            >
              <Button variant="outline" className="w-full flex items-center justify-center" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                View Token on Hashscan
              </Button>
            </a>
          </div>
          
          <Alert className="bg-blue-50 border-blue-100">
            <AlertTitle className="text-blue-800 flex items-center text-sm">
              <CheckCircle2 className="h-4 w-4 mr-2 text-blue-600" />
              Verification Complete
            </AlertTitle>
            <AlertDescription className="text-blue-700 text-xs">
              This transaction has been verified on the Hedera network. The token supply has been updated and the collateral has been securely allocated.
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
} 