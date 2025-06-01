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

async function ultimateClean() {
  try {
    console.log("💥 SCRIPT DEFINITIVO: Eliminazione FISICA dei token");
    console.log("==================================================");
    console.log("🎯 Obiettivo: Eliminare fisicamente i token dal treasury");
    console.log("📋 Risultato: Dashboard completamente pulita");
    
    // Use treasury account as operator
    const treasuryId = process.env.HEDERA_TREASURY_ID;
    const treasuryKey = process.env.HEDERA_TREASURY_KEY;
    const operatorId = process.env.HEDERA_ACCOUNT_ID;
    const network = process.env.HEDERA_NETWORK || 'testnet';
    
    console.log(`🌐 Network: ${network}`);
    console.log(`🏦 Treasury ID (operator): ${treasuryId}`);
    console.log(`👤 Account da pulire: ${operatorId}`);
    
    if (!treasuryId || !treasuryKey) {
      throw new Error("❌ HEDERA_TREASURY_ID e HEDERA_TREASURY_KEY devono essere presenti");
    }
    
    // Create client with treasury as operator
    const client = network === 'mainnet' 
      ? Client.forMainnet() 
      : Client.forTestnet();
    
    const treasuryPrivateKey = PrivateKey.fromStringECDSA(treasuryKey);
    client.setOperator(AccountId.fromString(treasuryId), treasuryPrivateKey);
    
    console.log("\n🔍 Ricerca tokens creati dal treasury...");
    
    // Check tokens in operator account first
    const operatorBalance = await new AccountBalanceQuery()
      .setAccountId(operatorId)
      .execute(client);
    
    const operatorTokens = Array.from(operatorBalance.tokens.keys());
    console.log(`📋 Token nell'account operator: ${operatorTokens.length}`);
    
    // Check tokens in treasury account
    const treasuryBalance = await new AccountBalanceQuery()
      .setAccountId(treasuryId)
      .execute(client);
    
    const treasuryTokens = Array.from(treasuryBalance.tokens.keys());
    console.log(`📋 Token nell'account treasury: ${treasuryTokens.length}`);
    
    // Combine all tokens (remove duplicates)
    const allTokens = [...new Set([...operatorTokens, ...treasuryTokens])];
    
    if (allTokens.length === 0) {
      console.log("✅ Nessun token trovato da eliminare!");
      return;
    }
    
    console.log(`\n📋 Trovati ${allTokens.length} token TOTALI da eliminare:`);
    
    let deletedCount = 0;
    let failedCount = 0;
    const failedTokens = [];
    const tokensToDelete = [];
    
    // Analyze each token
    for (const tokenId of allTokens) {
      try {
        console.log(`\n🔍 Analisi token: ${tokenId}`);
        
        // Get token info
        const tokenInfo = await new TokenInfoQuery()
          .setTokenId(tokenId)
          .execute(client);
        
        console.log(`   📝 Nome: ${tokenInfo.name || 'N/A'}`);
        console.log(`   🔖 Simbolo: ${tokenInfo.symbol || 'N/A'}`);
        console.log(`   🗑️  Già eliminato: ${tokenInfo.isDeleted ? 'Sì' : 'No'}`);
        console.log(`   🔑 Admin Key: ${tokenInfo.adminKey ? 'Presente' : 'Assente'}`);
        console.log(`   🏦 Treasury: ${tokenInfo.treasuryAccountId ? tokenInfo.treasuryAccountId.toString() : 'N/A'}`);
        
        if (tokenInfo.isDeleted) {
          console.log(`   ⚠️  Token già eliminato, salto`);
          continue;
        }
        
        if (!tokenInfo.adminKey) {
          console.log(`   ❌ Impossibile eliminare: nessuna admin key`);
          failedCount++;
          failedTokens.push({ tokenId, reason: 'No admin key' });
          continue;
        }
        
        // Check if treasury is the treasury account
        const tokenTreasury = tokenInfo.treasuryAccountId ? tokenInfo.treasuryAccountId.toString() : '';
        if (tokenTreasury !== treasuryId && tokenTreasury !== operatorId) {
          console.log(`   ⚠️  Token treasury diverso (${tokenTreasury}), potrebbe fallire`);
        }
        
        console.log(`   ✅ Token candidato per eliminazione fisica`);
        tokensToDelete.push(tokenId);
        
      } catch (error) {
        console.log(`   ❌ Errore analisi: ${error.message}`);
        failedCount++;
        failedTokens.push({ tokenId, reason: error.message });
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (tokensToDelete.length === 0) {
      console.log("\n⚠️  Nessun token può essere eliminato!");
      if (failedTokens.length > 0) {
        console.log("\n❌ MOTIVI:");
        failedTokens.forEach(({ tokenId, reason }) => {
          console.log(`   • ${tokenId}: ${reason}`);
        });
      }
      return;
    }
    
    console.log(`\n🔥 Inizio eliminazione fisica di ${tokensToDelete.length} tokens...`);
    console.log("⚠️  Questo li rimuoverà COMPLETAMENTE dalla blockchain!");
    
    // Delete tokens one by one
    for (const tokenId of tokensToDelete) {
      try {
        console.log(`\n🗑️  Eliminazione token: ${tokenId}...`);
        
        const deleteTransaction = new TokenDeleteTransaction()
          .setTokenId(tokenId)
          .setMaxTransactionFee(new Hbar(50));
        
        // Freeze, sign and execute
        const frozenTx = await deleteTransaction.freezeWith(client);
        const signedTx = await frozenTx.sign(treasuryPrivateKey);
        const txResponse = await signedTx.execute(client);
        const receipt = await txResponse.getReceipt(client);
        
        if (receipt.status.toString() === 'SUCCESS') {
          console.log(`   ✅ Token eliminato fisicamente!`);
          console.log(`   📋 TX ID: ${txResponse.transactionId.toString()}`);
          deletedCount++;
        } else {
          console.log(`   ❌ Eliminazione fallita: ${receipt.status.toString()}`);
          failedCount++;
          failedTokens.push({ tokenId, reason: receipt.status.toString() });
        }
        
      } catch (error) {
        console.log(`   ❌ Errore eliminazione: ${error.message}`);
        failedCount++;
        failedTokens.push({ tokenId, reason: error.message });
      }
      
      // Delay between deletions
      console.log("   ⏳ Pausa 2 secondi...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Final verification
    console.log("\n🔍 Verifica finale...");
    
    const finalOperatorBalance = await new AccountBalanceQuery()
      .setAccountId(operatorId)
      .execute(client);
    const finalOperatorTokens = Array.from(finalOperatorBalance.tokens.keys());
    
    const finalTreasuryBalance = await new AccountBalanceQuery()
      .setAccountId(treasuryId)
      .execute(client);
    const finalTreasuryTokens = Array.from(finalTreasuryBalance.tokens.keys());
    
    const remainingTokens = [...new Set([...finalOperatorTokens, ...finalTreasuryTokens])];
    
    // Final Summary
    console.log("\n📊 RISULTATO FINALE:");
    console.log("=====================");
    console.log(`💥 Tokens eliminati fisicamente: ${deletedCount}`);
    console.log(`❌ Tokens non eliminati: ${failedCount}`);
    console.log(`🔍 Tokens ancora presenti: ${remainingTokens.length}`);
    
    if (remainingTokens.length === 0) {
      console.log("\n🎉🎉🎉 SUCCESSO TOTALE! 🎉🎉🎉");
      console.log("✨ Dashboard dovrebbe essere COMPLETAMENTE PULITA!");
      console.log("🌟 Nessun token dovrebbe più apparire!");
    } else {
      console.log(`\n⚠️  Rimangono ancora ${remainingTokens.length} tokens:`);
      remainingTokens.forEach(tokenId => console.log(`   • ${tokenId}`));
    }
    
    if (failedTokens.length > 0) {
      console.log("\n❌ TOKENS NON ELIMINATI:");
      failedTokens.forEach(({ tokenId, reason }) => {
        console.log(`   • ${tokenId}: ${reason}`);
      });
    }
    
    console.log("\n💡 Nota: La dashboard recupera i token dal Mirror Node");
    console.log("🔄 Potrebbe impiegare qualche minuto per aggiornarsi");
    
  } catch (error) {
    console.error("💥 Errore generale:", error);
  }
}

// Execute if run directly
if (require.main === module) {
  ultimateClean();
}

module.exports = { ultimateClean }; 