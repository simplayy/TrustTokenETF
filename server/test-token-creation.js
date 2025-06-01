require('dotenv').config();
const { 
  Client, 
  PrivateKey, 
  AccountId,
  TokenCreateTransaction,
  Hbar,
  TokenMintTransaction
} = require('@hashgraph/sdk');

async function main() {
  try {
    console.log("Test script for Hedera token creation");
    console.log("-----------------------------------------");
    
    // Check environment variables
    const operatorId = process.env.HEDERA_ACCOUNT_ID;
    const operatorKey = process.env.HEDERA_PRIVATE_KEY;
    const treasuryId = process.env.HEDERA_TREASURY_ID;
    const treasuryKey = process.env.HEDERA_TREASURY_KEY;
    const network = process.env.HEDERA_NETWORK || 'testnet';
    
    console.log(`Using ${network} network`);
    console.log(`Operator ID: ${operatorId}`);
    console.log(`Treasury ID: ${treasuryId}`);
    
    if (!operatorId || !operatorKey) {
      throw new Error("Environment variables HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be present");
    }
    
    if (!treasuryId || !treasuryKey) {
      throw new Error("Environment variables HEDERA_TREASURY_ID and HEDERA_TREASURY_KEY must be present");
    }
    
    // Create client
    const client = network === 'mainnet' 
      ? Client.forMainnet() 
      : Client.forTestnet();
    
    // Set operator using ECDSA key format
    console.log("Parsing operator key as ECDSA...");
    const operatorPrivateKey = PrivateKey.fromStringECDSA(operatorKey);
    client.setOperator(AccountId.fromString(operatorId), operatorPrivateKey);
    console.log("Operator key set successfully");
    
    // Parse treasury key
    console.log("Parsing treasury key as ECDSA...");
    const treasuryPrivateKey = PrivateKey.fromStringECDSA(treasuryKey);
    console.log("Treasury key parsed successfully");
    
    // Create a token
    console.log("\nCreating test token...");
    const transaction = new TokenCreateTransaction()
      .setTokenName("Test Token")
      .setTokenSymbol("TST")
      .setTreasuryAccountId(AccountId.fromString(treasuryId))
      .setDecimals(2)
      .setInitialSupply(0) // Starting with 0 supply
      .setSupplyKey(operatorPrivateKey) // Adding supply key to allow minting
      .setMaxTransactionFee(new Hbar(20))
      .setTransactionMemo("Test token creation");
    
    // Freeze transaction for signing
    console.log("Freezing transaction...");
    const frozenTx = await transaction.freezeWith(client);
    
    // Sign with treasury key
    console.log("Signing with treasury key...");
    let signedTx = await frozenTx.sign(treasuryPrivateKey);
    
    // If operator and treasury are different, sign with operator key too
    if (operatorId !== treasuryId) {
      console.log("Signing with operator key...");
      signedTx = await signedTx.sign(operatorPrivateKey);
    }
    
    // Execute transaction
    console.log("Executing transaction...");
    const response = await signedTx.execute(client);
    
    // Get receipt
    console.log("Waiting for receipt...");
    const receipt = await response.getReceipt(client);
    
    const tokenId = receipt.tokenId;
    console.log(`\nSUCCESS! Token created with ID: ${tokenId.toString()}`);
    
    // Try minting tokens
    console.log("\nMinting tokens for the newly created token...");
    const mintTx = new TokenMintTransaction()
      .setTokenId(tokenId)
      .setAmount(500) // Mint 5 tokens (with 2 decimals -> 500)
      .setMaxTransactionFee(new Hbar(10));
      
    const mintFreeze = await mintTx.freezeWith(client);
    const mintSigned = await mintFreeze.sign(operatorPrivateKey);
    const mintResponse = await mintSigned.execute(client);
    const mintReceipt = await mintResponse.getReceipt(client);
    
    console.log(`Minting successful! Status: ${mintReceipt.status.toString()}`);
    
  } catch (error) {
    console.error("\nERROR:", error);
    if (error.transactionId) {
      console.error("Transaction ID:", error.transactionId.toString());
    }
    if (error.status) {
      console.error("Status code:", error.status._code);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
  }); 