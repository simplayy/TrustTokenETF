require('dotenv').config();

const { 
  Client, 
  PrivateKey, 
  AccountId,
  TokenDissociateTransaction,
  Hbar,
  AccountBalanceQuery
} = require('@hashgraph/sdk');

async function simpleDissociate() {
  try {
    console.log("🗑️  SCRIPT SEMPLICE: Dissociazione TOTALE");
    console.log("========================================");
    console.log("🎯 Obiettivo: Pulire dashboard completamente");
    
    // Get both accounts
    const operatorId = process.env.HEDERA_ACCOUNT_ID;
    const operatorKey = process.env.HEDERA_PRIVATE_KEY;
    const treasuryId = process.env.HEDERA_TREASURY_ID;
    const treasuryKey = process.env.HEDERA_TREASURY_KEY;
    const network = process.env.HEDERA_NETWORK || 'testnet';
    
    console.log(`🌐 Network: ${network}`);
    console.log(`👤 Account da pulire: ${operatorId}`);
    console.log(`🏦 Treasury account: ${treasuryId}`);
    
    if (!operatorId || !operatorKey || !treasuryId || !treasuryKey) {
      throw new Error("❌ Tutti gli account devono essere presenti nel .env");
    }
    
    // Create client
    const client = network === 'mainnet' 
      ? Client.forMainnet() 
      : Client.forTestnet();
    
    // Set operator as main account
    const operatorPrivateKey = PrivateKey.fromStringECDSA(operatorKey);
    const treasuryPrivateKey = PrivateKey.fromStringECDSA(treasuryKey);
    
    client.setOperator(AccountId.fromString(operatorId), operatorPrivateKey);
    
    console.log("\n🔍 Ricerca TUTTI i tokens associati...");
    
    // Get account balance
    const accountBalance = await new AccountBalanceQuery()
      .setAccountId(operatorId)
      .execute(client);
    
    console.log(`💰 Balance HBAR: ${accountBalance.hbars.toString()}`);
    
    const tokens = accountBalance.tokens;
    const tokenIds = Array.from(tokens.keys());
    
    if (tokenIds.length === 0) {
      console.log("✅ Nessun token da dissociare!");
      return;
    }
    
    console.log(`📋 Trovati ${tokenIds.length} tokens da dissociare:`);
    
    // List all tokens
    let index = 1;
    for (const tokenId of tokenIds) {
      const balance = tokens.get(tokenId);
      console.log(`   ${index}. ${tokenId} - Balance: ${balance || 0}`);
      index++;
    }
    
    console.log(`\n🔄 Inizio dissociazione FORZATA...`);
    console.log("⚠️  Userò ENTRAMBE le firme per garantire successo");
    
    let dissociatedCount = 0;
    let failedCount = 0;
    const failedTokens = [];
    
    // Try to dissociate ALL tokens in batches
    const batchSize = 5; // Smaller batches for better success rate
    
    for (let i = 0; i < tokenIds.length; i += batchSize) {
      const batch = tokenIds.slice(i, i + batchSize);
      const batchNum = Math.floor(i/batchSize) + 1;
      
      console.log(`\n📦 Batch ${batchNum}/${Math.ceil(tokenIds.length/batchSize)}: Dissociando ${batch.length} tokens...`);
      batch.forEach((tokenId, idx) => console.log(`   ${i+idx+1}. ${tokenId}`));
      
      try {
        // Create dissociate transaction
        const dissociateTransaction = new TokenDissociateTransaction()
          .setAccountId(operatorId)
          .setTokenIds(batch)
          .setMaxTransactionFee(new Hbar(50)); // Higher fee for safety
        
        // Freeze transaction
        const frozenTx = await dissociateTransaction.freezeWith(client);
        
        // Sign with BOTH keys for maximum compatibility
        let signedTx = await frozenTx.sign(operatorPrivateKey);
        signedTx = await signedTx.sign(treasuryPrivateKey);
        
        // Execute
        const txResponse = await signedTx.execute(client);
        const receipt = await txResponse.getReceipt(client);
        
        if (receipt.status.toString() === 'SUCCESS') {
          console.log(`   ✅ Batch ${batchNum} dissociato con successo!`);
          console.log(`   📋 TX ID: ${txResponse.transactionId.toString()}`);
          dissociatedCount += batch.length;
        } else {
          console.log(`   ❌ Batch ${batchNum} fallito: ${receipt.status.toString()}`);
          failedCount += batch.length;
          batch.forEach(tokenId => {
            failedTokens.push({ tokenId, reason: receipt.status.toString() });
          });
        }
        
      } catch (error) {
        console.log(`   ❌ Errore batch ${batchNum}: ${error.message}`);
        failedCount += batch.length;
        batch.forEach(tokenId => {
          failedTokens.push({ tokenId, reason: error.message });
        });
      }
      
      // Delay between batches
      if (i + batchSize < tokenIds.length) {
        console.log("   ⏳ Pausa 3 secondi prima del prossimo batch...");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Final verification
    console.log("\n🔍 Verifica finale...");
    const finalBalance = await new AccountBalanceQuery()
      .setAccountId(operatorId)
      .execute(client);
    
    const remainingTokens = Array.from(finalBalance.tokens.keys());
    
    // Final Summary
    console.log("\n📊 RISULTATO FINALE:");
    console.log("=====================");
    console.log(`✅ Tokens dissociati: ${dissociatedCount}`);
    console.log(`❌ Tokens falliti: ${failedCount}`);
    console.log(`🔍 Tokens rimasti: ${remainingTokens.length}`);
    
    if (remainingTokens.length === 0) {
      console.log("\n🎉 SUCCESSO TOTALE! Dashboard completamente pulita! 🎉");
      console.log("✨ Non dovresti più vedere nessun token nella dashboard");
    } else {
      console.log(`\n⚠️  Rimangono ${remainingTokens.length} tokens:`);
      remainingTokens.forEach(tokenId => console.log(`   • ${tokenId}`));
      
      if (failedTokens.length > 0) {
        console.log("\n❌ MOTIVI FALLIMENTI:");
        failedTokens.forEach(({ tokenId, reason }) => {
          console.log(`   • ${tokenId}: ${reason}`);
        });
      }
    }
    
    console.log("\n💡 Se alcuni token rimangono, potrebbero avere vincoli speciali di governance");
    console.log("🌐 In quel caso, usa il portale Hedera per rimuoverli manualmente");
    
  } catch (error) {
    console.error("💥 Errore generale:", error);
  }
}

// Execute if run directly
if (require.main === module) {
  simpleDissociate();
}

module.exports = { simpleDissociate }; 