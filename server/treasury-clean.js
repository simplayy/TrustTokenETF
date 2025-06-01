require('dotenv').config();

const { 
  Client, 
  PrivateKey, 
  AccountId,
  TokenDissociateTransaction,
  TokenTransferTransaction,
  TokenAssociateTransaction,
  Hbar,
  AccountBalanceQuery,
  TokenInfoQuery
} = require('@hashgraph/sdk');

async function treasuryCleanup() {
  try {
    console.log("🏦 Script di pulizia con account Treasury");
    console.log("========================================");
    
    // Use treasury account
    const treasuryId = process.env.HEDERA_TREASURY_ID;
    const treasuryKey = process.env.HEDERA_TREASURY_KEY;
    const operatorId = process.env.HEDERA_ACCOUNT_ID; // Account da pulire
    const network = process.env.HEDERA_NETWORK || 'testnet';
    
    console.log(`🌐 Network: ${network}`);
    console.log(`🏦 Treasury ID: ${treasuryId}`);
    console.log(`👤 Account da pulire: ${operatorId}`);
    
    if (!treasuryId || !treasuryKey || !operatorId) {
      throw new Error("❌ Tutti gli account devono essere presenti nel .env");
    }
    
    // Create client con treasury account
    const client = network === 'mainnet' 
      ? Client.forMainnet() 
      : Client.forTestnet();
    
    const treasuryPrivateKey = PrivateKey.fromStringECDSA(treasuryKey);
    client.setOperator(AccountId.fromString(treasuryId), treasuryPrivateKey);
    
    console.log("\n🔍 Controllo tokens nell'account da pulire...");
    
    // Get account balance
    const accountBalance = await new AccountBalanceQuery()
      .setAccountId(operatorId)
      .execute(client);
    
    console.log(`💰 Balance HBAR account: ${accountBalance.hbars.toString()}`);
    
    const tokens = accountBalance.tokens;
    const tokenIds = Array.from(tokens.keys());
    
    if (tokenIds.length === 0) {
      console.log("✅ Nessun token nell'account!");
      return;
    }
    
    console.log(`📋 Trovati ${tokenIds.length} tokens da trasferire:`);
    
    let transferredCount = 0;
    let dissociatedCount = 0;
    let failedCount = 0;
    const failedTokens = [];
    const tokensToProcess = [];
    
    // Check treasury association first
    console.log("\n🔄 Controllo associazioni Treasury...");
    const treasuryBalance = await new AccountBalanceQuery()
      .setAccountId(treasuryId)
      .execute(client);
    
    const treasuryTokens = new Set(Array.from(treasuryBalance.tokens.keys()).map(t => t.toString()));
    
    // Process each token
    for (const tokenId of tokenIds) {
      try {
        console.log(`\n🔄 Elaborazione token: ${tokenId}`);
        
        const balance = tokens.get(tokenId);
        console.log(`   💰 Balance: ${balance || 0}`);
        
        if (!balance || balance.isZero()) {
          console.log(`   ✅ Balance 0 - solo dissociazione`);
          tokensToProcess.push({ tokenId, needsTransfer: false });
          continue;
        }
        
        // Check if treasury is associated
        if (!treasuryTokens.has(tokenId.toString())) {
          console.log(`   🔗 Treasury non associato - associo prima...`);
          
          try {
            const associateTransaction = new TokenAssociateTransaction()
              .setAccountId(treasuryId)
              .setTokenIds([tokenId])
              .setMaxTransactionFee(new Hbar(20));
            
            const frozenTx = await associateTransaction.freezeWith(client);
            const signedTx = await frozenTx.sign(treasuryPrivateKey);
            const txResponse = await signedTx.execute(client);
            const receipt = await txResponse.getReceipt(client);
            
            if (receipt.status.toString() === 'SUCCESS') {
              console.log(`   ✅ Treasury associato con successo!`);
            } else {
              console.log(`   ❌ Associazione fallita: ${receipt.status.toString()}`);
              failedCount++;
              continue;
            }
          } catch (error) {
            console.log(`   ❌ Errore associazione: ${error.message}`);
            failedCount++;
            continue;
          }
        }
        
        tokensToProcess.push({ 
          tokenId, 
          needsTransfer: true, 
          amount: balance.toNumber() 
        });
        
      } catch (error) {
        console.log(`   ❌ Errore controllo: ${error.message}`);
        failedCount++;
        failedTokens.push({ tokenId, reason: error.message });
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Step 1: Transfer tokens to treasury
    console.log(`\n💸 FASE 1: Trasferimento tokens al treasury...`);
    
    for (const { tokenId, needsTransfer, amount } of tokensToProcess) {
      if (!needsTransfer) continue;
      
      try {
        console.log(`\n💸 Trasferimento ${amount} di token ${tokenId}...`);
        
        const transferTransaction = new TokenTransferTransaction()
          .addTokenTransfer(tokenId, operatorId, -amount)
          .addTokenTransfer(tokenId, treasuryId, amount)
          .setMaxTransactionFee(new Hbar(20));
        
        const frozenTx = await transferTransaction.freezeWith(client);
        const signedTx = await frozenTx.sign(treasuryPrivateKey);
        const txResponse = await signedTx.execute(client);
        const receipt = await txResponse.getReceipt(client);
        
        if (receipt.status.toString() === 'SUCCESS') {
          console.log(`   ✅ Trasferito con successo!`);
          console.log(`   📋 Transaction ID: ${txResponse.transactionId.toString()}`);
          transferredCount++;
        } else {
          console.log(`   ❌ Trasferimento fallito: ${receipt.status.toString()}`);
          failedCount++;
          failedTokens.push({ tokenId, reason: `Transfer failed: ${receipt.status.toString()}` });
        }
        
      } catch (error) {
        console.log(`   ❌ Errore trasferimento: ${error.message}`);
        failedCount++;
        failedTokens.push({ tokenId, reason: `Transfer error: ${error.message}` });
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Step 2: Dissociate all tokens from operator account
    console.log(`\n🔄 FASE 2: Dissociazione dall'account operatore...`);
    
    const allTokenIds = tokensToProcess.map(t => t.tokenId);
    
    if (allTokenIds.length === 0) {
      console.log("✅ Nessun token da dissociare!");
    } else {
      try {
        // Dissociate in batches
        const batchSize = 10;
        for (let i = 0; i < allTokenIds.length; i += batchSize) {
          const batch = allTokenIds.slice(i, i + batchSize);
          
          console.log(`\n📦 Batch ${Math.floor(i/batchSize) + 1}: dissociando ${batch.length} tokens...`);
          batch.forEach(tokenId => console.log(`   • ${tokenId}`));
          
          const dissociateTransaction = new TokenDissociateTransaction()
            .setAccountId(operatorId)
            .setTokenIds(batch)
            .setMaxTransactionFee(new Hbar(20));
          
          const frozenTx = await dissociateTransaction.freezeWith(client);
          const signedTx = await frozenTx.sign(treasuryPrivateKey);
          const txResponse = await signedTx.execute(client);
          const receipt = await txResponse.getReceipt(client);
          
          if (receipt.status.toString() === 'SUCCESS') {
            console.log(`   ✅ Batch dissociato con successo!`);
            console.log(`   📋 Transaction ID: ${txResponse.transactionId.toString()}`);
            dissociatedCount += batch.length;
          } else {
            console.log(`   ❌ Dissociazione fallita: ${receipt.status.toString()}`);
            failedCount += batch.length;
          }
          
          if (i + batchSize < allTokenIds.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
      } catch (error) {
        console.error(`❌ Errore dissociazione: ${error.message}`);
        failedCount += allTokenIds.length - dissociatedCount;
      }
    }
    
    // Final Summary
    console.log("\n📊 RIEPILOGO OPERAZIONI TREASURY:");
    console.log("=================================");
    console.log(`💸 Tokens trasferiti: ${transferredCount}`);
    console.log(`✅ Tokens dissociati: ${dissociatedCount}`);
    console.log(`❌ Operazioni fallite: ${failedCount}`);
    
    if (failedTokens.length > 0) {
      console.log("\n❌ ERRORI RISCONTRATI:");
      failedTokens.forEach(({ tokenId, reason }) => {
        console.log(`   • ${tokenId}: ${reason}`);
      });
    }
    
    console.log("\n🎉 Pulizia Treasury completata!");
    console.log("💡 L'account dovrebbe ora essere pulito nella dashboard");
    
  } catch (error) {
    console.error("💥 Errore generale:", error);
  }
}

// Execute if run directly
if (require.main === module) {
  treasuryCleanup();
}

module.exports = { treasuryCleanup }; 