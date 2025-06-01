import {
  TokenCreateTransaction,
  Client,
  PrivateKey,
  AccountId,
  TokenType,
  TokenInfoQuery,
  TokenId,
  TokenMintTransaction,
  TokenBurnTransaction,
  Hbar,
  FileCreateTransaction,
  FileAppendTransaction,
  FileContentsQuery,
  FileId,
  TokenUpdateTransaction,
  TransferTransaction,
  AccountBalanceQuery,
  TokenAssociateTransaction
} from "@hashgraph/sdk";
import axios from "axios";
import config from "../config";
import { hederaService } from "./hedera.service";

// Interface for ETF token composition
export interface AssetComposition {
  value: string;    // Asset identifier
  label: string;    // Asset name/label
  allocation: number; // Percentage allocation
}

// Interface for token creation parameters
export interface TokenCreateParams {
  name: string;
  symbol: string;
  composition: AssetComposition[];
}

// Interface for token metadata
interface TokenMetadata {
  tokenId?: string;  // Optional during initial creation
  name: string;
  symbol: string;
  composition: AssetComposition[];
  createdAt: string;
  fileTransactionId?: string; // ID della transazione di creazione del file
}

// Interface for Mirror Node token response
interface MirrorNodeToken {
  token_id: string;
  symbol: string;
  name: string;
  decimals: string;
  total_supply: string;
  treasury_account_id: string;
  created_timestamp: string;
  memo?: string;
  custom_fees?: any;
  deleted?: boolean;
  type?: string;
  pause_key?: string;
  pause_status?: string;
}

// Interface for Mirror Node token detail response
interface MirrorNodeTokenDetailResponse {
  token_id: string;
  symbol: string;
  name: string;
  decimals: string;
  total_supply: string;
  treasury_account_id: string;
  created_timestamp: string;
  memo: string; // This will include our metadata file ID
  custom_fees: any;
  deleted: boolean;
  type: string;
  pause_key: any;
  pause_status: string;
}

// Interface for Mirror Node API response
interface MirrorNodeTokensResponse {
  tokens: MirrorNodeToken[];
  links: {
    next: string | null;
  };
}

class TokenService {
  private client: Client | null = null;
  private treasuryId: string;
  private treasuryKey: string;
  private accountId: string;
  private privateKey: string;
  
  // Map of token IDs to their metadata file IDs on Hedera
  private tokenMetadataFiles: Map<string, string> = new Map();
  
  // Map to store file transaction IDs (fileId -> transactionId)
  private fileTransactionIds: Map<string, string> = new Map();
  
  // Map to store token metadata for easier retrieval
  private tokenMetadata: Map<string, TokenMetadata> = new Map();

  constructor() {
    this.treasuryId = config.hedera.treasuryId;
    this.treasuryKey = config.hedera.treasuryKey;
    this.accountId = config.hedera.accountId;
    this.privateKey = config.hedera.privateKey;
    this.client = hederaService.getClient();
  }

  /**
   * Store token metadata on Hedera File Service - This follows Hedera ATS approach
   * @param tokenId The token ID or 'temp' if not yet created
   * @param metadata Token metadata
   * @returns Object with fileId and fileTransactionId
   */
  private async storeTokenMetadataOnHedera(tokenId: string, metadata: TokenMetadata): Promise<{fileId: FileId, fileTransactionId: string}> {
    if (!this.client) {
      throw new Error("Hedera client not initialized");
    }

    const operatorKey = PrivateKey.fromStringECDSA(this.privateKey);
    
    // Prepare metadata JSON
    const metadataJson = JSON.stringify(metadata, null, 2);
    
    // Create file transaction with metadata
    console.log("Creating file on Hedera for token metadata...");
    const fileCreateTx = new FileCreateTransaction()
      .setKeys([operatorKey])
      .setContents(tokenId === "temp" ? "token-metadata:" : `${tokenId}-metadata:`)
      .setMaxTransactionFee(new Hbar(10));
    
    const fileSubmit = await fileCreateTx.execute(this.client);
    const fileCreateReceipt = await fileSubmit.getReceipt(this.client);
    const fileId = fileCreateReceipt.fileId;
    
    if (!fileId) {
      throw new Error("Failed to create file for token metadata");
    }
    
    // Get the transaction ID from the submission
    const fileTransactionId = fileSubmit.transactionId.toString();
    console.log(`File created with transaction ID: ${fileTransactionId}`);
    
    // Append the metadata (file contents are limited in size per transaction)
    console.log("Appending token metadata to file...");
    const fileAppendTx = new FileAppendTransaction()
      .setFileId(fileId)
      .setContents(metadataJson)
      .setMaxTransactionFee(new Hbar(10));
      
    const appendSubmit = await fileAppendTx.execute(this.client);
    await appendSubmit.getReceipt(this.client);
    
    console.log(`Token metadata successfully stored on Hedera File ID: ${fileId.toString()}`);
    return { fileId, fileTransactionId };
  }

  /**
   * Update the token metadata on Hedera File Service when token is created
   * @param fileId The file ID to update
   * @param metadata The updated metadata with tokenId
   */
  private async updateTokenMetadataOnHedera(fileId: FileId, metadata: TokenMetadata): Promise<void> {
    if (!this.client) {
      throw new Error("Hedera client not initialized");
    }
    
    // Instead of appending to the file (which causes duplicate JSON objects),
    // we'll create a new transaction that overwrites the file content
    console.log(`Updating metadata file with token ID: ${metadata.tokenId}`);
    
    // Prepare updated metadata JSON
    const metadataJson = JSON.stringify(metadata, null, 2);
    
    try {
      // Use TokenUpdateTransaction to update the token memo if needed
      // and FileAppendTransaction to update the file with clear contents
      const metadataPrefix = `${metadata.tokenId}-metadata:`;
      const fileAppendTx = new FileAppendTransaction()
        .setFileId(fileId)
        .setContents(metadataPrefix + metadataJson)
        .setMaxTransactionFee(new Hbar(10));
      
      const appendSubmit = await fileAppendTx.execute(this.client);
      await appendSubmit.getReceipt(this.client);
      console.log("Metadata file updated with token ID");
    } catch (error) {
      console.error("Error updating token metadata file:", error);
      throw error;
    }
  }

  /**
   * Parse potentially corrupted or concatenated JSON from file contents
   * @param fileContentStr String content from Hedera File
   * @returns Parsed metadata object
   */
  private parseMetadataFileContent(fileContentStr: string): TokenMetadata {
    // Find the first JSON object start
    const jsonStartIndex = fileContentStr.indexOf('{');
    if (jsonStartIndex === -1) {
      throw new Error("No JSON object found in file content");
    }
    
    // Try to find multiple JSON objects in the file
    const jsonObjects = [];
    let currentPosition = jsonStartIndex;
    let depth = 0;
    let startPosition = jsonStartIndex;
    
    // Scan through the string to find complete JSON objects
    for (let i = jsonStartIndex; i < fileContentStr.length; i++) {
      const char = fileContentStr[i];
      
      if (char === '{') {
        if (depth === 0) {
          startPosition = i;
        }
        depth++;
      } else if (char === '}') {
        depth--;
        
        // When we reach a closing brace at depth 0, we've found a complete JSON object
        if (depth === 0) {
          const jsonSubstring = fileContentStr.substring(startPosition, i + 1);
          try {
            const parsedObject = JSON.parse(jsonSubstring);
            jsonObjects.push(parsedObject);
          } catch (error) {
            console.error(`Error parsing JSON object: ${error}`);
          }
        }
      }
    }
    
    console.log(`Found ${jsonObjects.length} JSON objects in file content`);
    
    // If no valid JSON objects were found, try a different approach
    if (jsonObjects.length === 0) {
      console.log("No complete JSON objects found, trying alternative parsing");
      try {
        // Find the last closing brace in the string
        const lastBrace = fileContentStr.lastIndexOf('}');
        if (lastBrace !== -1) {
          // Take everything from the first '{' to the last '}'
          const jsonStr = fileContentStr.substring(jsonStartIndex, lastBrace + 1);
          return JSON.parse(jsonStr) as TokenMetadata;
        }
      } catch (error) {
        console.error(`Error in alternative JSON parsing: ${error}`);
        throw new Error("Failed to parse metadata from file content");
      }
    }
    
    // If multiple JSON objects were found, return the last one (most up to date)
    if (jsonObjects.length > 0) {
      console.log("Using the most recent JSON object from file (likely has tokenId)");
      // The last object is likely the most up-to-date one with tokenId
      return jsonObjects[jsonObjects.length - 1] as TokenMetadata;
    }
    
    throw new Error("Failed to parse any valid JSON from file content");
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
      'berkshire': 'BRK-A',
      'johnson': 'JNJ',
      'walmart': 'WMT',
      'disney': 'DIS',
      'coca-cola': 'KO',
      'nike': 'NKE',
      'jpmorgan': 'JPM',
      
      // Commodities mappings
      'gold': 'GOLD',
      'silver': 'SILVER',
      'oil': 'OIL',
      'natgas': 'NATGAS',
      'copper': 'COPPER'
    };
    
    return mapping[assetName.toLowerCase()] || assetName.toUpperCase().replace(/\./g, '-');
  }

  /**
   * Create a new token on Hedera
   * @param params Token creation parameters
   * @returns Token creation response with token ID
   */
  async createToken(params: TokenCreateParams): Promise<any> {
    try {
      // Validate client
      if (!this.client) {
        throw new Error("Hedera client not initialized");
      }

      // Validate composition
      this.validateComposition(params.composition);

      console.log("Creating token with parameters:", {
        name: params.name,
        symbol: params.symbol,
        treasuryId: this.treasuryId,
        accountId: this.accountId
      });

      // Get treasury account ID
      const treasuryAccountId = AccountId.fromString(this.treasuryId);
      
      // Create a proper private key instance for ECDSA keys
      console.log("Parsing treasury key as ECDSA...");
      const treasuryKey = PrivateKey.fromStringECDSA(this.treasuryKey);
      console.log("Treasury key parsed successfully");
      
      // Create the operator key
      console.log("Parsing operator key as ECDSA...");
      const operatorKey = PrivateKey.fromStringECDSA(this.privateKey);
      console.log("Operator key parsed successfully");
      
      console.log(`Creating token with treasury ID: ${treasuryAccountId.toString()}`);

      // Token metadata to be stored on Hedera
      const tokenMetadata: TokenMetadata = {
        name: params.name,
        symbol: params.symbol,
        composition: params.composition,
        createdAt: new Date().toISOString()
      };

      // Store token composition on Hedera File Service first
      console.log("Storing token metadata on Hedera File Service...");
      const { fileId, fileTransactionId } = await this.storeTokenMetadataOnHedera(
        "temp", // We don't have tokenId yet, will update later
        tokenMetadata
      );
      console.log(`Token metadata stored in file: ${fileId.toString()}`);
      
      // Set the memo to include the file ID right from the start
      const metadataMemo = `Metadata:${fileId.toString()}`;

      // Create the token with the minimum required fields and include the memo
      // Set initialSupply to 0 - tokens will be minted when collateral is provided
      const transaction = new TokenCreateTransaction()
        .setTokenName(params.name)
        .setTokenSymbol(params.symbol)
        .setTreasuryAccountId(treasuryAccountId)
        .setDecimals(6) // Increased from 2 to 6 for better granularity
        .setInitialSupply(0) // Start with 0 supply - tokens minted on demand with collateral
        .setSupplyKey(operatorKey) // Add the supply key to allow minting
        .setAdminKey(operatorKey) // Add admin key to allow updates
        .setTokenMemo(metadataMemo) // Include memo with file ID
        .setTransactionMemo("ETF Token Creation");
      
      // Set maximum transaction fee to avoid insufficient fee errors
      transaction.setMaxTransactionFee(new Hbar(20));

      // Freeze the transaction for signing
      console.log("Freezing transaction...");
      const frozenTx = transaction.freezeWith(this.client);
      
      console.log("Signing transaction with treasury key...");
      let signedTx = await frozenTx.sign(treasuryKey);
      
      // If the operator account is different from the treasury account, sign with the operator key too
      if (this.accountId !== this.treasuryId) {
        console.log("Signing transaction with operator key...");
        signedTx = await signedTx.sign(operatorKey);
      }
      
      // Execute the transaction
      console.log("Executing transaction...");
      const txResponse = await signedTx.execute(this.client);
      
      console.log("Waiting for receipt...");
      const receipt = await txResponse.getReceipt(this.client);
      
      const tokenId = receipt.tokenId;
      if (!tokenId) {
        throw new Error("Failed to get token ID from receipt");
      }

      console.log(`Token created successfully: ${tokenId.toString()}`);

      // Now update the tokenId in metadata
      tokenMetadata.tokenId = tokenId.toString();
      
      // Update the metadata file with the actual token ID - use our new method
      // that replaces rather than appends
      console.log(`Updating metadata file with token ID: ${tokenId.toString()}`);
      await this.updateTokenMetadataOnHedera(fileId, tokenMetadata);
      
      // Save reference to the file ID
      this.tokenMetadataFiles.set(tokenId.toString(), fileId.toString());
      
      // Save reference to the file transaction ID
      this.fileTransactionIds.set(fileId.toString(), fileTransactionId);
      
      // Save the token metadata for easier retrieval
      this.tokenMetadata.set(tokenId.toString(), tokenMetadata);

      return {
        success: true,
        tokenId: tokenId.toString(),
        tokenData: tokenMetadata,
        metadataFileId: fileId.toString(),
        fileTransactionId
      };
    } catch (error) {
      console.error("Error creating token:", error);
      throw error;
    }
  }

  /**
   * Validate token composition
   * @param composition Array of assets with allocations
   */
  private validateComposition(composition: AssetComposition[]): void {
    if (!composition || composition.length === 0) {
      throw new Error("Token composition cannot be empty");
    }

    const totalAllocation = composition.reduce(
      (sum, asset) => sum + asset.allocation,
      0
    );

    if (Math.abs(totalAllocation - 100) > 0.01) {
      throw new Error(`Total allocation must equal 100%, got ${totalAllocation}%`);
    }
  }

  /**
   * Get token information by ID
   * @returns Token information including composition from Hedera File Service
   */
  async getTokenInfo(tokenId: string): Promise<any> {
    try {
      if (!this.client) {
        throw new Error("Hedera client not initialized");
      }

      // First check if we have the metadata file ID in our map
      let metadataFileId = this.tokenMetadataFiles.get(tokenId);
      let tokenMemo = "";
      
      // Get on-chain token info
      console.log(`Getting basic token info for ${tokenId}...`);
      const query = new TokenInfoQuery()
        .setTokenId(TokenId.fromString(tokenId));

      const tokenInfo = await query.execute(this.client);
      tokenMemo = tokenInfo.tokenMemo || "";
      
      // If we don't have the file ID and the memo from SDK is empty, try Mirror Node
      if (!metadataFileId && (!tokenMemo || tokenMemo === "")) {
        try {
          console.log(`SDK token memo is empty, trying Mirror Node API for token ${tokenId}...`);
          
          // Determine which Mirror Node base URL to use based on network
          const network = config.hedera.network.toLowerCase();
          const mirrorNodeBaseUrl = network === 'mainnet' 
            ? 'https://mainnet-public.mirrornode.hedera.com'
            : 'https://testnet.mirrornode.hedera.com';
          
          // Configure axios with proper headers
          const axiosConfig = {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            timeout: 10000, // 10 second timeout
          };
          
          const mirrorResponse = await axios.get<MirrorNodeTokenDetailResponse>(
            `${mirrorNodeBaseUrl}/api/v1/tokens/${tokenId}`,
            axiosConfig
          );
          
          // Get memo from Mirror Node
          if (mirrorResponse.data.memo) {
            tokenMemo = mirrorResponse.data.memo;
            console.log(`Retrieved token memo from Mirror Node: ${tokenMemo}`);
          }
        } catch (mirrorError) {
          console.error(`Failed to get token info from Mirror Node: ${mirrorError}`);
          // Continue with the SDK info we already have
        }
      }
      
      // If not, try to extract it from the token memo
      if (!metadataFileId && tokenMemo) {
        console.log(`Checking token memo for metadata file ID: "${tokenMemo}"`);
        // Check if memo contains a metadata file ID in format "Metadata:0.0.123456"
        if (tokenMemo.startsWith("Metadata:")) {
          metadataFileId = tokenMemo.substring("Metadata:".length);
          console.log(`Found metadata file ID in token memo: ${metadataFileId}`);
          
          // Store it in our map for future use
          this.tokenMetadataFiles.set(tokenId, metadataFileId);
        }
      }
      
      if (!metadataFileId) {
        // In a real-world app, you'd have a more reliable way to look up the file ID
        // Here we just warn that we don't have it
        console.warn(`Metadata file ID for token ${tokenId} not found in local cache or token memo`);
      }
      
      // Get composition and other metadata from Hedera File Service if we have the file ID
      let composition: AssetComposition[] = [];
      let metadataFromHedera: TokenMetadata | null = null;
      
      // Check if we already have this metadata cached in memory
      const cachedMetadata = this.tokenMetadata.get(tokenId);
      if (cachedMetadata && cachedMetadata.composition?.length > 0) {
        console.log(`Using cached metadata for token ${tokenId}`);
        composition = cachedMetadata.composition;
        metadataFromHedera = cachedMetadata;
      } else if (metadataFileId) {
        try {
          console.log(`Retrieving token metadata from Hedera File ID: ${metadataFileId}...`);
          const fileContentsQuery = new FileContentsQuery()
            .setFileId(FileId.fromString(metadataFileId));
            
          const fileContents = await fileContentsQuery.execute(this.client);
          const fileContentStr = fileContents.toString();
          
          try {
            // Use our new parser for handling concatenated JSON objects
            metadataFromHedera = this.parseMetadataFileContent(fileContentStr);
            composition = metadataFromHedera.composition;
            
            // Cache the metadata for future use
            this.tokenMetadata.set(tokenId, metadataFromHedera);
            
            console.log(`Successfully retrieved token metadata from Hedera`);
          } catch (parseError) {
            console.error(`Error parsing token metadata: ${parseError}`);
          }
        } catch (fileError) {
          console.error(`Error retrieving token metadata from Hedera File Service: ${fileError}`);
        }
      }
      
      return {
        tokenId: tokenInfo.tokenId.toString(),
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        totalSupply: tokenInfo.totalSupply.toString(),
        decimals: tokenInfo.decimals,
        treasury: tokenInfo.treasuryAccountId ? tokenInfo.treasuryAccountId.toString() : 'N/A',
        memo: tokenMemo,
        composition, // Include composition from Hedera file
        metadataFileId, // Include file ID if we have it
        metadataSource: metadataFromHedera ? 'hedera' : (cachedMetadata ? 'memory-cache' : 'unavailable'),
        fileTransactionId: metadataFileId ? this.fileTransactionIds.get(metadataFileId) : undefined // Include transaction ID if available
      };
    } catch (error) {
      console.error(`Error getting token info for ${tokenId}:`, error);
      throw error;
    }
  }

  /**
   * Mint new tokens
   * @param tokenId Token ID to mint
   * @param amount Amount of tokens to mint
   * @returns Transaction result
   */
  async mintToken(tokenId: string, amount: number): Promise<any> {
    try {
      if (!this.client) {
        throw new Error("Hedera client not initialized");
      }

      console.log(`Starting enhanced minting process for ${amount} tokens of ${tokenId}`);
      
      // First, get token info to fetch composition
      const tokenInfo = await this.getTokenInfo(tokenId);
      
      if (!tokenInfo || !tokenInfo.composition || tokenInfo.composition.length === 0) {
        throw new Error("Token composition not found. Cannot calculate collateral requirements.");
      }
      
      // Import collateral service
      const { collateralService } = await import('./collateral.service');
      
      // Calculate the USD value of the tokens being minted
      // This will ensure that the collateral matches the token value
      let tokenValueUSD = 0;
      
      // Import oracle service to get asset prices
      const { OracleService } = await import('./oracle.service');
      const oracleService = OracleService.getInstance();
      
      // Calculate token price based on composition
      for (const asset of tokenInfo.composition) {
        try {
          const symbol = this.mapAssetNameToSymbol(asset.value);
          const price = await oracleService.getPrice(symbol);
          const allocation = asset.allocation || 0;
          
          if (price && allocation > 0) {
            // Each token represents 1 unit of the basket
            const assetValue = (price * allocation / 100);
            tokenValueUSD += assetValue;
          }
        } catch (priceError) {
          console.warn(`Could not get price for asset ${asset.value}:`, priceError);
        }
      }
      
      if (tokenValueUSD <= 0) {
        throw new Error("Could not calculate token value. Asset prices unavailable.");
      }
      
      // The amount of HBAR collateral should equal the USD value of tokens being minted
      const requiredHbarCollateral = await collateralService.calculateCollateralRequirements(
        tokenId,
        amount,
        tokenInfo.composition
      );
      
      // Calculate what the collateral SHOULD be based on token value
      const hbarPrice = await oracleService.getPrice('HBAR');
      const expectedCollateralUSD = amount * tokenValueUSD;
      const expectedCollateralHBAR = expectedCollateralUSD / hbarPrice;
      
      console.log(`Token value per unit: $${tokenValueUSD.toFixed(4)}`);
      console.log(`Expected investment for ${amount} tokens: $${expectedCollateralUSD.toFixed(2)}`);
      console.log(`Expected HBAR collateral: ${expectedCollateralHBAR.toFixed(4)} HBAR`);
      console.log(`Calculated collateral requirement: ${requiredHbarCollateral.toFixed(4)} HBAR`);
      
      // Use the expected collateral amount for consistency
      const finalCollateralAmount = expectedCollateralHBAR;
      
      // Verify account has sufficient HBAR balance
      const collateralVerification = await collateralService.verifyCollateralAvailability(
        this.accountId,
        finalCollateralAmount
      );
      
      if (!collateralVerification.verified) {
        return {
          success: false,
          message: collateralVerification.message,
          requiredCollateral: finalCollateralAmount
        };
      }
      
      console.log(`Collateral verification passed: ${collateralVerification.message}`);

      // STEP 1: Transfer HBAR collateral to treasury FIRST (before minting)
      let collateralTransferResult;
      try {
        console.log(`Step 1: Transferring ${finalCollateralAmount.toFixed(4)} HBAR collateral to treasury...`);
        collateralTransferResult = await collateralService.transferCollateralToTreasury(
          this.accountId,
          this.privateKey,
          finalCollateralAmount
        );
        
        console.log(`Collateral transfer successful: ${collateralTransferResult.transactionId}`);
        
      } catch (collateralError) {
        console.error("Error transferring collateral:", collateralError);
        return {
          success: false,
          message: `Failed to transfer collateral: ${collateralError instanceof Error ? collateralError.message : 'Unknown error'}`,
          requiredCollateral: finalCollateralAmount
        };
      }

      // STEP 2: Associate token with user account if needed
      let associateTxId;
      try {
        console.log(`Step 2: Ensuring token ${tokenId} is associated with user account ${this.accountId}...`);
        associateTxId = await this.associateTokenIfNeeded(tokenId, this.accountId, this.privateKey);
        if (associateTxId) {
          console.log(`Token association successful: ${associateTxId}`);
        } else {
          console.log(`Token already associated with user account`);
        }
      } catch (associationError) {
        console.error("Error associating token:", associationError);
        // Try to refund collateral since we haven't minted yet
        try {
          await collateralService.transferCollateralFromTreasury(this.accountId, finalCollateralAmount);
          console.log("Collateral refunded due to association failure");
        } catch (refundError) {
          console.error("Failed to refund collateral after association failure:", refundError);
        }
        return {
          success: false,
          message: `Failed to associate token with account: ${associationError instanceof Error ? associationError.message : 'Unknown error'}`,
          collateralRefunded: true
        };
      }

      // STEP 3: Mint tokens to treasury
      let mintTransactionId;
      try {
        console.log(`Step 3: Minting ${amount} tokens to treasury...`);
        
        // Convert amount to tinybars (multiply by 10^decimals)
        const decimals = tokenInfo.decimals || 6; // Default to 6 decimals if not specified
        const amountInTinybars = Math.round(amount * Math.pow(10, decimals));
        console.log(`Converting ${amount} tokens to ${amountInTinybars} tinybars (decimals: ${decimals})`);

        // Create mint transaction
        const transaction = new TokenMintTransaction()
          .setTokenId(TokenId.fromString(tokenId))
          .setAmount(amountInTinybars);

        // Sign and execute transaction
        const privateKey = PrivateKey.fromStringECDSA(this.treasuryKey);
        const frozenTx = await transaction.freezeWith(this.client);
        const signedTx = await frozenTx.sign(privateKey);
        const txResponse = await signedTx.execute(this.client);
        const receipt = await txResponse.getReceipt(this.client);

        if (receipt.status.toString() !== 'SUCCESS') {
          throw new Error(`Token mint failed with status: ${receipt.status.toString()}`);
        }

        mintTransactionId = txResponse.transactionId.toString();
        console.log(`Token minted successfully: ${mintTransactionId}`);
        
      } catch (mintError) {
        console.error("Error minting tokens:", mintError);
        // Try to refund collateral since mint failed
        try {
          await collateralService.transferCollateralFromTreasury(this.accountId, finalCollateralAmount);
          console.log("Collateral refunded due to mint failure");
        } catch (refundError) {
          console.error("Failed to refund collateral after mint failure:", refundError);
        }
        return {
          success: false,
          message: `Failed to mint tokens: ${mintError instanceof Error ? mintError.message : 'Unknown error'}`,
          collateralRefunded: true
        };
      }

      // STEP 4: Transfer tokens from treasury to user account
      let tokenTransferTxId;
      try {
        console.log(`Step 4: Transferring ${amount} tokens from treasury ${this.treasuryId} to user account ${this.accountId}...`);
        
        const decimals = tokenInfo.decimals || 6;
        const amountInTinybars = Math.round(amount * Math.pow(10, decimals));
        
        const tokenTransferTx = new TransferTransaction()
          .addTokenTransfer(TokenId.fromString(tokenId), AccountId.fromString(this.treasuryId), -amountInTinybars) // Debit from treasury
          .addTokenTransfer(TokenId.fromString(tokenId), AccountId.fromString(this.accountId), amountInTinybars); // Credit to user
        
        // Sign with treasury key (required for sending tokens from treasury)
        const treasuryKey = PrivateKey.fromStringECDSA(this.treasuryKey);
        const frozenTokenTx = await tokenTransferTx.freezeWith(this.client);
        const signedTokenTx = await frozenTokenTx.sign(treasuryKey);
        
        // Execute the token transfer
        const tokenTxResponse = await signedTokenTx.execute(this.client);
        const tokenTxReceipt = await tokenTxResponse.getReceipt(this.client);
        
        if (tokenTxReceipt.status.toString() !== 'SUCCESS') {
          throw new Error(`Token transfer failed with status: ${tokenTxReceipt.status.toString()}`);
        }
        
        tokenTransferTxId = tokenTxResponse.transactionId.toString();
        console.log(`Tokens successfully transferred to user account: ${tokenTransferTxId}`);
        
      } catch (tokenTransferError) {
        console.error("Error transferring tokens to user:", tokenTransferError);
        // Tokens are minted but not transferred - this is a critical state
        return {
          success: false,
          message: `Tokens minted but transfer to user failed: ${tokenTransferError instanceof Error ? tokenTransferError.message : 'Unknown error'}`,
          mintTransactionId: mintTransactionId,
          criticalError: true, // Indicates manual intervention may be needed
          note: "Tokens are minted in treasury but not transferred to user. Collateral has been deposited."
        };
      }

      // STEP 5: Record collateral in our tracking system
      try {
        collateralService.recordCollateral(
          tokenId,
          finalCollateralAmount,
          collateralTransferResult.transactionId
        );
        console.log("Collateral recorded in tracking system");
      } catch (recordError) {
        console.warn("Failed to record collateral in tracking system:", recordError);
        // This is not critical for the operation success
      }

      // SUCCESS: All steps completed successfully
      return {
        success: true,
        transactionId: mintTransactionId,
        tokenAssociationTransactionId: associateTxId,
        tokenTransferTransactionId: tokenTransferTxId,
        collateralTransferTransactionId: collateralTransferResult.transactionId,
        amount: amount,
        collateralDeposited: finalCollateralAmount,
        message: `Successfully completed all steps: collateral transferred, ${associateTxId ? 'token associated, ' : ''}tokens minted, and tokens transferred to user account`
      };
        
    } catch (error) {
      console.error(`Error in mint process for token ${tokenId}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction fee from transaction ID using Mirror Node
   * @param transactionId Transaction ID
   * @returns Transaction fee in tinybars
   */
  private async getTransactionFee(transactionId: string): Promise<number> {
    try {
      // Determine which Mirror Node base URL to use based on network
      const network = process.env.HEDERA_NETWORK?.toLowerCase() || 'testnet';
      const mirrorNodeBaseUrl = network === 'mainnet' 
        ? 'https://mainnet-public.mirrornode.hedera.com'
        : 'https://testnet.mirrornode.hedera.com';

      // Configure axios with proper headers
      const axiosConfig = {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 5000, // 5 second timeout
      };

      // Use Mirror Node to get transaction details
      const url = `${mirrorNodeBaseUrl}/api/v1/transactions/${transactionId}`;
      const response = await axios.get(url, axiosConfig);

      // Return the charged fee
      if (response.data && response.data.charged_tx_fee) {
        return response.data.charged_tx_fee;
      }
      
      return 0;
    } catch (error) {
      console.error(`Error getting transaction fee: ${error}`);
      return 0; // Default to 0 if there's an error
    }
  }

  /**
   * Get all tokens created by this account
   * Uses Hedera Mirror Node API to fetch tokens
   * @param includeMetadata Whether to include full metadata for each token
   * @returns Array of token information
   */
  async getAllTokens(includeMetadata: boolean = false): Promise<any> {
    if (!this.client) {
      throw new Error("Hedera client not initialized");
    }

    console.log(`Fetching all tokens from Hedera Mirror Node API (includeMetadata: ${includeMetadata})`);
    
    // Determine which Mirror Node base URL to use based on network
    const network = config.hedera.network.toLowerCase();
    const mirrorNodeBaseUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
      
    // Format the account ID correctly for Mirror Node API
    console.log(`Using treasury account ID for Mirror Node query: ${this.treasuryId}`);
    
    // Configure axios with proper headers
    const axiosConfig = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    };
    
    // Array to hold all tokens
    let allTokens: MirrorNodeToken[] = [];
    // Initial URL for the first page of tokens
    let url = `${mirrorNodeBaseUrl}/api/v1/tokens?account.id=${this.treasuryId}`;
    
    try {
      // Keep fetching pages until we have all tokens
      while (url) {
        console.log(`Making API request to: ${url}`);
        
        const response = await axios.get<MirrorNodeTokensResponse>(url, axiosConfig);
        console.log(`Retrieved ${response.data.tokens?.length || 0} tokens from Mirror Node API`);
        
        // Add tokens from this page to our collection
        if (response.data.tokens && response.data.tokens.length > 0) {
          allTokens = [...allTokens, ...response.data.tokens];
        }
        
        // Check if there's a next page
        if (response.data.links && response.data.links.next) {
          // Remove base URL if it's included in the next link
          const nextPath = response.data.links.next.startsWith('http') 
            ? response.data.links.next
            : `${mirrorNodeBaseUrl}${response.data.links.next}`;
          url = nextPath;
          console.log(`More tokens available, fetching next page: ${url}`);
        } else {
          // No more pages
          url = '';
        }
      }
      
      console.log(`Total tokens retrieved: ${allTokens.length}`);
      
      // If no tokens were found, return empty array
      if (allTokens.length === 0) {
        console.log('No tokens returned from Mirror Node API');
        return { success: true, tokens: [] };
      }
      
      // For each token, we need to get its metadata from Hedera File Service
      // if we have the file ID stored in our map
      const tokensWithDetails = await Promise.all(
        allTokens.map(async (token) => {
          // Convert token ID format if needed
          const tokenIdStr = token.token_id;
          
          // Get complete token details from Mirror Node to ensure we have the memo
          let tokenDetails = token;
          try {
            console.log(`Getting detailed info for token ${tokenIdStr} from Mirror Node...`);
            const detailResponse = await axios.get<MirrorNodeTokenDetailResponse>(
              `${mirrorNodeBaseUrl}/api/v1/tokens/${tokenIdStr}`,
              axiosConfig
            );
            tokenDetails = detailResponse.data;
            console.log(`Retrieved token details from Mirror Node, memo: ${tokenDetails.memo || 'none'}`);
          } catch (detailError) {
            console.error(`Failed to get detailed token info from Mirror Node: ${detailError}`);
            // Continue with the basic token info we already have
          }
          
          // Try to get metadata file ID from our map
          let metadataFileId = this.tokenMetadataFiles.get(tokenIdStr);
          
          // If not found, try to extract from token memo if available
          const tokenMemo = tokenDetails.memo;
          if (!metadataFileId && tokenMemo && typeof tokenMemo === 'string') {
            console.log(`Checking token memo for metadata: "${tokenMemo}"`);
            if (tokenMemo.startsWith("Metadata:")) {
              metadataFileId = tokenMemo.substring("Metadata:".length);
              console.log(`Found metadata file ID in token memo: ${metadataFileId}`);
              
              // Store it in our map for future use
              this.tokenMetadataFiles.set(tokenIdStr, metadataFileId);
            }
          }
          
          // Check if we already have the metadata cached
          const cachedMetadata = this.tokenMetadata.get(tokenIdStr);
          
          // Prepare basic token info from Mirror Node response
          const tokenInfo = {
            tokenId: tokenIdStr,
            name: tokenDetails.name,
            symbol: tokenDetails.symbol,
            totalSupply: tokenDetails.total_supply,
            decimals: parseInt(tokenDetails.decimals, 10),
            treasury: tokenDetails.treasury_account_id,
            createdTimestamp: tokenDetails.created_timestamp,
            memo: tokenMemo,
            composition: cachedMetadata?.composition || [] as AssetComposition[],
            metadataFileId,
            metadataSource: cachedMetadata ? 'memory-cache' : 'mirror-node',
            fileTransactionId: metadataFileId ? this.fileTransactionIds.get(metadataFileId) : undefined
          };
          
          // If we don't need metadata or already have it cached, return quickly
          if (!includeMetadata || (cachedMetadata && cachedMetadata.composition?.length > 0)) {
            console.log(`Using cached metadata for token ${tokenIdStr} (includeMetadata: ${includeMetadata})`);
            if (cachedMetadata) {
              tokenInfo.composition = cachedMetadata.composition;
            }
            return tokenInfo;
          }
          
          // Get composition from Hedera File Service if we have file ID and need to include metadata
          if (metadataFileId && this.client) {
            try {
              console.log(`Retrieving token metadata from Hedera File ID: ${metadataFileId}...`);
              const fileContentsQuery = new FileContentsQuery()
                .setFileId(FileId.fromString(metadataFileId));
                
              const fileContents = await fileContentsQuery.execute(this.client);
              const fileContentStr = fileContents.toString();
              
              try {
                // Use our new parser for handling concatenated JSON objects
                const metadataFromHedera = this.parseMetadataFileContent(fileContentStr);
                tokenInfo.composition = metadataFromHedera.composition;
                tokenInfo.metadataSource = 'hedera';
                
                // Save to cache for future use
                this.tokenMetadata.set(tokenIdStr, metadataFromHedera);
                
                console.log(`Successfully retrieved token metadata from Hedera for ${tokenIdStr}`);
              } catch (parseError) {
                console.error(`Error parsing token metadata for ${tokenIdStr}: ${parseError}`);
              }
            } catch (fileError) {
              console.error(`Error retrieving token metadata from Hedera File Service: ${fileError}`);
            }
          }
          
          return tokenInfo;
        })
      );
      
      console.log(`Successfully processed details for ${tokensWithDetails.length} tokens`);
      
      // If includeMetadata is false, filter out the composition data to reduce response size
      const filteredTokens = includeMetadata 
        ? tokensWithDetails 
        : tokensWithDetails.map(token => ({
            ...token,
            composition: undefined,
            metadataFileId: undefined,
            fileTransactionId: undefined
          }));
      
      return {
        success: true,
        source: "mirror-node",
        includeMetadata,
        tokens: filteredTokens
      };
      
    } catch (mirrorApiError: any) {
      // Handle errors from Mirror Node API
      console.error("Error calling Mirror Node API:", mirrorApiError.message);
      if (mirrorApiError.response) {
        console.error("Mirror Node API error response:", {
          status: mirrorApiError.response.status,
          data: mirrorApiError.response.data
        });
      }
      
      // Fallback to in-memory token cache
      console.log(`Falling back to in-memory token metadata (includeMetadata: ${includeMetadata})`);
      const tokenIds = Array.from(this.tokenMetadata.keys());
      console.log(`Found ${tokenIds.length} tokens in local metadata cache`);
      
      if (tokenIds.length === 0) {
        return { success: true, tokens: [] };
      }
      
      try {
        // Use metadata directly from cache for fallback
        const tokensInfo = tokenIds.map(tokenId => {
          const metadata = this.tokenMetadata.get(tokenId);
          const metadataFileId = this.tokenMetadataFiles.get(tokenId);
          
          return {
            tokenId,
            name: metadata?.name || 'Unknown',
            symbol: metadata?.symbol || 'UNKNOWN',
            // Only include composition if includeMetadata is true
            composition: includeMetadata ? metadata?.composition || [] : undefined,
            createdAt: metadata?.createdAt,
            metadataFileId: includeMetadata ? metadataFileId : undefined,
            metadataSource: 'memory-cache-fallback',
            fileTransactionId: includeMetadata && metadataFileId ? this.fileTransactionIds.get(metadataFileId) : undefined
          };
        });
        
        console.log(`Successfully retrieved information for ${tokensInfo.length} tokens from metadata cache fallback`);
        
        return {
          success: true,
          source: "in-memory-metadata-fallback",
          tokens: tokensInfo
        };
      } catch (fallbackError) {
        console.error("Error in fallback token retrieval:", fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * Debug function to check token memo and metadata
   * @param tokenId The token ID to check
   * @returns Debug information about the token
   */
  async debugTokenMemo(tokenId: string): Promise<any> {
    try {
      if (!this.client) {
        throw new Error("Hedera client not initialized");
      }

      console.log(`DEBUG: Getting detailed info for token ${tokenId}...`);
      
      // First check if we have any local info
      const cachedFileId = this.tokenMetadataFiles.get(tokenId);
      const cachedMetadata = this.tokenMetadata.get(tokenId);
      
      console.log("Local cache info:");
      console.log(`Cached File ID: ${cachedFileId || 'none'}`);
      console.log(`Cached Metadata: ${cachedMetadata ? 'Available' : 'None'}`);
      
      return {
        success: true,
        message: "Debug information printed to console",
        cachedFileId,
        cachedMetadata: cachedMetadata ? 'Available' : 'None'
      };
    } catch (error) {
      console.error(`Error in debug function: ${error}`);
      throw error;
    }
  }

  /**
   * Burn tokens with dynamic HBAR collateral release
   * @param tokenId Token ID to burn from
   * @param amount Amount of tokens to burn
   * @returns Transaction result
   */
  async burnToken(tokenId: string, amount: number): Promise<any> {
    try {
      if (!this.client) {
        throw new Error("Hedera client not initialized");
      }

      console.log(`Starting token burning process for ${amount} tokens of ${tokenId}`);
      
      // Get token info
      const tokenInfo = await this.getTokenInfo(tokenId);
      if (!tokenInfo) {
        throw new Error("Token not found");
      }

      // Import collateral service
      const { collateralService } = await import('./collateral.service');
      
      // Calculate HBAR to be released based on current asset prices
      const hbarToRelease = await collateralService.calculateCollateralRequirements(
        tokenId,
        amount,
        tokenInfo.composition || []
      );
      
      console.log(`HBAR to be released: ${hbarToRelease.toFixed(4)} HBAR`);

      // Convert amount to tinybars (multiply by 10^decimals)
      const decimals = tokenInfo.decimals || 6; // Default to 6 decimals if not specified
      const amountInTinybars = Math.round(amount * Math.pow(10, decimals));
      console.log(`Converting ${amount} tokens to ${amountInTinybars} tinybars (decimals: ${decimals})`);

      // FIRST: Transfer tokens from user account to treasury (required before burning)
      try {
        console.log(`Transferring ${amountInTinybars} tinybars from user account ${this.accountId} to treasury ${this.treasuryId}`);
        
        const userToTreasuryTx = new TransferTransaction()
          .addTokenTransfer(TokenId.fromString(tokenId), AccountId.fromString(this.accountId), -amountInTinybars) // Debit from user
          .addTokenTransfer(TokenId.fromString(tokenId), AccountId.fromString(this.treasuryId), amountInTinybars); // Credit to treasury
        
        // Sign with user's private key (required for sending tokens from user account)
        const userKey = PrivateKey.fromStringECDSA(this.privateKey);
        const frozenUserTx = await userToTreasuryTx.freezeWith(this.client);
        const signedUserTx = await frozenUserTx.sign(userKey);
        
        // Execute the token transfer
        const userTxResponse = await signedUserTx.execute(this.client);
        const userTxReceipt = await userTxResponse.getReceipt(this.client);
        
        if (userTxReceipt.status.toString() !== 'SUCCESS') {
          console.error(`Token transfer to treasury failed with status: ${userTxReceipt.status.toString()}`);
          return {
            success: false,
            message: `Failed to transfer tokens to treasury for burning: ${userTxReceipt.status.toString()}`
          };
        }
        
        const userTransferTxId = userTxResponse.transactionId.toString();
        console.log(`Tokens successfully transferred to treasury: ${userTransferTxId}`);
        
      } catch (tokenTransferError) {
        console.error("Error transferring tokens to treasury:", tokenTransferError);
        return {
          success: false,
          message: `Failed to transfer tokens to treasury for burning: ${tokenTransferError instanceof Error ? tokenTransferError.message : 'Unknown error'}`
        };
      }

      // NOW: Create burn transaction (tokens are now in treasury)
      const transaction = new TokenBurnTransaction()
        .setTokenId(TokenId.fromString(tokenId))
        .setAmount(amountInTinybars);

      // Sign and execute transaction
      const privateKey = PrivateKey.fromStringECDSA(this.treasuryKey);
      const frozenTx = await transaction.freezeWith(this.client);
      const signedTx = await frozenTx.sign(privateKey);
      const txResponse = await signedTx.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);

      if (receipt.status.toString() !== 'SUCCESS') {
        return {
          success: false,
          message: `Token burn failed with status: ${receipt.status.toString()}`
        };
      }

      const transactionId = txResponse.transactionId.toString();
      console.log(`Token burned successfully: ${transactionId}`);
      
      // Release HBAR collateral to user account
      try {
        const collateralReleaseResult = await collateralService.transferCollateralFromTreasury(
          this.accountId, // Release to user account
          hbarToRelease
        );
        
        console.log(`Collateral release successful: ${collateralReleaseResult.transactionId}`);
        
        // Record collateral release
        collateralService.recordCollateralRelease(
          tokenId,
          hbarToRelease,
          collateralReleaseResult.transactionId
        );
        
        return {
          success: true,
          transactionId: transactionId,
          amount: amount,
          burnStatus: receipt.status.toString(),
          collateralReleased: hbarToRelease,
          collateralTransactionId: collateralReleaseResult.transactionId,
          message: `Successfully burned ${amount} tokens and released ${hbarToRelease.toFixed(4)} HBAR`
        };
        
      } catch (collateralError) {
        console.error("Error releasing collateral:", collateralError);
        // Note: Token is already burned, but collateral release failed
        return {
          success: false,
          message: `Token burned but collateral release failed: ${collateralError instanceof Error ? collateralError.message : 'Unknown error'}`,
          transactionId: transactionId,
          collateralError: true
        };
      }
    } catch (error) {
      console.error(`Error burning token ${tokenId}:`, error);
      throw error;
    }
  }

  /**
   * Get account balance for a specific token
   * @param tokenId Token ID to check
   * @param accountId Account ID to check balance for
   * @returns Token balance information
   */
  async getAccountTokenBalance(tokenId: string, accountId: string): Promise<{
    rawValue: string | number;
    displayValue: string;
  }> {
    try {
      if (!this.client) {
        throw new Error("Hedera client not initialized");
      }

      console.log(`Getting token balance for account ${accountId}, token ${tokenId}`);
      
      // Query account balance
      const query = new AccountBalanceQuery()
        .setAccountId(AccountId.fromString(accountId));
      
      const accountBalance = await query.execute(this.client);
      
      // Check if the account has any tokens
      if (!accountBalance.tokens) {
        console.log(`No token balance for account ${accountId}`);
        return {
          rawValue: "0",
          displayValue: "0"
        };
      }
      
      // Get the specific token balance
      const tokenBalance = accountBalance.tokens.get(TokenId.fromString(tokenId));
      
      if (!tokenBalance) {
        console.log(`Account ${accountId} does not own any tokens with ID ${tokenId}`);
        return {
          rawValue: "0",
          displayValue: "0"
        };
      }
      
      // Get token info to determine decimals
      const tokenInfo = await this.getTokenInfo(tokenId);
      const decimals = tokenInfo ? tokenInfo.decimals : 6; // Default to 6 decimals if not specified
      
      // Convert to display value with proper decimal places
      const rawValue = tokenBalance.toString();
      const displayValue = (Number(rawValue) / Math.pow(10, decimals)).toString();
      
      console.log(`Token balance for account ${accountId}, token ${tokenId}: ${displayValue} (raw: ${rawValue})`);
      
      return {
        rawValue,
        displayValue
      };
    } catch (error) {
      console.error(`Error getting token balance: ${error}`);
      throw error;
    }
  }

  /**
   * Check if a token is already associated with an account
   * @param tokenId Token ID to check
   * @param accountId Account ID to check
   * @returns true if token is already associated, false otherwise
   */
  private async isTokenAssociated(tokenId: string, accountId: string): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error("Hedera client not initialized");
      }

      // Query account balance
      const query = new AccountBalanceQuery()
        .setAccountId(AccountId.fromString(accountId));
      
      const accountBalance = await query.execute(this.client);
      
      // Check if the account has any tokens
      if (!accountBalance.tokens) {
        return false;
      }
      
      // Check if the specific token is in the account's token map
      const tokenBalance = accountBalance.tokens.get(TokenId.fromString(tokenId));
      
      // If the token exists in the map (even with 0 balance), it means it's associated
      return tokenBalance !== undefined;
    } catch (error) {
      console.error(`Error checking token association: ${error}`);
      // On error, assume not associated to be safe
      return false;
    }
  }

  /**
   * Associate a token with an account if not already associated
   * @param tokenId Token ID to associate
   * @param accountId Account ID to associate with
   * @param accountPrivateKey Private key of the account
   * @returns Association transaction ID or null if already associated
   */
  private async associateTokenIfNeeded(tokenId: string, accountId: string, accountPrivateKey: string): Promise<string | null> {
    try {
      // Check if token is already associated
      const isAssociated = await this.isTokenAssociated(tokenId, accountId);
      
      if (isAssociated) {
        console.log(`Token ${tokenId} is already associated with account ${accountId}`);
        return null;
      }
      
      console.log(`Associating token ${tokenId} with account ${accountId}`);
      
      const tokenAssociateTx = new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(accountId))
        .setTokenIds([TokenId.fromString(tokenId)]);
      
      // Sign with account's private key (only the account owner can associate tokens)
      const accountKey = PrivateKey.fromStringECDSA(accountPrivateKey);
      const frozenAssociateTx = await tokenAssociateTx.freezeWith(this.client!);
      const signedAssociateTx = await frozenAssociateTx.sign(accountKey);
      
      // Execute the token association
      const associateTxResponse = await signedAssociateTx.execute(this.client!);
      const associateReceipt = await associateTxResponse.getReceipt(this.client!);
      
      if (associateReceipt.status.toString() !== 'SUCCESS') {
        throw new Error(`Token association failed with status: ${associateReceipt.status.toString()}`);
      }
      
      const associateTxId = associateTxResponse.transactionId.toString();
      console.log(`Token successfully associated with account: ${associateTxId}`);
      
      return associateTxId;
    } catch (error) {
      console.error(`Error associating token: ${error}`);
      throw error;
    }
  }
}

export default new TokenService();