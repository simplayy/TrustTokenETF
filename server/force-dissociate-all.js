require('dotenv').config();

const { 
  Client, 
  PrivateKey, 
  AccountId,
  TokenDissociateTransaction,
  TokenBurnTransaction,
  Hbar,
  AccountBalanceQuery,
  TokenInfoQuery
} = require('@hashgraph/sdk');

async function forceDissociateAll() {
  try {
    console.log("🔥 Script di dissociazione FORZATA tokens");
    console.log("=========================================");
    console.log("⚠️  ATTENZIONE: Questo script brucerà TUTTI i token rimanenti!");
    
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
    
    let burnedCount = 0;
    let dissociatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const failedTokens = [];
    const tokensToBurn = [];
    const tokensToDisassociate = [];
    
    // First, analyze all tokens
    for (const tokenId of tokenIds) {
      try {
        console.log(`\n🔄 Analisi token: ${tokenId}`);
        
        // Get token info
        const tokenInfo = await new TokenInfoQuery()
          .setTokenId(tokenId)
          .execute(client);
        
        console.log(`   📝 Nome: ${tokenInfo.name || 'N/A'}`);
        console.log(`   🔖 Simbolo: ${tokenInfo.symbol || 'N/A'}`);
        console.log(`   🗑️  Eliminato: ${tokenInfo.isDeleted ? 'Sì' : 'No'}`);
        
        const balance = tokens.get(tokenId);
        console.log(`   💰 Balance: ${balance || 0}`);
        
        // Strategy: burn first if has balance, then dissociate
        if (balance && !balance.isZero()) {
          if (tokenInfo.isDeleted) {
            console.log(`   ⚠️  Token eliminato con balance > 0 - SALTO il burn (non possibile)`);
            console.log(`   🔄 Andrò direttamente alla dissociazione`);
            // Non aggiungo ai tokensToBurn perché è già eliminato
          } else {
            console.log(`   🔥 Token attivo con balance > 0 - candidato per burn`);
            tokensToBurn.push({ tokenId, balance: balance.toNumber() });
          }
        }
        
        // All tokens will be candidates for dissociation after burning
        console.log(`   🔄 Token candidato per dissociazione`);
        tokensToDisassociate.push(tokenId);
        
      } catch (error) {
        console.log(`   ❌ Errore durante l'analisi: ${error.message}`);
        failedCount++;
        failedTokens.push({ tokenId, reason: error.message });
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Step 1: Burn all tokens with balance > 0
    if (tokensToBurn.length > 0) {
      console.log(`\n🔥 FASE 1: Burning ${tokensToBurn.length} tokens con balance > 0...`);
      
      for (const { tokenId, balance } of tokensToBurn) {
        try {
          console.log(`\n🔥 Burning token ${tokenId} (balance: ${balance})...`);
          
          const burnTransaction = new TokenBurnTransaction()
            .setTokenId(tokenId)
            .setAmount(balance)
            .setMaxTransactionFee(new Hbar(20));
          
          // Freeze, sign and execute
          const frozenTx = await burnTransaction.freezeWith(client);
          const signedTx = await frozenTx.sign(operatorPrivateKey);
          const txResponse = await signedTx.execute(client);
          const receipt = await txResponse.getReceipt(client);
          
          if (receipt.status.toString() === 'SUCCESS') {
            console.log(`   ✅ Token burned con successo!`);
            console.log(`   📋 Transaction ID: ${txResponse.transactionId.toString()}`);
            burnedCount++;
          } else {
            console.log(`   ❌ Burn fallito: ${receipt.status.toString()}`);
            failedCount++;
            failedTokens.push({ tokenId, reason: `Burn failed: ${receipt.status.toString()}` });
          }
          
        } catch (error) {
          console.log(`   ❌ Errore durante il burn: ${error.message}`);
          failedCount++;
          failedTokens.push({ tokenId, reason: `Burn error: ${error.message}` });
        }
        
        // Delay between burns
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Step 2: Dissociate all tokens
    console.log(`\n🔄 FASE 2: Dissociazione di tutti i ${tokensToDisassociate.length} tokens...`);
    
    if (tokensToDisassociate.length === 0) {
      console.log("✅ Nessun token da dissociare!");
    } else {
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
    }
    
    // Final Summary
    console.log("\n📊 RIEPILOGO OPERAZIONI COMPLETE:");
    console.log("==================================");
    console.log(`🔥 Tokens burned: ${burnedCount}`);
    console.log(`✅ Tokens dissociati: ${dissociatedCount}`);
    console.log(`❌ Operazioni fallite: ${failedCount}`);
    
    if (failedTokens.length > 0) {
      console.log("\n❌ ERRORI RISCONTRATI:");
      failedTokens.forEach(({ tokenId, reason }) => {
        console.log(`   • ${tokenId}: ${reason}`);
      });
    }
    
    console.log("\n🎉 Operazione FORZATA completata!");
    console.log("💡 Tutti i tokens dovrebbero ora essere rimossi dalla dashboard");
    console.log("⚠️  Se alcuni tokens non si dissociano, potrebbero avere vincoli speciali");
    
  } catch (error) {
    console.error("💥 Errore generale:", error);
  }
}

// Execute if run directly
if (require.main === module) {
  forceDissociateAll();
}

module.exports = { forceDissociateAll }; 