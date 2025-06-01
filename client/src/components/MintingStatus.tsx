"use client";

import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface MintingStatusProps {
  isActive: boolean;
  tokenSymbol: string;
  amount: number;
  onComplete?: () => void;
}

export function MintingStatus({
  isActive,
  tokenSymbol,
  amount,
  onComplete
}: MintingStatusProps) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'preparing' | 'minting' | 'finalizing' | 'complete'>('preparing');
  
  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      setStage('preparing');
      return;
    }
    
    // Simulate minting progress through different stages
    setProgress(0);
    setStage('preparing');
    
    const timer1 = setTimeout(() => {
      setProgress(20);
      setStage('minting');
    }, 1000);
    
    const timer2 = setTimeout(() => {
      setProgress(60);
    }, 2000);
    
    const timer3 = setTimeout(() => {
      setProgress(80);
      setStage('finalizing');
    }, 3000);
    
    const timer4 = setTimeout(() => {
      setProgress(100);
      setStage('complete');
      if (onComplete) onComplete();
    }, 4000);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [isActive, onComplete]);
  
  if (!isActive) return null;
  
  return (
    <div className="mt-4 p-4 border rounded-md bg-blue-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {stage !== 'complete' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
          <h3 className="text-sm font-medium text-blue-800">
            {stage === 'preparing' && 'Preparing Transaction...'}
            {stage === 'minting' && 'Minting in Progress...'}
            {stage === 'finalizing' && 'Finalizing Transaction...'}
            {stage === 'complete' && 'Minting Complete!'}
          </h3>
        </div>
        <span className="text-xs font-medium">{progress}%</span>
      </div>
      
      <Progress value={progress} className="h-2" />
      
      <div className="mt-2 text-xs text-gray-600">
        {stage === 'preparing' && `Preparing to mint ${amount} ${tokenSymbol} tokens...`}
        {stage === 'minting' && `Creating ${amount} new ${tokenSymbol} tokens on the Hedera network...`}
        {stage === 'finalizing' && `Confirming transaction and updating token supply...`}
        {stage === 'complete' && `Successfully minted ${amount} ${tokenSymbol} tokens!`}
      </div>
    </div>
  );
} 