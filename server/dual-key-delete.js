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

async function dualKeyDelete() {
  try {
    console.log("🔥🔥 SCRIPT DUAL-KEY: Eliminazione con ENTRAMBE le firme");
    console.log("====================================================");
    console.log("🎯 Obiettivo: Eliminare fisicamente i token usando TUTTE le chiavi");
    console.log("📋 Risultato: Dashboard completamente pulita");
    
    // Get both accounts
    const operatorId = process.env.HEDERA_ACCOUNT_ID;
    const operatorKey = process.env.HEDERA_PRIVATE_KEY;
    const treasuryId = process.env.HEDERA_TREASURY_ID;
    const treasuryKey = process.env.HEDERA_TREASURY_KEY;
    const network = process.env.HEDERA_NETWORK || 'testnet';
    
    console.log(`🌐 Network: ${network}`);
    console.log(`👤 Account principale: ${operatorId}`);
    console.log(`🏦 Account treasury: ${treasuryId}`);
    
    if (!operatorId || !operatorKey || !treasuryId || !treasuryKey) {
      throw new Error("❌ Tutti gli account devono essere presenti nel .env");
    }
    
    // Create client with operator as default
    const client = network === 'mainnet' 
      ? Client.forMainnet() 
      : Client.forTestnet();
    
    const operatorPrivateKey = PrivateKey.fromStringECDSA(operatorKey);
    const treasuryPrivateKey = PrivateKey.fromStringECDSA(treasuryKey);
    
    client.setOperator(AccountId.fromString(operatorId), operatorPrivateKey);
    
    console.log("\n🔍 Ricerca TUTTI i tokens...");
    
    // Check tokens in both accounts
    const operatorBalance = await new AccountBalanceQuery()
      .setAccountId(operatorId)
      .execute(client);
    
    const operatorTokens = Array.from(operatorBalance.tokens.keys());
    console.log(`📋 Token nell'account operator: ${operatorTokens.length}`);
    
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
        
        console.log(`   ✅ Token candidato per eliminazione DUAL-KEY`);
        tokensToDelete.push(tokenId);
        
      } catch (error) {
        console.log(`   ❌ Errore analisi: ${error.message}`);
        failedCount++;
        failedTokens.push({ tokenId, reason: error.message });
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
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
    
    console.log(`\n🔥 Inizio eliminazione DUAL-KEY di ${tokensToDelete.length} tokens...`);
    console.log("⚠️  Ogni token verrà firmato con ENTRAMBE le chiavi!");
    
    // Delete tokens one by one with both signatures
    for (const tokenId of tokensToDelete) {
      try {
        console.log(`\n🗑️  Eliminazione DUAL-KEY token: ${tokenId}...`);
        
        const deleteTransaction = new TokenDeleteTransaction()
          .setTokenId(tokenId)
          .setMaxTransactionFee(new Hbar(100)); // Higher fee for dual-signed transactions
        
        // Freeze transaction
        const frozenTx = await deleteTransaction.freezeWith(client);
        
        // Sign with BOTH keys for maximum compatibility
        console.log(`   🔑 Firma con chiave operator...`);
        let signedTx = await frozenTx.sign(operatorPrivateKey);
        
        console.log(`   🔑 Firma con chiave treasury...`);
        signedTx = await signedTx.sign(treasuryPrivateKey);
        
        console.log(`   📤 Invio transazione dual-signed...`);
        const txResponse = await signedTx.execute(client);
        const receipt = await txResponse.getReceipt(client);
        
        if (receipt.status.toString() === 'SUCCESS') {
          console.log(`   ✅ Token eliminato fisicamente con DUAL-KEY!`);
          console.log(`   📋 TX ID: ${txResponse.transactionId.toString()}`);
          deletedCount++;
        } else {
          console.log(`   ❌ Eliminazione fallita: ${receipt.status.toString()}`);
          failedCount++;
          failedTokens.push({ tokenId, reason: receipt.status.toString() });
        }
        
      } catch (error) {
        console.log(`   ❌ Errore eliminazione dual-key: ${error.message}`);
        failedCount++;
        failedTokens.push({ tokenId, reason: error.message });
      }
      
      // Delay between deletions
      console.log("   ⏳ Pausa 3 secondi prima del prossimo...");
      await new Promise(resolve => setTimeout(resolve, 3000));
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
    console.log("\n📊 RISULTATO FINALE DUAL-KEY:");
    console.log("==============================");
    console.log(`🔥 Tokens eliminati fisicamente: ${deletedCount}`);
    console.log(`❌ Tokens non eliminati: ${failedCount}`);
    console.log(`🔍 Tokens ancora presenti: ${remainingTokens.length}`);
    
    if (remainingTokens.length === 0) {
      console.log("\n🎉🎉🎉 SUCCESSO TOTALE CON DUAL-KEY! 🎉🎉🎉");
      console.log("✨ Dashboard dovrebbe essere COMPLETAMENTE PULITA!");
      console.log("🌟 Nessun token dovrebbe più apparire!");
      console.log("🔥 Tutti i token sono stati eliminati fisicamente!");
    } else {
      console.log(`\n⚠️  Rimangono ancora ${remainingTokens.length} tokens:`);
      remainingTokens.slice(0, 10).forEach(tokenId => console.log(`   • ${tokenId}`));
      if (remainingTokens.length > 10) {
        console.log(`   ... e altri ${remainingTokens.length - 10} tokens`);
      }
    }
    
    if (failedTokens.length > 0) {
      console.log("\n❌ TOKENS NON ELIMINATI (DUAL-KEY):");
      failedTokens.slice(0, 10).forEach(({ tokenId, reason }) => {
        console.log(`   • ${tokenId}: ${reason}`);
      });
      if (failedTokens.length > 10) {
        console.log(`   ... e altri ${failedTokens.length - 10} errori`);
      }
    }
    
    console.log("\n💡 Nota: La dashboard recupera i token dal Mirror Node");
    console.log("🔄 Potrebbe impiegare 1-2 minuti per aggiornarsi");
    console.log("🌐 Controlla la dashboard per verificare che sia pulita!");
    
  } catch (error) {
    console.error("💥 Errore generale:", error);
  }
}

// Execute if run directly
if (require.main === module) {
  dualKeyDelete();
}

module.exports = { dualKeyDelete }; 