require('dotenv').config();

const { 
  Client, 
  PrivateKey, 
  AccountId,
  TokenDissociateTransaction,
  Hbar,
  AccountBalanceQuery,
  TokenInfoQuery
} = require('@hashgraph/sdk');

async function dissociateDeletedTokens() {
  try {
    console.log("🔄 Script di dissociazione tokens eliminati");
    console.log("==========================================");
    
    // Check environment variables
    const operatorId = process.env.HEDERA_ACCOUNT_ID;
    const operatorKey = process.env.HEDERA_PRIVATE_KEY;
    const network = process.env.HEDERA_NETWORK || 'testnet';
    
    console.log(`🌐 Network: ${network}`);
    console.log(`👤 Account ID: ${operatorId}`);
    
    if (!operatorId || !operatorKey) {
      throw new Error("❌ HEDERA_ACCOUNT_ID e HEDERA_PRIVATE_KEY devono essere presenti");
    }
    
    // Create client
    const client = network === 'mainnet' 
      ? Client.forMainnet() 
      : Client.forTestnet();
    
    // Set operator
    const operatorPrivateKey = PrivateKey.fromStringECDSA(operatorKey);
    client.setOperator(AccountId.fromString(operatorId), operatorPrivateKey);
    
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
      console.log("✅ Nessun token associato al tuo account!");
      return;
    }
    
    console.log(`📋 Trovati ${tokenIds.length} tokens associati:`);
    
    let dissociatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const failedTokens = [];
    const tokensToDisassociate = [];
    
    // First, check which tokens are deleted
    for (const tokenId of tokenIds) {
      try {
        console.log(`\n🔄 Controllo token: ${tokenId}`);
        
        // Get token info
        const tokenInfo = await new TokenInfoQuery()
          .setTokenId(tokenId)
          .execute(client);
        
        console.log(`   📝 Nome: ${tokenInfo.name || 'N/A'}`);
        console.log(`   🔖 Simbolo: ${tokenInfo.symbol || 'N/A'}`);
        console.log(`   🗑️  Eliminato: ${tokenInfo.isDeleted ? 'Sì' : 'No'}`);
        
        const balance = tokens.get(tokenId);
        console.log(`   💰 Balance: ${balance || 0}`);
        
        // Only dissociate if token is deleted AND balance is 0
        if (tokenInfo.isDeleted && (balance === null || balance.isZero())) {
          console.log(`   ✅ Token candidato per dissociazione`);
          tokensToDisassociate.push(tokenId);
        } else if (tokenInfo.isDeleted && balance && !balance.isZero()) {
          console.log(`   ⚠️  Token eliminato ma hai ancora balance: ${balance}`);
          console.log(`   ❌ Non posso dissociare token con balance > 0`);
          skippedCount++;
        } else {
          console.log(`   ℹ️  Token attivo, non verrà dissociato`);
          skippedCount++;
        }
        
      } catch (error) {
        console.log(`   ❌ Errore durante il controllo: ${error.message}`);
        failedCount++;
        failedTokens.push({ tokenId, reason: error.message });
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (tokensToDisassociate.length === 0) {
      console.log("\n✅ Nessun token da dissociare!");
      return;
    }
    
    console.log(`\n🔄 Dissociazione di ${tokensToDisassociate.length} tokens...`);
    
    try {
      // Dissociate tokens in batches (max 10 at a time)
      const batchSize = 10;
      for (let i = 0; i < tokensToDisassociate.length; i += batchSize) {
        const batch = tokensToDisassociate.slice(i, i + batchSize);
        
        console.log(`\n📦 Batch ${Math.floor(i/batchSize) + 1}: dissociando ${batch.length} tokens...`);
        batch.forEach(tokenId => console.log(`   • ${tokenId}`));
        
        const dissociateTransaction = new TokenDissociateTransaction()
          .setAccountId(operatorId)
          .setTokenIds(batch)
          .setMaxTransactionFee(new Hbar(20));
        
        // Freeze, sign and execute
        const frozenTx = await dissociateTransaction.freezeWith(client);
        const signedTx = await frozenTx.sign(operatorPrivateKey);
        const txResponse = await signedTx.execute(client);
        const receipt = await txResponse.getReceipt(client);
        
        if (receipt.status.toString() === 'SUCCESS') {
          console.log(`   ✅ Batch dissociato con successo!`);
          console.log(`   📋 Transaction ID: ${txResponse.transactionId.toString()}`);
          dissociatedCount += batch.length;
        } else {
          console.log(`   ❌ Dissociazione batch fallita: ${receipt.status.toString()}`);
          failedCount += batch.length;
        }
        
        // Delay between batches
        if (i + batchSize < tokensToDisassociate.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
    } catch (error) {
      console.error(`❌ Errore durante la dissociazione: ${error.message}`);
      failedCount += tokensToDisassociate.length - dissociatedCount;
    }
    
    // Summary
    console.log("\n📊 RIEPILOGO OPERAZIONI:");
    console.log("=========================");
    console.log(`✅ Tokens dissociati: ${dissociatedCount}`);
    console.log(`⚠️  Tokens saltati: ${skippedCount}`);
    console.log(`❌ Tokens falliti: ${failedCount}`);
    
    if (failedTokens.length > 0) {
      console.log("\n❌ ERRORI RISCONTRATI:");
      failedTokens.forEach(({ tokenId, reason }) => {
        console.log(`   • ${tokenId}: ${reason}`);
      });
    }
    
    console.log("\n🎉 Operazione completata!");
    console.log("💡 I tokens dissociati non appariranno più nella tua dashboard");
    
  } catch (error) {
    console.error("💥 Errore generale:", error);
  }
}

// Execute if run directly
if (require.main === module) {
  dissociateDeletedTokens();
}

module.exports = { dissociateDeletedTokens }; 