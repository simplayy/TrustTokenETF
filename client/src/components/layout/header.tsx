"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X, Briefcase, LineChart, TrendingUp, TrendingDown } from 'lucide-react';
import { oracleApi } from '@/services/oracle.service';

// Component for price ticker
const PriceTicker = () => {
  const [prices, setPrices] = useState<{[key: string]: number}>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const result = await oracleApi.getPrices(['BTC', 'ETH', 'HBAR']);
        setPrices(result.prices);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching ticker prices:', error);
        setLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="hidden lg:flex items-center space-x-4 text-xs text-gray-500">
        <div className="animate-pulse">Loading prices...</div>
      </div>
    );
  }

  return (
    <div className="hidden lg:flex items-center space-x-4 text-xs">
      {Object.entries(prices).map(([symbol, price]) => (
        <div key={symbol} className="flex items-center space-x-1">
          <span className="font-medium text-gray-600">{symbol}:</span>
          <span className="text-green-600 font-mono">
            ${symbol === 'BTC' ? price.toLocaleString() : 
              symbol === 'ETH' ? price.toLocaleString() : 
              price.toFixed(4)}
          </span>
        </div>
      ))}
    </div>
  );
};

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center">
          <Link href="/" className="text-xl font-bold">
            Trust Token ETF
          </Link>
        </div>
        
        {/* Price Ticker */}
        <PriceTicker />
        
        <div className="flex items-center space-x-4">
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/portfolio" className="text-gray-600 hover:text-gray-900 flex items-center">
              <Briefcase className="mr-1 h-4 w-4" />
              Portfolio
            </Link>
            <Link href="/create-token" className="text-gray-600 hover:text-gray-900">
              Create Token
            </Link>
            <Link href="/prices" className="text-gray-600 hover:text-gray-900 flex items-center">
              <LineChart className="mr-1 h-4 w-4" />
              Prices
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden text-gray-600 hover:text-gray-900"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-gray-200">
          <nav className="flex flex-col">
            <Link 
              href="/dashboard" 
              className="py-3 px-4 text-gray-600 hover:bg-gray-100"
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link 
              href="/portfolio" 
              className="py-3 px-4 text-gray-600 hover:bg-gray-100 flex items-center"
              onClick={() => setIsMenuOpen(false)}
            >
              <Briefcase className="mr-1 h-4 w-4" />
              Portfolio
            </Link>
            <Link 
              href="/create-token" 
              className="py-3 px-4 text-gray-600 hover:bg-gray-100"
              onClick={() => setIsMenuOpen(false)}
            >
              Create Token
            </Link>
            <Link 
              href="/prices" 
              className="py-3 px-4 text-gray-600 hover:bg-gray-100 flex items-center"
              onClick={() => setIsMenuOpen(false)}
            >
              <LineChart className="mr-1 h-4 w-4" />
              Prices
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header; 