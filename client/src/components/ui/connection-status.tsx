"use client";

import { useEffect, useState } from 'react';
import { hederaApi } from '@/services/api.service';

interface ConnectionState {
  connected: boolean;
  message?: string;
  accountId?: string;
}

export function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const result = await hederaApi.checkStatus();
        setStatus(result);
      } catch (error) {
        setStatus({
          connected: false,
          message: error instanceof Error ? error.message : 'Failed to check connection'
        });
      } finally {
        setLoading(false);
      }
    };

    checkConnection();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center text-sm text-gray-500">
        <div className="h-2 w-2 bg-gray-300 rounded-full mr-2 animate-pulse"></div>
        Connecting...
      </div>
    );
  }

  return (
    <div className="flex items-center text-sm">
      <div 
        className={`h-2 w-2 rounded-full mr-2 ${
          status?.connected ? 'bg-green-500' : 'bg-red-500'
        }`}
      ></div>
      <span className={status?.connected ? 'text-green-700' : 'text-red-700'}>
        {status?.connected ? 'Connected' : 'Disconnected'}
      </span>
      {status?.accountId && (
        <span className="ml-2 text-gray-500">
          ({status.accountId})
        </span>
      )}
    </div>
  );
} 