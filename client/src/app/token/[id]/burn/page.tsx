"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { tokenApi, TokenInfo, hederaApi } from "@/services/api.service";
import { oracleApi } from "@/services/oracle.service";
import { mapAssetNameToSymbol, calculateTokenPrice } from "@/utils/asset-mapping";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChevronLeft, AlertCircle, CheckCircle2, Flame, Coins, DollarSign, LayoutDashboard, Briefcase, ExternalLink, Info } from "lucide-react";
import { BurningAnimation } from "@/components/BurningAnimation";

// Interface for HBAR collateral release calculation
interface HbarCollateralRelease {
  hbarToRelease: number;
  usdValue: number;
  hbarPrice: number;
  timestamp: number;
}

// Interface for token burn result
interface TokenBurnResult {
  success: boolean;
  transactionId?: string;
  collateralTransactionId?: string;
  message?: string;
  collateralReleased?: number;
  fee?: number;
  network?: string;
}

export default function BurnTokenPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [amount, setAmount] = useState<number>(0.01);
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [maxBurnAmount, setMaxBurnAmount] = useState<number>(0);
  const [isBurning, setIsBurning] = useState<boolean>(false);
  const [burnResult, setBurnResult] = useState<TokenBurnResult | null>(null);
  const [accountBalance, setAccountBalance] = useState<number>(0);
  const [hbarCollateralRelease, setHbarCollateralRelease] = useState<HbarCollateralRelease | null>(null);
  const [loadingCollateral, setLoadingCollateral] = useState<boolean>(false);

  useEffect(() => {
    // Fetch token information on page load
    const fetchTokenInfo = async () => {
      try {
        setLoading(true);
        const result = await tokenApi.getTokenInfo(id as string);
        setTokenInfo(result.tokenInfo);
        
        // Get real account balance for this token
        try {
          const balanceResult = await tokenApi.getTokenBalance(id as string);
          if (balanceResult.success) {
            // Use 6 decimals instead of 2
            const decimals = result.tokenInfo.decimals || 6;
            const accountBal = parseFloat(balanceResult.formattedBalance);
            setAccountBalance(accountBal);
            
            // Set max burnable to the account balance
            setMaxBurnAmount(accountBal);
            
            // Set default amount to smaller value suitable for micro-investments
            const defaultAmount = Math.min(accountBal * 0.1, 0.01);
            setAmount(defaultAmount > 0.000001 ? defaultAmount : 0.000001);
          } else {
            console.error("Error getting account balance:", balanceResult);
            // Fallback to old logic with 6 decimals
            const decimals = result.tokenInfo.decimals || 6;
            const totalSupply = parseInt(result.tokenInfo.totalSupply) / Math.pow(10, decimals);
            const simulatedBalance = totalSupply * 0.5;
            setAccountBalance(simulatedBalance);
            setMaxBurnAmount(simulatedBalance);
            const defaultAmount = Math.min(simulatedBalance * 0.1, 0.01);
            setAmount(defaultAmount > 0.000001 ? defaultAmount : 0.000001);
          }
        } catch (balanceErr) {
          console.error("Error fetching account balance:", balanceErr);
          // Fallback to old logic with 6 decimals
          const decimals = result.tokenInfo.decimals || 6;
          const totalSupply = parseInt(result.tokenInfo.totalSupply) / Math.pow(10, decimals);
          const simulatedBalance = totalSupply * 0.5;
          setAccountBalance(simulatedBalance);
          setMaxBurnAmount(simulatedBalance);
          const defaultAmount = Math.min(simulatedBalance * 0.1, 0.01);
          setAmount(defaultAmount > 0.000001 ? defaultAmount : 0.000001);
        }
        
        setError(null);
      } catch (err) {
        console.error("Error fetching token info:", err);
        setError(err instanceof Error ? err.message : "Failed to load token information");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchTokenInfo();
    }
  }, [id]);

  // Calculate HBAR collateral release when amount or token composition changes
  useEffect(() => {
    const calculateHbarCollateralRelease = async () => {
      if (!tokenInfo || !amount || amount <= 0 || !tokenInfo.composition || tokenInfo.composition.length === 0) {
        setHbarCollateralRelease(null);
        return;
      }
      
      try {
        setLoadingCollateral(true);
        
        // Use the SAME asset mapping logic as mint page and backend
        const symbols = tokenInfo.composition.map(asset => 
          mapAssetNameToSymbol(asset.value)
        );
        
        const [pricesResult, hbarPriceResult] = await Promise.all([
          oracleApi.getPrices(symbols),
          oracleApi.getHbarPrice()
        ]);
        
        // Calculate token price using the shared utility function (EXACT SAME logic as backend)
        const tokenPrice = calculateTokenPrice(tokenInfo.composition, pricesResult.prices);
        
        console.log(`Burn page calculated token price: $${tokenPrice.toFixed(4)}`);
        
        // Calculate total USD value to be released (token amount × token price)
        const totalUsdValue = amount * tokenPrice;
        
        // Convert to HBAR
        const hbarToRelease = totalUsdValue / hbarPriceResult.price;
        
        setHbarCollateralRelease({
          hbarToRelease,
          usdValue: totalUsdValue,
          hbarPrice: hbarPriceResult.price,
          timestamp: Date.now()
        });
        
      } catch (err) {
        console.error("Error calculating HBAR collateral release:", err);
        
        // Provide user-friendly error handling for rate limiting
        if (oracleApi.isRateLimitError(err)) {
          console.warn("Rate limited while calculating collateral release. The calculation will be retried automatically.");
        } else {
          console.error("Failed to calculate collateral release:", oracleApi.getUserFriendlyErrorMessage(err));
        }
        
        setHbarCollateralRelease(null);
      } finally {
        setLoadingCollateral(false);
      }
    };

    calculateHbarCollateralRelease();
  }, [tokenInfo, amount]);

  const handleBurn = async () => {
    if (!amount || amount <= 0 || amount < 0.000001) {
      setError("Please enter a valid amount to burn (minimum 0.000001 tokens)");
      return;
    }

    if (amount > maxBurnAmount) {
      setError(`Cannot burn more than your available balance (${maxBurnAmount >= 1 ? maxBurnAmount.toFixed(2) : maxBurnAmount.toFixed(6)})`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setIsBurning(true);
      
      // In a real implementation, you would call the API after the animation is complete
      // The animation component will trigger onComplete after 4 seconds
      
    } catch (err) {
      console.error("Error burning tokens:", err);
      setError(err instanceof Error ? err.message : "Failed to burn tokens");
      setSuccess(false);
      setLoading(false);
      setIsBurning(false);
    }
  };

  const handleBurningComplete = () => {
    // This is called when the burning animation completes
    // Now we actually perform the token burn
    setTimeout(async () => {
      try {
        // Call the actual API to burn tokens
        const result = await tokenApi.burnToken(id as string, amount);
        setBurnResult(result);
        
        if (tokenInfo) {
          const adjustedTokenInfo = {...tokenInfo};
          const decimals = tokenInfo.decimals || 6;
          const newSupply = Math.max(0, parseInt(adjustedTokenInfo.totalSupply) - (amount * Math.pow(10, decimals)));
          adjustedTokenInfo.totalSupply = newSupply.toString();
          setTokenInfo(adjustedTokenInfo);
          setMaxBurnAmount(newSupply / Math.pow(10, decimals));
        }
        
        setSuccess(true);
      } catch (err) {
        console.error("Error burning tokens:", err);
        setError(err instanceof Error ? err.message : "Failed to burn tokens");
        setSuccess(false);
      } finally {
        setLoading(false);
        setIsBurning(false);
      }
    }, 500);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = parseFloat(e.target.value);
    setAmount(isNaN(newAmount) ? 0 : newAmount);
  };

  const formatHbar = (amount: number): string => {
    return `${amount.toFixed(4)} ℏ`;
  };

  const formatUsd = (amount: number): string => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <Link href={`/token/${id}`} className="text-blue-600 hover:text-blue-800 flex items-center">
          <ChevronLeft size={16} />
          <span>Back to Token Details</span>
        </Link>
        <div className="flex gap-2">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <LayoutDashboard size={16} />
              Dashboard
            </Button>
          </Link>
          <Link href="/portfolio">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Briefcase size={16} />
              Portfolio
            </Button>
          </Link>
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-6">Burn {tokenInfo?.symbol || ''} Tokens</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
        {loading && !tokenInfo ? (
          <div className="text-center py-8">
            <div className="animate-pulse text-gray-500">Loading token information...</div>
          </div>
        ) : error && !success ? (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Burning Animation Component */}
            <BurningAnimation 
              isActive={isBurning} 
              tokenSymbol={tokenInfo?.symbol || ""} 
              amount={amount}
              onComplete={handleBurningComplete}
            />
          
            {success ? (
              <div className="rounded-lg bg-green-50 p-6 text-green-800 border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Burn Successful</h3>
                </div>
                <p className="mb-4">
                  You have successfully burned {amount >= 1 ? amount.toFixed(2) : amount.toFixed(6)} {tokenInfo?.symbol || ''} tokens.
                  The token supply has been reduced and the collateral has been released.
                </p>
                <div className="mt-4 pt-4 border-t border-green-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">New Total Supply:</span>
                    <span className="font-medium">{(parseInt(tokenInfo?.totalSupply || "0") / Math.pow(10, tokenInfo?.decimals || 6)).toLocaleString()} {tokenInfo?.symbol || ''}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Burned Amount:</span>
                    <span className="font-medium">{amount >= 1 ? amount.toFixed(2) : amount.toFixed(6)} {tokenInfo?.symbol || ''}</span>
                  </div>
                  {burnResult && (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Transaction ID:</span>
                        <span className="font-medium text-xs truncate max-w-[200px]">{burnResult.transactionId}</span>
                      </div>
                      {burnResult.collateralTransactionId && (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm">Collateral Release Transaction:</span>
                          <span className="font-medium text-xs truncate max-w-[200px]">{burnResult.collateralTransactionId}</span>
                        </div>
                      )}
                      {burnResult.collateralReleased && (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm">HBAR Released:</span>
                          <span className="font-medium">{burnResult.collateralReleased.toFixed(4)} ℏ</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Network Fee:</span>
                        <span className="font-medium">{burnResult.fee ? burnResult.fee.toFixed(8) : '0.00000000'} HBAR</span>
                      </div>
                      {burnResult.message && (
                        <div className="mt-2 text-sm text-gray-600">
                          {burnResult.message}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {burnResult && burnResult.network === 'testnet' && (
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <a 
                      href={`https://hashscan.io/testnet/transaction/${burnResult.transactionId}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
                    >
                      <span>View transaction on HashScan</span>
                      <ExternalLink size={14} className="ml-1" />
                    </a>
                  </div>
                )}
                <div className="mt-4 flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setSuccess(false)}>
                    Burn More Tokens
                  </Button>
                  <Link href={`/token/${id}`}>
                    <Button>
                      Back to Token Details
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 mb-4">
                  <div className="flex gap-2 items-start">
                    <Info className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-amber-800 mb-1">About Burning Tokens</h3>
                      <p className="text-sm text-amber-700">
                        Burning tokens permanently removes them from circulation. The corresponding collateral will be
                        released from the treasury and returned based on the token's composition.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="burn-amount">Amount to Burn</Label>
                  <Input
                    id="burn-amount"
                    type="number"
                    min="0.000001"
                    step="0.0001"
                    max={maxBurnAmount}
                    value={amount}
                    onChange={handleAmountChange}
                    className="mt-1"
                    disabled={loading || isBurning}
                    placeholder="Enter amount (e.g., 0.001)"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Available to burn: {accountBalance >= 1 ? accountBalance.toFixed(2) : accountBalance.toFixed(6)} {tokenInfo?.symbol || ''} tokens (minimum: 0.000001)
                  </p>
                  
                  {/* Quick Amount Buttons */}
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Quick amounts:</p>
                    <div className="flex gap-2 flex-wrap">
                      {[0.001, 0.01, 0.1, 1].map((quickAmount) => (
                        quickAmount <= maxBurnAmount && (
                          <Button
                            key={quickAmount}
                            variant="outline"
                            size="sm"
                            onClick={() => setAmount(quickAmount)}
                            disabled={loading || isBurning}
                            className="text-xs"
                          >
                            {quickAmount >= 1 ? quickAmount.toFixed(0) : quickAmount.toFixed(3)}
                          </Button>
                        )
                      ))}
                      {maxBurnAmount > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAmount(maxBurnAmount)}
                          disabled={loading || isBurning}
                          className="text-xs"
                        >
                          Max
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* HBAR Collateral Release Section */}
                {hbarCollateralRelease && (
                  <Card className="p-4 mt-4 bg-orange-50 border-orange-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-md font-semibold text-orange-800 flex items-center">
                        <Coins className="h-4 w-4 mr-2" />
                        HBAR Collateral Release
                      </h3>
                      {loadingCollateral && (
                        <div className="text-xs text-gray-500">Updating...</div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Burning {amount >= 1 ? amount.toFixed(2) : amount.toFixed(6)} {tokenInfo?.symbol} tokens will release the following HBAR collateral:
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <div>
                          <span className="font-medium">{formatHbar(hbarCollateralRelease.hbarToRelease)}</span>
                        </div>
                        <span className="font-medium">{formatUsd(hbarCollateralRelease.usdValue)}</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-orange-100 text-xs text-gray-600">
                      <p>
                        The HBAR collateral will be released from the treasury account and transferred to your account.
                      </p>
                    </div>
                  </Card>
                )}

                <div className="pt-4">
                  <Button 
                    onClick={handleBurn} 
                    disabled={loading || !tokenInfo || isBurning || amount > maxBurnAmount}
                    className="w-full"
                    variant="destructive"
                  >
                    {loading || isBurning ? "Processing..." : `Burn ${amount >= 1 ? amount.toFixed(2) : amount.toFixed(6)} Tokens`}
                  </Button>
                </div>
                
                <div className="text-xs text-gray-500 mt-4">
                  <p>
                    Burning tokens is irreversible. The tokens will be permanently removed from circulation
                    and the corresponding collateral will be returned to your account.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}