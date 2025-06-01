import { 
  Client, 
  AccountId, 
  AccountBalanceQuery,
  TokenId
} from "@hashgraph/sdk";
import config from "../config";
import { hederaService } from "./hedera.service";
import tokenService from "./token.service";
import axios from "axios";

// Interfaccia per i token posseduti nel portfolio
export interface PortfolioHolding {
  tokenId: string;
  balance: number;
  acquisitionDate: string;
  acquisitionPrice?: number;
  tokenInfo?: any;  // Informazioni complete sul token
}

/**
 * Servizio per la gestione del portfolio utente
 */
class PortfolioService {
  private client: Client | null = null;
  private accountId: string;
  private treasuryId: string;

  constructor() {
    this.accountId = config.hedera.accountId;
    this.treasuryId = config.hedera.treasuryId;
    this.client = hederaService.getClient();
  }

  /**
   * Ottiene il portfolio dell'utente utilizzando l'API Mirror Node di Hedera
   * @param accountId Account ID dell'utente (opzionale, usa quello di default se non specificato)
   * @returns Array di token posseduti dall'utente
   */
  async getUserPortfolio(accountId?: string): Promise<PortfolioHolding[]> {
    try {
      // Usa l'account ID specificato o quello personale dell'utente dalle env
      const userAccountToCheck = accountId || this.accountId;
      console.log(`Getting portfolio for account ${userAccountToCheck}`);

      // Array per memorizzare tutti i token trovati
      const allHoldings: PortfolioHolding[] = [];
      
      // Utilizziamo Mirror Node API per l'account personale
      const network = config.hedera.network.toLowerCase();
      const mirrorNodeBaseUrl = network === 'mainnet' 
        ? 'https://mainnet-public.mirrornode.hedera.com'
        : 'https://testnet.mirrornode.hedera.com';
      
      // Configurazione axios
      const axiosConfig = {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      };
      
      console.log(`Checking token balances for account ${userAccountToCheck}...`);
      
      // URL per ottenere i bilanciamenti dell'account (inclusi i token)
      const url = `${mirrorNodeBaseUrl}/api/v1/balances?account.id=${userAccountToCheck}`;
      console.log(`Requesting balances from Mirror Node API: ${url}`);
      
      try {
        // Ottieni i bilanciamenti dall'API Mirror Node
        const response = await axios.get(url, axiosConfig);
        
        // Verifica se ci sono bilanciamenti nell'account
        if (!response.data.balances || response.data.balances.length === 0) {
          console.log('No balances found for this account');
          return [];
        }
        
        // Prendi il primo account (dovrebbe essere l'unico nel nostro caso)
        const account = response.data.balances[0];
        
        // Verifica se ci sono token nel bilanciamento
        if (!account.tokens || account.tokens.length === 0) {
          console.log('No tokens found for this account');
          return [];
        }
        
        console.log(`Retrieved ${account.tokens.length} tokens from Mirror Node API for account ${userAccountToCheck}`);
        
        // Log di tutti i token recuperati per debug
        for (let i = 0; i < account.tokens.length; i++) {
          console.log(`Token ${i+1}: ID=${account.tokens[i].token_id}, Balance=${account.tokens[i].balance}`);
        }
        
        // Per ogni token ricevuto
        for (const token of account.tokens) {
          // Filtra solo i token con bilanciamento positivo
          const balance = parseInt(token.balance || '0');
          console.log(`Processing token ${token.token_id} with balance ${balance}`);
          
          if (balance > 0) {
            try {
              // Ottieni informazioni complete sul token
              console.log(`Getting token info for ${token.token_id}...`);
              const tokenInfo = await tokenService.getTokenInfo(token.token_id);
              
              // Crea l'oggetto holding
              const holding: PortfolioHolding = {
                tokenId: token.token_id,
                balance: balance,
                acquisitionDate: new Date().toISOString(), // Data di oggi come approssimazione
                acquisitionPrice: 1.0, // Prezzo fisso per ora
                tokenInfo: tokenInfo
              };
              
              allHoldings.push(holding);
              console.log(`Added token to portfolio: ${token.token_id} with balance ${balance}`);
            } catch (error) {
              console.error(`Error getting info for token ${token.token_id}:`, error);
              // Aggiungi comunque il token, ma senza informazioni dettagliate
              allHoldings.push({
                tokenId: token.token_id,
                balance: balance,
                acquisitionDate: new Date().toISOString(),
                acquisitionPrice: 1.0
              });
            }
          } else {
            console.log(`Skipping token ${token.token_id} with zero or negative balance: ${balance}`);
          }
        }
      } catch (error) {
        console.error(`Error getting token balances for account ${userAccountToCheck}:`, error);
      }
      
      console.log(`Total tokens found: ${allHoldings.length}`);
      return allHoldings;
    } catch (error) {
      console.error("Error getting user portfolio:", error);
      throw error;
    }
  }

  /**
   * Aggiunge un token al portfolio (simulazione)
   * @param tokenId Token ID da aggiungere
   * @param amount Quantità da aggiungere
   * @returns Oggetto holding con le informazioni del token aggiunto
   */
  async addToPortfolio(tokenId: string, amount: number): Promise<PortfolioHolding> {
    try {
      // Ottieni informazioni sul token
      const tokenInfo = await tokenService.getTokenInfo(tokenId);
      
      // Simula l'aggiunta del token al portfolio
      const holding: PortfolioHolding = {
        tokenId,
        balance: amount,
        acquisitionDate: new Date().toISOString(),
        acquisitionPrice: 1.0, // Prezzo fisso per ora
        tokenInfo
      };
      
      return holding;
    } catch (error) {
      console.error("Error adding to portfolio:", error);
      throw error;
    }
  }
}

// Crea un'istanza singleton
export const portfolioService = new PortfolioService(); 