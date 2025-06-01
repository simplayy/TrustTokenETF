/**
 * API client for the Trust Token ETF backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';

/**
 * Basic fetch wrapper with error handling
 */
async function fetchWithErrorHandling(url: string, options: RequestInit = {}) {
  try {
    console.log(`Making API request to: ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // Add more specific error handling
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('Network error - server may be down or CORS issues:', error);
    } else {
      console.error('API request failed:', error);
    }
    throw error;
  }
}

/**
 * API endpoints
 */
export const apiClient = {
  // Server status
  getStatus: () => fetchWithErrorHandling(`${API_BASE_URL}/status`),
  
  // Future endpoints will be added here
};

export default apiClient; 