"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PortfolioHolding } from "@/services/api.service";
import { ArrowUpRight, TrendingUp, Calendar, DollarSign } from "lucide-react";
import Link from "next/link";

interface PortfolioHoldingCardProps {
  holding: PortfolioHolding;
}

export function PortfolioHoldingCard({ holding }: PortfolioHoldingCardProps) {
  const { tokenInfo, balance, acquisitionDate, acquisitionPrice } = holding;
  
  if (!tokenInfo) {
    return (
      <Card className="p-4 shadow-sm animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-6 bg-gray-300 rounded w-1/2 mb-4"></div>
        <div className="h-20 bg-gray-100 rounded"></div>
      </Card>
    );
  }
  
  // Calcola il valore stimato (per demo usiamo un valore casuale tra 0.8 e 1.2 del prezzo di acquisizione)
  const priceMultiplier = 0.8 + Math.random() * 0.4;
  const currentPrice = acquisitionPrice ? acquisitionPrice * priceMultiplier : 1.0 * priceMultiplier;
  const adjustedBalance = balance / 100; // Divide by 100 to account for 2 decimal places
  const totalValue = adjustedBalance * currentPrice;
  
  // Calcola il rendimento percentuale
  const performancePercent = acquisitionPrice 
    ? ((currentPrice - acquisitionPrice) / acquisitionPrice) * 100 
    : 0;
  
  // Formatta la data di acquisizione
  const formattedDate = new Date(acquisitionDate).toLocaleDateString();
  
  // Visualizza diversi colori a seconda del rendimento
  const performanceColor = performancePercent > 0 
    ? "text-green-600" 
    : performancePercent < 0 
      ? "text-red-600" 
      : "text-gray-600";
  
  const performanceSign = performancePercent > 0 ? "+" : "";
  
  return (
    <Card className="p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-semibold">{tokenInfo.name}</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{tokenInfo.symbol}</Badge>
            <span className="text-xs text-gray-500">{tokenInfo.tokenId}</span>
          </div>
        </div>
        <Link href={`/token/${tokenInfo.tokenId}`}>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      
      <div className="my-3">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>Portfolio Allocation</span>
          <span>{adjustedBalance.toLocaleString()} tokens</span>
        </div>
        <Progress value={75} className="h-1.5" />
      </div>
      
      <div className="grid grid-cols-2 gap-3 my-4">
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 flex items-center">
            <DollarSign className="h-3 w-3 mr-1" />
            Current Value
          </span>
          <span className="font-medium">${totalValue.toFixed(2)}</span>
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 flex items-center">
            <TrendingUp className="h-3 w-3 mr-1" />
            Performance
          </span>
          <span className={`font-medium ${performanceColor}`}>
            {performanceSign}{performancePercent.toFixed(2)}%
          </span>
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 flex items-center">
            <Calendar className="h-3 w-3 mr-1" />
            Acquisition Date
          </span>
          <span className="font-medium">{formattedDate}</span>
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">Price per Token</span>
          <span className="font-medium">${currentPrice.toFixed(2)}</span>
        </div>
      </div>
      
      {tokenInfo.composition && tokenInfo.composition.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <span className="text-xs text-gray-500 mb-1 block">Composition</span>
          <div className="flex flex-wrap gap-1">
            {tokenInfo.composition.slice(0, 3).map((asset, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {asset.label} {asset.allocation}%
              </Badge>
            ))}
            {tokenInfo.composition.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{tokenInfo.composition.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      )}
    </Card>
  );
} 