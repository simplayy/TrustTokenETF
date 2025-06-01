"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Flame } from "lucide-react";

interface BurningAnimationProps {
  isActive: boolean;
  tokenSymbol: string;
  amount: number;
  onComplete?: () => void;
}

export function BurningAnimation({ 
  isActive, 
  tokenSymbol, 
  amount,
  onComplete
}: BurningAnimationProps) {
  const [progress, setProgress] = useState<number>(0);
  const [step, setStep] = useState<number>(1);
  const [showCompletionMessage, setShowCompletionMessage] = useState<boolean>(false);
  
  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      setStep(1);
      setShowCompletionMessage(false);
      return;
    }
    
    // Progress animation - total duration: 4 seconds
    let animationFrame: number;
    const startTime = Date.now();
    const duration = 4000; // 4 seconds
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(100, (elapsed / duration) * 100);
      setProgress(newProgress);
      
      // Update steps based on progress
      if (newProgress >= 25 && step < 2) setStep(2);
      if (newProgress >= 50 && step < 3) setStep(3);
      if (newProgress >= 75 && step < 4) setStep(4);
      
      if (newProgress < 100) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        // Animation complete
        setShowCompletionMessage(true);
        if (onComplete) {
          setTimeout(() => {
            onComplete();
          }, 500);
        }
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [isActive, onComplete, step]);
  
  if (!isActive) return null;
  
  return (
    <Card className="p-4 mb-6 bg-amber-50 border-amber-200">
      <div className="flex items-center mb-2">
        <Flame className="h-5 w-5 text-red-500 animate-pulse mr-2" />
        <h3 className="font-medium text-amber-900">
          {showCompletionMessage 
            ? "Burning Complete" 
            : `Burning ${amount} ${tokenSymbol} Tokens...`}
        </h3>
      </div>
      
      <Progress value={progress} className="h-2 mb-4" 
        // Add gradient color to make it look like fire
        style={{
          background: "linear-gradient(to right, #f87171, #fbbf24)",
          opacity: progress < 100 ? 1 : 0.7
        }}
      />
      
      <div className="space-y-1 text-sm">
        <div className={`flex items-center ${step >= 1 ? "text-amber-900" : "text-gray-400"}`}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center mr-2 bg-amber-100 border border-amber-200">
            {step > 1 ? "✓" : "1"}
          </div>
          <span>{step > 1 ? "Tokens received from wallet" : "Receiving tokens from wallet..."}</span>
        </div>
        
        <div className={`flex items-center ${step >= 2 ? "text-amber-900" : "text-gray-400"}`}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center mr-2 bg-amber-100 border border-amber-200">
            {step > 2 ? "✓" : "2"}
          </div>
          <span>{step > 2 ? "Burning token supply" : "Burning token supply..."}</span>
        </div>
        
        <div className={`flex items-center ${step >= 3 ? "text-amber-900" : "text-gray-400"}`}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center mr-2 bg-amber-100 border border-amber-200">
            {step > 3 ? "✓" : "3"}
          </div>
          <span>{step > 3 ? "Releasing collateral" : "Releasing collateral..."}</span>
        </div>
        
        <div className={`flex items-center ${step >= 4 ? "text-amber-900" : "text-gray-400"}`}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center mr-2 bg-amber-100 border border-amber-200">
            {step > 4 ? "✓" : "4"}
          </div>
          <span>{step > 4 ? "Transaction confirmed" : "Confirming transaction..."}</span>
        </div>
      </div>
      
      {showCompletionMessage && (
        <div className="mt-4 pt-3 border-t border-amber-200 text-sm text-amber-900">
          <p>All operations completed successfully. Your collateral has been returned to your account.</p>
        </div>
      )}
    </Card>
  );
} 