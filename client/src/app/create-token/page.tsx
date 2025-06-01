"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AssetSelector, Asset } from "@/components/ui/asset-selector";
import { PercentageAllocation } from "@/components/ui/percentage-allocation";
import { tokenApi } from "@/services/api.service";
import Link from "next/link";
import { Briefcase, LayoutDashboard } from "lucide-react";

export default function CreateToken() {
  const router = useRouter();
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const addAsset = (asset: Asset) => {
    setSelectedAssets((prev) => [
      ...prev,
      { ...asset, allocation: 0 }
    ]);
  };

  const updateAssets = (assets: Asset[]) => {
    setSelectedAssets(assets);
  };

  const removeAsset = (assetValue: string) => {
    setSelectedAssets((prev) => 
      prev.filter((asset) => asset.value !== assetValue)
    );
  };

  const totalAllocation = selectedAssets.reduce(
    (sum, asset) => sum + (asset.allocation || 0),
    0
  );
  
  const isFormValid = tokenName && tokenSymbol && totalAllocation === 100 && selectedAssets.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    
    setIsSubmitting(true);
    setErrorMessage("");
    
    try {
      // Call API to create token
      const result = await tokenApi.createToken({
        name: tokenName,
        symbol: tokenSymbol,
        composition: selectedAssets
      });

      // Show success message
      setSuccessMessage(`Token "${tokenName}" created successfully! Token ID: ${result.tokenId}`);
      
      // Reset form after 5 seconds and redirect to dashboard
      setTimeout(() => {
        setSuccessMessage("");
        setTokenName("");
        setTokenSymbol("");
        setSelectedAssets([]);
        router.push(`/token/${result.tokenId}`);
      }, 5000);
    } catch (error) {
      console.error("Error creating token:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to create token. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setTokenName("");
    setTokenSymbol("");
    setSelectedAssets([]);
    setErrorMessage("");
  };

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Create ETF Token</h1>
        <div className="flex gap-2">
          <Link href="/dashboard">
            <Button variant="outline" className="flex items-center gap-2">
              <LayoutDashboard size={16} />
              Dashboard
            </Button>
          </Link>
          <Link href="/portfolio">
            <Button variant="outline" className="flex items-center gap-2">
              <Briefcase size={16} />
              My Portfolio
            </Button>
          </Link>
        </div>
      </div>
      <p className="text-slate-600 mb-8">Create your custom ETF token by selecting assets and their allocation percentages.</p>
      
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-md border border-green-200">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
          {errorMessage}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-8">
        <h2 className="text-xl font-semibold mb-4">Token Configuration</h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="tokenName" className="block text-sm font-medium">
                Token Name
              </label>
              <input
                id="tokenName"
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="e.g. Tech Giants ETF"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="tokenSymbol" className="block text-sm font-medium">
                Token Symbol
              </label>
              <input
                id="tokenSymbol"
                type="text"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                className="w-full p-2 border rounded-md"
                placeholder="e.g. TECH"
                maxLength={5}
              />
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Add Assets</h3>
          <AssetSelector 
            onSelect={addAsset} 
            selectedAssets={selectedAssets} 
          />
        </div>
        
        <PercentageAllocation 
          assets={selectedAssets}
          onUpdate={updateAssets}
          onRemove={removeAsset}
        />
        
        <div className="pt-4 flex justify-end space-x-3">
          <Button 
            type="button"
            variant="outline"
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button 
            type="submit"
            disabled={!isFormValid || isSubmitting} 
            className={isSubmitting ? "opacity-70 cursor-not-allowed" : ""}
          >
            {isSubmitting ? "Creating Token..." : "Create Token"}
          </Button>
        </div>
      </form>
    </div>
  );
} 