import {
  Client,
  AccountId,
  PrivateKey,
  AccountBalanceQuery
} from "@hashgraph/sdk";
import config from "../config";

class HederaService {
  private client: Client | null = null;
  private accountId: string;
  private privateKey: string;
  private network: string;

  constructor() {
    this.accountId = config.hedera.accountId;
    this.privateKey = config.hedera.privateKey;
    this.network = config.hedera.network;
    this.initClient();
  }

  /**
   * Initialize Hedera client with account credentials
   */
  private initClient(): void {
    try {
      // Validate configuration
      if (!this.accountId || !this.privateKey) {
        console.error("Environment variables HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be present");
        return;
      }

      console.log(`Initializing Hedera client for network: ${this.network}`);
      console.log(`Using account ID: ${this.accountId}`);
      console.log(`Private key length: ${this.privateKey.length}`);

      // Create and set the client based on the network
      if (this.network === "mainnet") {
        this.client = Client.forMainnet();
      } else {
        this.client = Client.forTestnet();
      }

      // For ECDSA accounts, use fromStringECDSA
      try {
        console.log("Parsing operator key as ECDSA...");
        const privateKey = PrivateKey.fromStringECDSA(this.privateKey);
        console.log("Operator key parsed successfully");

        // Set operator 
        const operatorId = AccountId.fromString(this.accountId);
        this.client.setOperator(operatorId, privateKey);
        
        console.log(`Hedera client initialized for ${this.network} with account ${this.accountId}`);
      } catch (error) {
        console.error("Failed to parse private key as ECDSA:", error);
        this.client = null;
      }
    } catch (error) {
      console.error("Error initializing Hedera client:", error);
      this.client = null;
    }
  }

  /**
   * Check if the client is connected and properly configured
   * @returns Object with connection status and account info
   */
  async checkConnection(): Promise<{ connected: boolean; message?: string; accountId?: string; balance?: string; balanceNumber?: number }> {
    try {
      if (!this.client) {
        return { connected: false, message: "Hedera client not initialized" };
      }

      // Try to query account balance to verify connection
      const accountId = AccountId.fromString(this.accountId);
      const query = new AccountBalanceQuery().setAccountId(accountId);
      const accountBalance = await query.execute(this.client);

      // Convert HBAR balance properly
      const hbarBalance = accountBalance.hbars;
      const balanceString = hbarBalance.toString();
      const balanceNumber = parseFloat(balanceString);
      
      console.log(`Connection check - Account ${this.accountId} balance: ${balanceString} HBAR (${balanceNumber})`);

      return {
        connected: true,
        accountId: this.accountId,
        message: `Connected to ${this.network}`,
        balance: balanceString,
        balanceNumber: balanceNumber
      };
    } catch (error) {
      console.error("Hedera connection check failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { connected: false, message };
    }
  }

  /**
   * Get account information including balance
   * @returns Object with account details and balance
   */
  async getAccountInfo(): Promise<any> {
    try {
      if (!this.client) {
        throw new Error("Hedera client not initialized");
      }

      const accountId = AccountId.fromString(this.accountId);
      const query = new AccountBalanceQuery().setAccountId(accountId);
      const accountBalance = await query.execute(this.client);

      // Convert HBAR balance to a numeric value
      const hbarBalance = accountBalance.hbars;
      const balanceString = hbarBalance.toString();
      const balanceNumber = parseFloat(balanceString);
      
      console.log(`Account ${this.accountId} balance: ${balanceString} HBAR (${balanceNumber})`);

      return {
        accountId: this.accountId,
        balance: balanceNumber, // Return as number instead of string
        balanceString: balanceString, // Keep string version for debugging
        network: this.network
      };
    } catch (error) {
      console.error("Error getting account info:", error);
      throw error;
    }
  }

  /**
   * Get balance for a specific account ID
   * @param accountId The account ID to check
   * @returns Object with account balance
   */
  async getAccountBalanceById(accountId: string): Promise<{ balance: string; balanceNumber: number }> {
    try {
      if (!this.client) {
        throw new Error("Hedera client not initialized");
      }

      console.log(`Getting balance for account: ${accountId}`);
      const query = new AccountBalanceQuery().setAccountId(AccountId.fromString(accountId));
      const accountBalance = await query.execute(this.client);

      // Convert HBAR balance to both string and numeric values
      const hbarBalance = accountBalance.hbars;
      const balanceString = hbarBalance.toString();
      const balanceNumber = parseFloat(balanceString);
      
      console.log(`Account ${accountId} balance: ${balanceString} HBAR (${balanceNumber})`);

      return {
        balance: balanceString,
        balanceNumber: balanceNumber
      };
    } catch (error) {
      console.error(`Error getting balance for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get the client instance
   * @returns Hedera client instance
   */
  getClient(): Client | null {
    return this.client;
  }
}

// Singleton instance
export const hederaService = new HederaService(); 