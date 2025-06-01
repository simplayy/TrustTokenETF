"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PriceGrid } from "@/components/PriceGrid";

export default function Home() {
  return (
    <div className="flex flex-col items-center min-h-screen">
      <main className="flex-1 w-full max-w-7xl flex flex-col items-center justify-center py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Decentralized ETF Platform</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Create, manage, and trade custom ETFs powered by Hedera's secure distributed ledger technology.
          </p>
        </div>

        {/* Live Market Prices Section */}
        <div className="w-full max-w-6xl mb-12">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-semibold mb-2">Live Market Prices</h3>
            <p className="text-slate-600">Real-time asset prices for your ETF compositions</p>
          </div>
          <PriceGrid 
            assets={['BTC', 'ETH', 'HBAR', 'SOL', 'ADA', 'DOT']}
            refreshInterval={30000}
            columns={3}
            filterByType={false}
          />
          <div className="text-center mt-4">
            <Link href="/prices">
              <Button variant="outline">View All Prices & Charts</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Create Custom ETFs</h3>
            <p className="text-slate-600 mb-4">
              Design your own ETF with custom asset allocation percentages.
            </p>
            <Link href="/create-token">
              <Button variant="outline" className="w-full">Get Started</Button>
            </Link>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Mint & Burn Tokens</h3>
            <p className="text-slate-600 mb-4">
              Easily mint new tokens or burn existing ones with automated collateral management.
            </p>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full">Learn More</Button>
            </Link>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Real-time Tracking</h3>
            <p className="text-slate-600 mb-4">
              Monitor your ETF performance with real-time price data and analytics.
            </p>
            <Link href="/portfolio">
              <Button variant="outline" className="w-full">View Dashboard</Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="w-full max-w-7xl py-8 border-t mt-12">
        <div className="text-center text-slate-500">
          <p>© 2023 Trust Token ETF Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
