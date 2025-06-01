import { 
  Client, 
  AccountId, 
  PrivateKey, 
  AccountBalanceQuery,
  TokenId,
  TransferTransaction,
  Hbar
} from "@hashgraph/sdk";
import config from "../config";
import { hederaService } from "./hedera.service";
import { AssetComposition } from "./token.service";
import axios from "axios";

// Interface for collateral record
export interface CollateralRecord {
  tokenId: string;
  assets: CollateralAsset[];
  timestamp: string;
  transactionId?: string;
}

// Interface for specific collateral asset
export interface CollateralAsset {
  assetId: string;
  assetType: 'HBAR' | 'TOKEN' | 'NFT';
  label: string;
  amount: number;
  usdValue?: number; // USD value of the asset
  hbarEquivalent?: number; // HBAR equivalent for the asset
}

/**
 * Blockchain-Based Collateral Service
 * Fetches real collateral data from Hedera blockchain
 */
class CollateralService {
  private client: Client | null = null;
  private accountId: string;
  private privateKey: string;
  private treasuryId: string;
  private treasuryKey: string;
  
  // Keep minimal in-memory cache for performance (not persistence)
  private collateralCache: Map<string, { records: CollateralRecord[], lastFetch: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds cache

  constructor() {
    this.accountId = config.hedera.accountId;
    this.privateKey = config.hedera.privateKey;
    this.treasuryId = config.hedera.treasuryId;
    this.treasuryKey = config.hedera.treasuryKey;
    this.client = hederaService.getClient();
  }

  /**
   * Get Mirror Node API base URL
   */
  private getMirrorNodeUrl(): string {
    const network = config.hedera.network.toLowerCase();
    return network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
  }

  /**
   * Fetch real token transactions from Hedera blockchain
   */
  private async fetchTokenTransactionsFromBlockchain(tokenId: string): Promise<any[]> {
    try {
      const mirrorNodeUrl = this.getMirrorNodeUrl();
      
      console.log(`Fetching token transactions for ${tokenId} from blockchain`);
      
      // Method 1: Try getting transactions from multiple accounts that might be involved
      const accountsToCheck = [
        this.accountId,      // User account
        this.treasuryId,     // Treasury account
      ];
      
      let allTokenTransactions: any[] = [];
      
      for (const accountId of accountsToCheck) {
        try {
          const url = `${mirrorNodeUrl}/api/v1/transactions?account.id=${accountId}&limit=100&order=desc`;
          
          console.log(`Fetching transactions for account ${accountId}`);
          
          const response = await axios.get(url, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            timeout: 10000,
          });
          
          const accountTransactions = response.data.transactions || [];
          
          // Filter transactions that involve our specific token
          const relevantTransactions = accountTransactions.filter((tx: any) => {
            // Check if transaction involves the token in entity_id (for creation, mint, burn)
            if (tx.entity_id === tokenId) {
              return true;
            }
            
            // Check if transaction involves the token in token_transfers
            if (tx.token_transfers && Array.isArray(tx.token_transfers)) {
              return tx.token_transfers.some((transfer: any) => transfer.token_id === tokenId);
            }
            
            return false;
          });
          
          console.log(`Found ${relevantTransactions.length} relevant transactions for token ${tokenId} in account ${accountId}`);
          allTokenTransactions.push(...relevantTransactions);
          
        } catch (accountError) {
          console.error(`Error fetching transactions for account ${accountId}:`, accountError);
        }
      }
      
      // Remove duplicates based on transaction_id
      const uniqueTransactions = allTokenTransactions.filter((tx, index, arr) => 
        arr.findIndex(t => t.transaction_id === tx.transaction_id) === index
      );
      
      console.log(`Found ${uniqueTransactions.length} unique token transactions for ${tokenId}`);
      
      return uniqueTransactions;
      
    } catch (error) {
      console.error(`Error fetching token transactions for ${tokenId}:`, error);
      return [];
    }
  }

  /**
   * Map token composition asset names to oracle symbols
   */
  private mapAssetNameToSymbol(assetName: string): string {
    const mapping: Record<string, string> = {
      // Crypto mappings
      'bitcoin': 'BTC',
      'ethereum': 'ETH', 
      'hedera': 'HBAR',
      'polygon': 'MATIC',
      'solana': 'SOL',
      'cardano': 'ADA',
      'polkadot': 'DOT',
      'avalanche': 'AVAX',
      'chainlink': 'LINK',
      'uniswap': 'UNI',
      'aave': 'AAVE',
      
      // Stock mappings (keep uppercase)
      'v': 'V',
      'apple': 'AAPL',
      'microsoft': 'MSFT',
      'amazon': 'AMZN',
      'googl': 'GOOGL',
      'google': 'GOOGL',
      'meta': 'META',
      'tesla': 'TSLA',
      'nvidia': 'NVDA',
      'visa': 'V',
      'johnson': 'JNJ',
      'walmart': 'WMT',
      'procter': 'PG',
      'disney': 'DIS',
      'cocacola': 'KO',
      'nike': 'NKE',
      'jpmorgan': 'JPM',
      
      // Commodity mappings
      'gold': 'GOLD',
      'silver': 'SILVER',
      'oil': 'OIL',
      'natgas': 'NATGAS',
      'copper': 'COPPER',
      
      // ETF mappings
      'spy': 'SPY',
      'qqq': 'QQQ',
      'vti': 'VTI',
      
      // Bond mappings
      'us10y': 'US10Y',
      'us30y': 'US30Y'
    };
    
    const normalizedAssetName = assetName.toLowerCase().trim();
    return mapping[normalizedAssetName] || assetName.toUpperCase().replace(/\./g, '-');
  }

  /**
   * Get current asset prices from oracle service
   */
  private async getAssetPrices(symbols: string[]): Promise<{[key: string]: number}> {
    try {
      const oracleService = (await import('./oracle.service')).default;
      const prices: {[key: string]: number} = {};
      
      await Promise.all(symbols.map(async (symbol) => {
        try {
          const price = await oracleService.getPrice(symbol);
          prices[symbol] = price;
        } catch (error) {
          console.error(`Error fetching price for ${symbol}:`, error);
        }
      }));
      
      return prices;
    } catch (error) {
      console.error('Error fetching asset prices:', error);
      return {};
    }
  }

  /**
   * Get current HBAR price in USD
   */
  private async getHbarPrice(): Promise<number> {
    try {
      const hederaOracleService = (await import('./hedera-oracle.service')).default;
      return await hederaOracleService.getHbarPrice();
    } catch (error) {
      console.error('Error fetching HBAR price:', error);
      return 0.1; // Fallback price
    }
  }

  /**
   * Calculate required HBAR collateral for minting tokens
   */
  async calculateCollateralRequirements(
    tokenId: string,
    amount: number,
    composition: AssetComposition[]
  ): Promise<number> {
    console.log(`Calculating HBAR collateral for ${amount} tokens of ${tokenId}`);
    
    const symbols = composition.map(asset => this.mapAssetNameToSymbol(asset.value));
    const [assetPrices, hbarPrice] = await Promise.all([
      this.getAssetPrices(symbols),
      this.getHbarPrice()
    ]);
    
    let totalUsdValue = 0;
    composition.forEach(asset => {
      const symbol = this.mapAssetNameToSymbol(asset.value);
      const assetPrice = assetPrices[symbol];
      const allocation = asset.allocation || 0;
      
      if (assetPrice && allocation > 0) {
        const assetUsdValue = amount * (allocation / 100) * assetPrice;
        totalUsdValue += assetUsdValue;
      }
    });
    
    const requiredHbar = totalUsdValue / hbarPrice;
    console.log(`Required HBAR collateral: ${requiredHbar.toFixed(4)} HBAR`);
    
    return requiredHbar;
  }

  /**
   * Verify account has sufficient HBAR balance
   */
  async verifyCollateralAvailability(
    accountId: string,
    requiredHbar: number
  ): Promise<{ verified: boolean; message: string }> {
    try {
      if (!this.client) {
        throw new Error("Hedera client not initialized");
      }
      
      const query = new AccountBalanceQuery().setAccountId(AccountId.fromString(accountId));
      const accountBalance = await query.execute(this.client);
      const hbarBalance = parseFloat(accountBalance.hbars.toString());
      
      if (hbarBalance < requiredHbar) {
        return {
          verified: false,
          message: `Insufficient HBAR balance. Required: ${requiredHbar.toFixed(4)} HBAR, Available: ${hbarBalance.toFixed(4)} HBAR`
        };
      }
      
      return {
        verified: true,
        message: `Sufficient HBAR balance available: ${hbarBalance.toFixed(4)} HBAR`
      };
    } catch (error) {
      console.error("Error verifying collateral availability:", error);
      throw error;
    }
  }

  /**
   * Record HBAR collateral for minted tokens (legacy method for compatibility)
   */
  recordCollateral(
    tokenId: string,
    hbarAmount: number,
    transactionId?: string
  ): CollateralRecord {
    console.log(`Recording ${hbarAmount.toFixed(4)} HBAR collateral for token ${tokenId} (legacy method)`);
    
    // This is now just for logging - real data comes from blockchain
    const record: CollateralRecord = {
      tokenId,
      assets: [{
        assetId: 'HBAR',
        assetType: 'HBAR',
        label: `HBAR Collateral Deposit (Minting)`,
        amount: hbarAmount,
        hbarEquivalent: hbarAmount
      }],
      timestamp: new Date().toISOString(),
      transactionId
    };
    
    return record;
  }

  /**
   * Record HBAR collateral release when tokens are burned (legacy method for compatibility)
   */
  recordCollateralRelease(
    tokenId: string,
    hbarAmount: number,
    transactionId?: string
  ): CollateralRecord {
    console.log(`Recording ${hbarAmount.toFixed(4)} HBAR collateral release for token ${tokenId} (legacy method)`);
    
    // This is now just for logging - real data comes from blockchain
    const record: CollateralRecord = {
      tokenId,
      assets: [{
        assetId: 'HBAR',
        assetType: 'HBAR',
        label: `HBAR Collateral Release (Burning)`,
        amount: -hbarAmount, // Negative amount indicates release
        hbarEquivalent: -hbarAmount
      }],
      timestamp: new Date().toISOString(),
      transactionId
    };
    
    return record;
  }

  /**
   * Transfer HBAR collateral from account to treasury
   */
  async transferCollateralToTreasury(
    accountId: string,
    privateKey: string,
    hbarAmount: number
  ): Promise<any> {
    try {
      if (!this.client) {
        throw new Error("Hedera client not initialized");
      }
      
      console.log(`Transferring ${hbarAmount.toFixed(4)} HBAR from ${accountId} to treasury ${this.treasuryId}`);
      
      // Convert HBAR to tinybars more precisely
      const tinybars = Math.round(hbarAmount * 100_000_000); // 1 HBAR = 100,000,000 tinybars
      
      const transaction = new TransferTransaction()
        .addHbarTransfer(
          AccountId.fromString(accountId),
          Hbar.fromTinybars(-tinybars)
        )
        .addHbarTransfer(
          AccountId.fromString(this.treasuryId),
          Hbar.fromTinybars(tinybars)
        );
      
      // Only sign with the sender's key (the account transferring HBAR)
      const accountKey = PrivateKey.fromStringECDSA(privateKey);
      
      const frozenTx = await transaction.freezeWith(this.client);
      const signedTx = await frozenTx.sign(accountKey);
      
      const txResponse = await signedTx.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);
      
      if (receipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Collateral transfer failed with status: ${receipt.status.toString()}`);
      }
      
      // Clear cache to force fresh fetch
      this.collateralCache.clear();
      
      console.log(`Collateral transfer successful: ${txResponse.transactionId.toString()}`);
      
      return {
        success: true,
        transactionId: txResponse.transactionId.toString(),
        status: receipt.status.toString(),
        hbarAmount: hbarAmount,
        tinybars: tinybars
      };
    } catch (error) {
      console.error("Error transferring HBAR collateral:", error);
      throw error;
    }
  }

  /**
   * Transfer HBAR collateral from treasury back to account
   */
  async transferCollateralFromTreasury(
    recipientId: string,
    hbarAmount: number
  ): Promise<any> {
    try {
      if (!this.client) {
        throw new Error("Hedera client not initialized");
      }
      
      console.log(`Transferring ${hbarAmount.toFixed(4)} HBAR from treasury ${this.treasuryId} to ${recipientId}`);
      
      // Convert HBAR to tinybars more precisely
      const tinybars = Math.round(hbarAmount * 100_000_000); // 1 HBAR = 100,000,000 tinybars
      
      const transaction = new TransferTransaction()
        .addHbarTransfer(
          AccountId.fromString(this.treasuryId),
          Hbar.fromTinybars(-tinybars)
        )
        .addHbarTransfer(
          AccountId.fromString(recipientId),
          Hbar.fromTinybars(tinybars)
        );
      
      // Only sign with the treasury key (the account sending HBAR)
      const treasuryKey = PrivateKey.fromStringECDSA(this.treasuryKey);
      const frozenTx = await transaction.freezeWith(this.client);
      const signedTx = await frozenTx.sign(treasuryKey);
      
      const txResponse = await signedTx.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);
      
      if (receipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Collateral refund failed with status: ${receipt.status.toString()}`);
      }
      
      // Clear cache to force fresh fetch
      this.collateralCache.clear();
      
      console.log(`Collateral refund successful: ${txResponse.transactionId.toString()}`);
      
      return {
        success: true,
        transactionId: txResponse.transactionId.toString(),
        status: receipt.status.toString(),
        hbarAmount: hbarAmount,
        tinybars: tinybars
      };
    } catch (error) {
      console.error("Error transferring HBAR from treasury:", error);
      throw error;
    }
  }

  /**
   * Get all collateral records for a token (legacy method for compatibility)
   */
  getCollateralRecords(tokenId: string): CollateralRecord[] {
    console.log(`getCollateralRecords called for ${tokenId} (legacy method - use getRealCollateralFromBlockchain instead)`);
    return [];
  }

  /**
   * Get real collateral data from Hedera blockchain
   */
  async getRealCollateralFromBlockchain(tokenId: string): Promise<CollateralRecord[]> {
    console.log(`Getting real collateral records for token ${tokenId} from blockchain`);
    
    // Check cache first
    const cached = this.collateralCache.get(tokenId);
    if (cached && (Date.now() - cached.lastFetch) < this.CACHE_DURATION) {
      console.log(`Returning cached collateral data for ${tokenId}`);
      return cached.records;
    }
    
    try {
      // First, get token info to know the decimals
      const mirrorNodeUrl = this.getMirrorNodeUrl();
      const tokenInfoResponse = await axios.get(`${mirrorNodeUrl}/api/v1/tokens/${tokenId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000,
      });
      
      const tokenDecimals = parseInt(tokenInfoResponse.data.decimals) || 0;
      console.log(`Token ${tokenId} has ${tokenDecimals} decimals`);
      
      // Fetch token transactions (mint/burn and related HBAR transfers)
      const tokenTransactions = await this.fetchTokenTransactionsFromBlockchain(tokenId);
      
      console.log(`Fetched ${tokenTransactions.length} transactions involving token ${tokenId}`);
      
      const collateralRecords: CollateralRecord[] = [];
      
      // Process token mint transactions
      const mintTransactions = tokenTransactions.filter(tx => {
        // Mint transactions have entity_id matching our token (token creation/mint operations)
        if (tx.entity_id === tokenId) {
          // Check if there are token_transfers showing tokens being added to treasury
          if (tx.token_transfers && Array.isArray(tx.token_transfers)) {
            return tx.token_transfers.some((transfer: any) => 
              transfer.token_id === tokenId && 
              transfer.account === this.treasuryId && 
              transfer.amount > 0 // Positive amount = minting/receiving tokens
            );
          }
          // If no token_transfers but entity_id matches, it's likely a mint operation
          return true;
        }
        return false;
      });
      
      // Process token burn transactions  
      const burnTransactions = tokenTransactions.filter(tx => {
        // Burn transactions show tokens being removed from treasury (negative amount)
        if (tx.token_transfers && Array.isArray(tx.token_transfers)) {
          return tx.token_transfers.some((transfer: any) => 
            transfer.token_id === tokenId && 
            transfer.account === this.treasuryId && 
            transfer.amount < 0 // Negative amount = burning/sending tokens
          );
        }
        return false;
      });
      
      console.log(`Found ${mintTransactions.length} mint and ${burnTransactions.length} burn transactions for token ${tokenId}`);
      
      // Get HBAR transfer transactions - these are separate from token operations
      const hbarTransferTransactions = tokenTransactions.filter(tx => {
        // Look for CRYPTOTRANSFER transactions with treasury involvement but no token operations
        return tx.name === 'CRYPTOTRANSFER' && 
               !tx.entity_id && 
               (!tx.token_transfers || tx.token_transfers.length === 0) &&
               tx.transfers && 
               Array.isArray(tx.transfers) && 
               tx.transfers.some((transfer: any) => transfer.account === this.treasuryId);
      });
      
      console.log(`Found ${hbarTransferTransactions.length} HBAR transfer transactions involving treasury`);
      
      // Create records for mint transactions
      for (const mintTx of mintTransactions) {
        console.log(`Processing mint transaction: ${mintTx.transaction_id} at ${mintTx.consensus_timestamp}`);
        
        // Get the amount of tokens minted from token_transfers
        let tokenAmount = 0;
        if (mintTx.token_transfers && Array.isArray(mintTx.token_transfers)) {
          const treasuryTransfer = mintTx.token_transfers.find((transfer: any) => 
            transfer.token_id === tokenId && 
            transfer.account === this.treasuryId && 
            transfer.amount > 0
          );
          if (treasuryTransfer) {
            tokenAmount = treasuryTransfer.amount / Math.pow(10, tokenDecimals);
          }
        }
        
        // Look for corresponding HBAR transfer within a small time window
        const mintTime = parseFloat(mintTx.consensus_timestamp);
        const timeWindow = 10; // 10 seconds window
        
        const correspondingHbarTx = hbarTransferTransactions.find(tx => {
          const txTime = parseFloat(tx.consensus_timestamp);
          const timeDiff = Math.abs(txTime - mintTime);
          
          if (timeDiff <= timeWindow) {
            // Check if there's a positive HBAR transfer to treasury (collateral deposit)
            const treasuryInflow = tx.transfers.find((transfer: any) => 
              transfer.account === this.treasuryId && transfer.amount > 0
            );
            if (treasuryInflow) {
              console.log(`Found matching HBAR transfer: ${tx.transaction_id} (time diff: ${timeDiff.toFixed(1)}s)`);
              return true;
            }
          }
          
          return false;
        });
        
        let hbarAmount = 0;
        let label = '';
        let collateralTxId = mintTx.transaction_id;
        
        if (correspondingHbarTx && correspondingHbarTx.transfers) {
          // Look for HBAR inflow to treasury (positive amount)
          const treasuryTransfer = correspondingHbarTx.transfers.find((transfer: any) => 
            transfer.account === this.treasuryId && transfer.amount > 0
          );
          if (treasuryTransfer) {
            hbarAmount = treasuryTransfer.amount / 100000000; // Convert from tinybars to HBAR
            collateralTxId = correspondingHbarTx.transaction_id;
            label = `Token Mint: ${tokenAmount} tokens (HBAR collateral: ${hbarAmount.toFixed(4)})`;
            console.log(`Found ${hbarAmount.toFixed(4)} HBAR collateral deposit for mint transaction`);
          } else {
            label = `Token Mint: ${tokenAmount} tokens`;
          }
        } else {
          label = `Token Mint: ${tokenAmount} tokens`;
          console.log(`No matching HBAR transfer found for mint transaction ${mintTx.transaction_id}`);
        }
        
        const record: CollateralRecord = {
          tokenId,
          assets: [{
            assetId: 'HBAR',
            assetType: 'HBAR',
            label: label,
            amount: hbarAmount,
            hbarEquivalent: hbarAmount
          }],
          timestamp: new Date(parseFloat(mintTx.consensus_timestamp) * 1000).toISOString(), // Convert from seconds to milliseconds
          transactionId: collateralTxId
        };
        
        collateralRecords.push(record);
      }
      
      // Create records for burn transactions
      for (const burnTx of burnTransactions) {
        console.log(`Processing burn transaction: ${burnTx.transaction_id} at ${burnTx.consensus_timestamp}`);
        
        // Get the amount of tokens burned from token_transfers
        let tokenAmount = 0;
        if (burnTx.token_transfers && Array.isArray(burnTx.token_transfers)) {
          const treasuryTransfer = burnTx.token_transfers.find((transfer: any) => 
            transfer.token_id === tokenId && 
            transfer.account === this.treasuryId && 
            transfer.amount < 0
          );
          if (treasuryTransfer) {
            tokenAmount = Math.abs(treasuryTransfer.amount) / Math.pow(10, tokenDecimals);
          }
        }
        
        // Look for corresponding HBAR transfer within a small time window
        const burnTime = parseFloat(burnTx.consensus_timestamp);
        const timeWindow = 10; // 10 seconds window
        
        const correspondingHbarTx = hbarTransferTransactions.find(tx => {
          const txTime = parseFloat(tx.consensus_timestamp);
          const timeDiff = Math.abs(txTime - burnTime);
          
          if (timeDiff <= timeWindow) {
            // Check if there's a negative HBAR transfer from treasury (collateral release)
            const treasuryOutflow = tx.transfers.find((transfer: any) => 
              transfer.account === this.treasuryId && transfer.amount < 0
            );
            if (treasuryOutflow) {
              console.log(`Found matching HBAR transfer: ${tx.transaction_id} (time diff: ${timeDiff.toFixed(1)}s)`);
              return true;
            }
          }
          
          return false;
        });
        
        let hbarAmount = 0;
        let label = '';
        let collateralTxId = burnTx.transaction_id;
        
        if (correspondingHbarTx && correspondingHbarTx.transfers) {
          // Look for HBAR outflow from treasury (negative amount)
          const treasuryTransfer = correspondingHbarTx.transfers.find((transfer: any) => 
            transfer.account === this.treasuryId && transfer.amount < 0
          );
          if (treasuryTransfer) {
            hbarAmount = Math.abs(treasuryTransfer.amount) / 100000000; // Convert from tinybars to HBAR
            collateralTxId = correspondingHbarTx.transaction_id;
            label = `Token Burn: ${tokenAmount} tokens (HBAR released: ${hbarAmount.toFixed(4)})`;
            console.log(`Found ${hbarAmount.toFixed(4)} HBAR collateral release for burn transaction`);
          } else {
            label = `Token Burn: ${tokenAmount} tokens`;
          }
        } else {
          label = `Token Burn: ${tokenAmount} tokens`;
          console.log(`No matching HBAR release found for burn transaction ${burnTx.transaction_id}`);
        }
        
        const record: CollateralRecord = {
          tokenId,
          assets: [{
            assetId: 'HBAR',
            assetType: 'HBAR',
            label: label,
            amount: -hbarAmount, // Negative indicates release
            hbarEquivalent: -hbarAmount
          }],
          timestamp: new Date(parseFloat(burnTx.consensus_timestamp) * 1000).toISOString(), // Convert from seconds to milliseconds
          transactionId: collateralTxId
        };
        
        collateralRecords.push(record);
      }
      
      // Sort by timestamp (most recent first)
      collateralRecords.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      // Cache the results
      this.collateralCache.set(tokenId, {
        records: collateralRecords,
        lastFetch: Date.now()
      });
      
      console.log(`Found ${collateralRecords.length} collateral records for token ${tokenId} from blockchain`);
      
      // If we have records, log them for debugging
      if (collateralRecords.length > 0) {
        collateralRecords.forEach((record, index) => {
          console.log(`Record ${index + 1}: ${record.assets[0]?.label} - ${record.transactionId}`);
        });
      }
      
      return collateralRecords;
      
    } catch (error) {
      console.error(`Error fetching collateral from blockchain for token ${tokenId}:`, error);
      return [];
    }
  }
}

export const collateralService = new CollateralService(); 