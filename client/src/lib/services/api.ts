import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Hedera API endpoints
export const hederaApi = {
  /**
   * Check connection status with Hedera network
   * @returns Promise with connection status
   */
  checkConnection: async () => {
    try {
      const response = await apiClient.get('/api/hedera/status');
      return response.data;
    } catch (error) {
      console.error('Failed to check Hedera connection:', error);
      throw error;
    }
  },
  
  /**
   * Get account information for the current Hedera account
   * @returns Promise with account details
   */
  getAccountInfo: async () => {
    try {
      const response = await apiClient.get('/api/hedera/account');
      return response.data;
    } catch (error) {
      console.error('Failed to get Hedera account info:', error);
      throw error;
    }
  }
};

export default apiClient; 