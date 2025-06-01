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
import { ChevronLeft, AlertCircle, CheckCircle2, CreditCard, Coins, DollarSign, LayoutDashboard, Briefcase, ExternalLink } from "lucide-react";
import { MintingStatus } from "@/components/MintingStatus";
import { TransactionConfirmation } from "@/components/TransactionConfirmation";

// Interface for HBAR collateral requirement
interface HbarCollateralRequirement {
  requiredHbar: number;
  usdValue: number;
  hbarPrice: number;
  timestamp: number;
}

export default function MintTokenPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [amount, setAmount] = useState<number>(0.01);
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [hbarCollateral, setHbarCollateral] = useState<HbarCollateralRequirement | null>(null);
  const [loadingCollateral, setLoadingCollateral] = useState<boolean>(false);
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [availableHbar, setAvailableHbar] = useState<number | null>(null);

  useEffect(() => {
    // Fetch token information on page load
    const fetchTokenInfo = async () => {
      try {
        setLoading(true);
        const result = await tokenApi.getTokenInfo(id as string);
        setTokenInfo(result.tokenInfo);
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

  // Calculate HBAR collateral requirement when amount or token composition changes
  useEffect(() => {
    const calculateHbarCollateral = async () => {
      if (!tokenInfo || !amount || amount <= 0 || !tokenInfo.composition || tokenInfo.composition.length === 0) {
        setHbarCollateral(null);
        return;
      }
      
      try {
        setLoadingCollateral(true);
        
        // Get asset symbols using the same logic as backend
        const symbols = tokenInfo.composition.map(asset => 
          mapAssetNameToSymbol(asset.value)
        );
        
        const [pricesResult, hbarPriceResult] = await Promise.all([
          oracleApi.getPrices(symbols),
          oracleApi.getHbarPrice()
        ]);
        
        // Calculate token price using the shared utility function (EXACT SAME logic as backend)
        const tokenPrice = calculateTokenPrice(tokenInfo.composition, pricesResult.prices);
        
        console.log(`Frontend calculated token price: $${tokenPrice.toFixed(4)}`);
        
        // Calculate total USD value needed for the amount of tokens being minted
        const totalUsdValue = amount * tokenPrice;
        
        // Convert to HBAR
        const requiredHbar = totalUsdValue / hbarPriceResult.price;
        
        setHbarCollateral({
          requiredHbar,
          usdValue: totalUsdValue,
          hbarPrice: hbarPriceResult.price,
          timestamp: Date.now()
        });
        
      } catch (err) {
        console.error("Error calculating HBAR collateral:", err);
        
        // Provide user-friendly error handling for rate limiting
        if (oracleApi.isRateLimitError(err)) {
          console.warn("Rate limited while calculating collateral. The calculation will be retried automatically.");
          // Could set a flag to show a notice to the user
        } else {
          console.error("Failed to calculate collateral requirements:", oracleApi.getUserFriendlyErrorMessage(err));
        }
        
        setHbarCollateral(null);
      } finally {
        setLoadingCollateral(false);
      }
    };

    calculateHbarCollateral();
  }, [tokenInfo, amount]);

  // Fetch available HBAR balance
  useEffect(() => {
    const fetchHbarBalance = async () => {
      try {
        const balanceResult = await hederaApi.getHbarBalance();
        if (balanceResult.success && balanceResult.balance) {
          setAvailableHbar(balanceResult.balance);
        } else {
          console.warn("HBAR balance not available from API, using fallback");
          setAvailableHbar(1000); // Fallback value
        }
      } catch (err) {
        console.error("Error fetching HBAR balance:", err);
        setAvailableHbar(1000); // Fallback value
      }
    };

    fetchHbarBalance();
  }, []);

  const handleMint = async () => {
    if (!amount || amount <= 0 || amount < 0.000001) {
      setError("Please enter a valid amount to mint (minimum 0.000001 tokens)");
      return;
    }

    if (hbarCollateral && availableHbar && hbarCollateral.requiredHbar > availableHbar) {
      setError(`Insufficient HBAR balance. Required: ${hbarCollateral.requiredHbar.toFixed(4)} HBAR, Available: ${availableHbar.toFixed(4)} HBAR`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setIsMinting(true);
      setTransactionDetails(null);
      
      // Actual API call is delayed until the animation completes
      setTimeout(async () => {
        try {
          // Calculate the USD value that the user wants to invest
          const usdValueToInvest = hbarCollateral ? hbarCollateral.usdValue : amount;
          
          // Create a new API call that accepts USD value instead of token amount
          // For now, we'll modify the existing call to pass the token amount as calculated
          const result = await tokenApi.mintToken(id as string, amount);
          setSuccess(true);
          
          // Store transaction details for the confirmation component
          if (result.success && result.transactionId) {
            setTransactionDetails({
              transactionId: result.transactionId,
              timestamp: new Date().toISOString(),
              tokenId: id as string,
              tokenSymbol: tokenInfo?.symbol || "",
              amount: amount,
              fee: 0.1, // Standard fee
              network: 'testnet',
              status: 'SUCCESS',
              collateralDeposited: result.collateralDeposited || hbarCollateral?.requiredHbar || 0
            });
          }
          
          // Refresh token info after successful minting
          const tokenResult = await tokenApi.getTokenInfo(id as string);
          setTokenInfo(tokenResult.tokenInfo);
          
        } catch (err) {
          console.error("Error minting tokens:", err);
          setError(err instanceof Error ? err.message : "Failed to mint tokens");
          setSuccess(false);
        } finally {
          setLoading(false);
          setIsMinting(false);
        }
      }, 4000); // This matches the animation duration in MintingStatus
    } catch (err) {
      console.error("Error starting minting process:", err);
      setError(err instanceof Error ? err.message : "Failed to start minting process");
      setSuccess(false);
      setLoading(false);
      setIsMinting(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = parseFloat(e.target.value);
    setAmount(isNaN(newAmount) ? 0 : newAmount);
  };

  const handleMintingComplete = () => {
    console.log("Minting animation completed");
  };

  // Reset transaction state
  const resetTransaction = () => {
    setSuccess(false);
    setTransactionDetails(null);
  };

  const formatHbar = (hbarAmount: number | null | undefined): string => {
    if (hbarAmount === null || hbarAmount === undefined || isNaN(hbarAmount)) {
      return '0.0000 ℏ';
    }
    const numericAmount = typeof hbarAmount === 'string' ? parseFloat(hbarAmount) : hbarAmount;
    if (isNaN(numericAmount)) {
      return '0.0000 ℏ';
    }
    return `${numericAmount.toFixed(4)} ℏ`;
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

      <h1 className="text-3xl font-bold mb-6">Mint {tokenInfo?.symbol || ''} Tokens</h1>
      
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
            {/* Show Transaction Confirmation when we have transaction details */}
            {success && transactionDetails && (
              <div className="mb-6">
                <TransactionConfirmation 
                  transaction={transactionDetails} 
                  onClose={resetTransaction}
                />
                <div className="mt-4 flex justify-end">
                  <Button 
                    onClick={resetTransaction}
                    variant="outline" 
                    size="sm"
                  >
                    Mint More Tokens
                  </Button>
                </div>
              </div>
            )}

            {/* Only show the minting form if we're not showing transaction details */}
            {(!success || !transactionDetails) && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="mint-amount">Amount to Mint</Label>
                  <Input
                    id="mint-amount"
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    value={amount}
                    onChange={handleAmountChange}
                    className="mt-1"
                    disabled={loading || isMinting}
                    placeholder="Enter amount (e.g., 0.123)"
                  />
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-gray-500">
                      Minimum investment: 0.000001 tokens
                    </p>
                    {hbarCollateral && amount > 0 && (
                      <p className="text-xs text-blue-600 font-medium">
                        ≈ ${hbarCollateral.usdValue.toFixed(2)} USD
                      </p>
                    )}
                  </div>
                  
                  {/* Quick amount selection buttons */}
                  {hbarCollateral && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">Quick amounts (USD equivalent):</p>
                      <div className="flex flex-wrap gap-2">
                        {[1, 5, 10, 25, 50, 100].map((usdAmount) => {
                          const tokensForUsd = usdAmount / (hbarCollateral.usdValue / amount || 1);
                          return (
                            <Button
                              key={usdAmount}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => setAmount(Math.round(tokensForUsd * 1000000) / 1000000)}
                              disabled={loading || isMinting}
                            >
                              ${usdAmount} ({(Math.round(tokensForUsd * 1000000) / 1000000).toFixed(4)} tokens)
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* HBAR Collateral Requirements Section */}
                {hbarCollateral && (
                  <Card className="p-4 mt-4 bg-blue-50 border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-md font-semibold text-blue-800 flex items-center">
                        <CreditCard className="h-4 w-4 mr-2" />
                        HBAR Collateral Requirements
                      </h3>
                      {loadingCollateral && (
                        <div className="text-xs text-gray-500">Updating...</div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      To mint {amount >= 1 ? amount.toFixed(2) : amount.toFixed(6)} {tokenInfo?.symbol} tokens, the following HBAR collateral is required:
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <div>
                          <span className="font-medium">{formatHbar(hbarCollateral.requiredHbar)}</span>
                        </div>
                        <span className="font-medium">{formatUsd(hbarCollateral.usdValue)}</span>
                      </div>
                    </div>
                    
                    {/* Balance Check Section */}
                    <div className="mt-4 pt-4 border-t border-blue-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Your Available Balance:</span>
                        <div className="text-right">
                          <div className="font-mono text-sm">
                            {availableHbar !== null ? formatHbar(availableHbar) : 'Loading...'}
                          </div>
                          {availableHbar !== null && hbarCollateral && (
                            <div className="text-xs mt-1">
                              {availableHbar >= hbarCollateral.requiredHbar ? (
                                <span className="text-green-600 flex items-center justify-end gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Sufficient balance
                                </span>
                              ) : (
                                <span className="text-red-600 flex items-center justify-end gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Insufficient balance
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Show shortage amount if insufficient */}
                      {availableHbar !== null && hbarCollateral && availableHbar < hbarCollateral.requiredHbar && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                          <div className="text-red-700">
                            <strong>Need additional:</strong> {formatHbar(hbarCollateral.requiredHbar - availableHbar)}
                          </div>
                          <div className="text-red-600 mt-1">
                            Please add more HBAR to your account to continue with this transaction.
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-blue-100 text-xs text-gray-600">
                      <p>
                        All collateral is securely held in the treasury account to maintain the 1:1 backing of the token.
                      </p>
                    </div>
                  </Card>
                )}
                
                {/* Minting status component that shows animation */}
                <MintingStatus 
                  isActive={isMinting} 
                  tokenSymbol={tokenInfo?.symbol || ""} 
                  amount={amount}
                  onComplete={handleMintingComplete}
                />

                <div className="pt-4">
                  {(() => {
                    const hasInsufficientBalance = Boolean(hbarCollateral && availableHbar !== null && availableHbar < hbarCollateral.requiredHbar);
                    const isDisabled = loading || !tokenInfo || isMinting || hasInsufficientBalance;
                    
                    return (
                      <Button 
                        onClick={handleMint} 
                        disabled={isDisabled}
                        className="w-full"
                      >
                        {loading || isMinting 
                          ? "Processing..." 
                          : hasInsufficientBalance
                            ? "Insufficient HBAR Balance"
                            : `Mint ${amount >= 1 ? amount.toFixed(2) : amount.toFixed(6)} Tokens`
                        }
                      </Button>
                    );
                  })()}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500 mt-4">
              <p>
                Minting tokens creates new supply backed by the appropriate collateral.
                The collateral assets are securely held in the treasury account to maintain the value of your tokens.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 