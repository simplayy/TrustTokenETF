'use client';

import { useEffect, useState } from 'react';
import { hederaApi } from '@/lib/services/api';

export function ServerStatus() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        console.log('Checking Hedera connection...');
        const response = await hederaApi.checkConnection();
        console.log('Hedera status response:', response);
        
        if (response.connected) {
          setStatus('connected');
          setAccountId(response.accountId || null);
          setErrorMessage(null);
        } else {
          setStatus('disconnected');
          setErrorMessage(response.message || 'Unable to connect to Hedera');
        }
        
        setTimestamp(new Date().toISOString());
      } catch (error) {
        setStatus('disconnected');
        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('Unknown error');
        }
        console.error('Failed to connect to Hedera:', error);
        setTimestamp(new Date().toISOString());
      }
    };

    checkStatus();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div 
        className={`w-3 h-3 rounded-full ${
          status === 'connected' 
            ? 'bg-green-500' 
            : status === 'disconnected' 
              ? 'bg-red-500' 
              : 'bg-yellow-500'
        }`}
      />
      <div className="flex flex-col">
        <span className="text-xs font-medium">
          {status === 'connected' 
            ? 'Hedera Connected' 
            : status === 'disconnected' 
              ? 'Hedera Disconnected' 
              : 'Checking Hedera...'}
        </span>
        {accountId && status === 'connected' && (
          <span className="text-[10px] text-slate-500">Account: {accountId}</span>
        )}
        {timestamp && (
          <span className="text-[10px] text-slate-500">Last check: {new Date(timestamp).toLocaleTimeString()}</span>
        )}
        {errorMessage && (
          <span className="text-[10px] text-red-500 max-w-[200px] truncate">{errorMessage}</span>
        )}
      </div>
    </div>
  );
} 