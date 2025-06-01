require('dotenv').config();

const { 
  Client, 
  PrivateKey, 
  AccountId,
  TokenDeleteTransaction,
  Hbar,
  AccountBalanceQuery,
  TokenInfoQuery
} = require('@hashgraph/sdk');

async function deleteAllTokens() {
  try {
    console.log("🗑️  Script di eliminazione tokens ETF");
    console.log("====================================");
    
    // Check environment variables
    const operatorId = process.env.HEDERA_ACCOUNT_ID;
    const operatorKey = process.env.HEDERA_PRIVATE_KEY;
    const treasuryId = process.env.HEDERA_TREASURY_ID;
    const treasuryKey = process.env.HEDERA_TREASURY_KEY;
    const network = process.env.HEDERA_NETWORK || 'testnet';
    
    console.log(`🌐 Network: ${network}`);
    console.log(`👤 Operator ID: ${operatorId}`);
    console.log(`🏦 Treasury ID: ${treasuryId}`);
    
    if (!operatorId || !operatorKey) {
      throw new Error("❌ HEDERA_ACCOUNT_ID e HEDERA_PRIVATE_KEY devono essere presenti");
    }
    
    if (!treasuryId || !treasuryKey) {
      throw new Error("❌ HEDERA_TREASURY_ID e HEDERA_TREASURY_KEY devono essere presenti");
    }
    
    // Create client
    const client = network === 'mainnet' 
      ? Client.forMainnet() 
      : Client.forTestnet();
    
    // Set operator
    const operatorPrivateKey = PrivateKey.fromStringECDSA(operatorKey);
    client.setOperator(AccountId.fromString(operatorId), operatorPrivateKey);
    
    // Parse admin key (per firmare le transazioni di delete)
    const adminKey = PrivateKey.fromStringECDSA(operatorKey);
    
    console.log("\n🔍 Ricerca tokens nel tuo account...");
    
    // Get account balance to see which tokens you have
    const accountBalance = await new AccountBalanceQuery()
      .setAccountId(operatorId)
      .execute(client);
    
    console.log(`💰 Balance HBAR: ${accountBalance.hbars.toString()}`);
    
    // Get all tokens associated with the account
    const tokens = accountBalance.tokens;
    const tokenIds = Array.from(tokens.keys());
    
    if (tokenIds.length === 0) {
      console.log("✅ Nessun token trovato nel tuo account!");
      return;
    }
    
    console.log(`📋 Trovati ${tokenIds.length} tokens:`);
    
    let deletedCount = 0;
    let failedCount = 0;
    const failedTokens = [];
    
    // Process each token
    for (const tokenId of tokenIds) {
      try {
        console.log(`\n🔄 Elaborazione token: ${tokenId}`);
        
        // Get token info to check if we can delete it
        const tokenInfo = await new TokenInfoQuery()
          .setTokenId(tokenId)
          .execute(client);
        
        console.log(`   📝 Nome: ${tokenInfo.name || 'N/A'}`);
        console.log(`   🔖 Simbolo: ${tokenInfo.symbol || 'N/A'}`);
        console.log(`   🔑 Admin Key: ${tokenInfo.adminKey ? 'Presente' : 'Assente'}`);
        console.log(`   🗑️  Eliminato: ${tokenInfo.isDeleted ? 'Sì' : 'No'}`);
        
        // Skip if already deleted
        if (tokenInfo.isDeleted) {
          console.log(`   ⚠️  Token già eliminato, salto`);
          continue;
        }
        
        // Check if we have admin rights (admin key present and we control it)
        if (!tokenInfo.adminKey) {
          console.log(`   ❌ Impossibile eliminare: nessuna admin key`);
          failedCount++;
          failedTokens.push({ tokenId, reason: 'No admin key' });
          continue;
        }
        
        // Try to delete the token
        console.log(`   🗑️  Tentativo di eliminazione...`);
        
        const deleteTransaction = new TokenDeleteTransaction()
          .setTokenId(tokenId)
          .setMaxTransactionFee(new Hbar(20));
        
        // Freeze, sign and execute
        const frozenTx = await deleteTransaction.freezeWith(client);
        const signedTx = await frozenTx.sign(adminKey);
        const txResponse = await signedTx.execute(client);
        const receipt = await txResponse.getReceipt(client);
        
        if (receipt.status.toString() === 'SUCCESS') {
          console.log(`   ✅ Token eliminato con successo!`);
          console.log(`   📋 Transaction ID: ${txResponse.transactionId.toString()}`);
          deletedCount++;
        } else {
          console.log(`   ❌ Eliminazione fallita: ${receipt.status.toString()}`);
          failedCount++;
          failedTokens.push({ tokenId, reason: receipt.status.toString() });
        }
        
      } catch (error) {
        console.log(`   ❌ Errore durante l'eliminazione: ${error.message}`);
        failedCount++;
        failedTokens.push({ tokenId, reason: error.message });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summary
    console.log("\n📊 RIEPILOGO OPERAZIONI:");
    console.log("=========================");
    console.log(`✅ Tokens eliminati: ${deletedCount}`);
    console.log(`❌ Tokens non eliminati: ${failedCount}`);
    
    if (failedTokens.length > 0) {
      console.log("\n❌ TOKENS NON ELIMINATI:");
      failedTokens.forEach(({ tokenId, reason }) => {
        console.log(`   • ${tokenId}: ${reason}`);
      });
    }
    
    console.log("\n🎉 Operazione completata!");
    
  } catch (error) {
    console.error("💥 Errore generale:", error);
  }
}

// Execute if run directly
if (require.main === module) {
  deleteAllTokens();
}

module.exports = { deleteAllTokens }; 