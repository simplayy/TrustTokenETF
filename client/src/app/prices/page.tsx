'use client';

import { useState } from 'react';
import { PriceGrid } from '@/components/PriceGrid';
import { PriceChart } from '@/components/PriceChart';
import { TokenPriceCard } from '@/components/TokenPriceCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ChartBarIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

export default function PricesPage() {
  const featuredAssets = ['BTC', 'ETH', 'AAPL', 'GOLD'];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <ChartBarIcon className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Live Asset Prices
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Real-time price feeds for all asset classes supported by our ETF platform. 
          Monitor cryptocurrencies, stocks, commodities, forex, ETFs, and bonds.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Badge variant="outline" className="text-xs">
            <CurrencyDollarIcon className="h-3 w-3 mr-1" />
            Real-time Data
          </Badge>
          <Badge variant="outline" className="text-xs">
            6 Asset Classes
          </Badge>
          <Badge variant="outline" className="text-xs">
            35+ Assets
          </Badge>
        </div>
      </div>

      {/* Featured Charts */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Featured Assets</h2>
          <p className="text-muted-foreground">
            Key assets across different categories with 7-day price history
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {featuredAssets.map((asset) => (
            <PriceChart 
              key={asset} 
              asset={asset} 
              days={7} 
              height={250}
            />
          ))}
        </div>
      </div>

      {/* All Assets Grid */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">All Available Assets</h2>
          <p className="text-muted-foreground">
            Browse all supported assets organized by category
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CurrencyDollarIcon className="h-5 w-5" />
              Asset Price Grid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PriceGrid 
              columns={4}
              refreshInterval={30000} // 30 seconds
              filterByType={true}
            />
          </CardContent>
        </Card>
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Sources</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• <strong>Cryptocurrencies:</strong> CoinGecko API</p>
            <p>• <strong>Stocks & ETFs:</strong> Mock data (production would use financial APIs)</p>
            <p>• <strong>Commodities:</strong> Mock data with realistic price movements</p>
            <p>• <strong>Forex & Bonds:</strong> Mock data based on market trends</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Update Frequency</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• <strong>Price Cards:</strong> Every 30 seconds</p>
            <p>• <strong>Charts:</strong> Updated on page load</p>
            <p>• <strong>Cache Duration:</strong> 5 minutes</p>
            <p>• <strong>Fallback:</strong> Mock data when APIs unavailable</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Asset Categories</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-orange-500 hover:bg-orange-600">crypto</Badge>
              <span>13 assets</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500 hover:bg-blue-600">stock</Badge>
              <span>10 assets</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-500 hover:bg-yellow-600">commodity</Badge>
              <span>4 assets</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500 hover:bg-green-600">forex</Badge>
              <span>3 pairs</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-500 hover:bg-purple-600">etf</Badge>
              <span>3 funds</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-gray-500 hover:bg-gray-600">bond</Badge>
              <span>2 bonds</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 