/**
 * API Configuration and Helper Functions
 * Central place to manage all API calls to the backend
 */

// Get the API base URL from environment variables
// For development, we'll use localhost:5000 directly to avoid env var issues
export const API_BASE_URL = typeof window !== 'undefined'
  ? (
      process.env.NEXT_PUBLIC_API_URL ||
      `${window.location.protocol}//${window.location.hostname}:${process.env.NEXT_PUBLIC_API_PORT || '5000'}`
    )
  : `http://localhost:${process.env.NEXT_PUBLIC_API_PORT || '5000'}`;

/**
 * Helper function to make API requests
 * @param {string} endpoint - API endpoint (e.g., '/api/collections')
 * @param {object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise} - Response data
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Debug logging (disabled in production unless explicitly enabled)
  const DEBUG = (typeof window === 'undefined')
    ? process.env.NODE_ENV !== 'production'
    : (process.env.NODE_ENV !== 'production' || (function(){ try { return localStorage.getItem('debug_api') === '1'; } catch { return false; } })());
  const debugLog = (...args) => { if (!DEBUG) return; try { globalThis && globalThis['console'] && globalThis['console']['log'](...args); } catch {} };
  const debugError = (...args) => { if (!DEBUG) return; try { globalThis && globalThis['console'] && globalThis['console']['error'](...args); } catch {} };
  debugLog('API Request:', { url, method: options.method || 'GET', endpoint });
  
  // Get JWT token from cookie
  let token = '';
  if (typeof document !== 'undefined') {
    try {
      const match = document.cookie.match(/(?:^|; )auth=([^;]+)/);
      token = match ? decodeURIComponent(match[1]) : '';
    } catch (e) {
      debugError('Failed to read auth cookie:', e);
    }
  }
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  // Add Authorization header if token exists
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  // Add credentials if needed for cookie-based auth
  if (options.credentials !== false) {
    config.credentials = 'include';
  }

  try {
    const response = await fetch(url, config);
    
    debugLog('API Response:', { status: response.status, ok: response.ok, url });
    
    // Read response body once (can only be read once)
    let responseText = '';
    let data = {};
    
    try {
      responseText = await response.text();
    } catch (e) {
      debugError('Failed to read response text:', e);
      responseText = '';
    }
    
    // Handle non-JSON responses (like redirects or empty responses)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (response.ok) {
        return { success: true };
      }
      debugError('Non-JSON response:', responseText);
      throw new Error(`HTTP Error: ${response.status} - ${responseText || response.statusText || 'No response body'}`);
    }

    // Parse JSON response
    try {
      if (!responseText || responseText.trim() === '') {
        data = { message: `Empty response from server (Status: ${response.status})` };
      } else {
    try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          data = { message: responseText || `Failed to parse response (Status: ${response.status})` };
        }
      }
    } catch (e) {
      data = { message: `Failed to process response: ${e.message} (Status: ${response.status})` };
    }

    if (!response.ok) {
      // Enhanced debugging - show raw response text
      debugError('API Error Response - Raw text:', responseText);
      debugError('API Error Response - Parsed data:', data);
      debugError('API Error Response - Status:', response.status, 'URL:', url);
      
      // Extract error message from various possible fields
      let messageFromBody = '';
      
      if (data && typeof data === 'object') {
        // Check common error message fields
        if (data.message) messageFromBody = data.message;
        else if (data.error) messageFromBody = data.error;
        else if (data.details) messageFromBody = data.details;
        else if (typeof data === 'string') messageFromBody = data;
        // If data is empty object, use raw text
        else if (Object.keys(data).length === 0 && responseText) {
          messageFromBody = responseText;
        }
      } else if (responseText) {
        messageFromBody = responseText;
      }
      
      const fallback = `HTTP Error: ${response.status}${response.statusText ? ' - ' + response.statusText : ''} (${url})`;
      
      // Create a more informative error message
      let errorMessage;
      if (messageFromBody && messageFromBody.trim() !== '' && messageFromBody !== '{}' && messageFromBody !== '[]') {
        // Clean up the message
        const cleanMessage = typeof messageFromBody === 'string' 
          ? messageFromBody.trim()
          : JSON.stringify(messageFromBody);
        errorMessage = `${cleanMessage} (Status: ${response.status})`;
      } else {
        // If we have raw text but no parsed message, use it
        if (responseText && responseText.trim() !== '') {
          errorMessage = `${responseText} (Status: ${response.status})`;
        } else {
          errorMessage = fallback;
        }
      }
      
      throw new Error(errorMessage);
    }

    debugLog('API Success:', data);
    return data;
  } catch (error) {
    debugError(`API Request Error (${endpoint}):`, error);
    debugError('Error details:', { name: error.name, message: error.message, url });
    // Surface a clearer error for NetworkError/TypeError
    const msg = (error && error.message) ? `${error.message} (${url})` : `NetworkError when attempting to fetch resource (${url})`;
    throw new Error(msg);
  }
}

/**
 * API Methods for common operations
 */
export const api = {
  // Auth
  auth: {
    signin: (payload) =>
      apiRequest('/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    forgotPassword: (payload) =>
      apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    resetPassword: (token, payload) =>
      apiRequest(`/api/auth/reset-password/${encodeURIComponent(token)}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
  // Health Check
  health: () => 
    apiRequest('/health'),

  // Brands Management
  brands: {
    // Get all brands
    getAll: () => 
      apiRequest('/api/brands/all'),

    // Get brands assigned to a specific user (by email)
    getByUser: (email) =>
      apiRequest(`/api/brands/user/${encodeURIComponent(email)}`),

    // Get assigned brands (details only)
    getAssigned: (email) =>
      apiRequest(`/api/brands/assigned/${encodeURIComponent(email)}`),
    
    // Create a new brand
    create: (brandData) => 
      apiRequest('/api/brands/create', {
        method: 'POST',
        body: JSON.stringify(brandData),
      }),
    
    // Configure brand (add keywords and platforms)
    configure: (configData) => 
      apiRequest('/api/brands/configure', {
        method: 'POST',
        body: JSON.stringify(configData),
      }),

    // Delete a brand
    delete: (brandName) =>
      apiRequest('/api/brands/delete', {
        method: 'POST',
        body: JSON.stringify({ brandName })
      }),

    // Assign users to a brand (admin only)
    assignUsers: (brandName, users) =>
      apiRequest('/api/brands/assign-users', {
        method: 'POST',
        body: JSON.stringify({ brandName, users }),
      }),

    // Delete brand
    delete: (brandName) =>
      apiRequest('/api/brands/delete', {
        method: 'POST',
        body: JSON.stringify({ brandName }),
      }),
  },

  // Search Operations
  search: {
    // Search recent posts
    recent: (searchData) => 
      apiRequest('/api/search/recent', {
        method: 'POST',
        body: JSON.stringify(searchData),
      }),
    
    // Search historical data
    historical: (searchData) => 
      apiRequest('/api/search/historical', {
        method: 'POST',
        body: JSON.stringify(searchData),
      }),
    
    // Run search for a brand
    runForBrand: (searchData) => 
      apiRequest('/api/search/run', {
        method: 'POST',
        body: JSON.stringify(searchData),
      }),
    
    // Run brand search
    runBrandSearch: (searchData) => 
      apiRequest('/api/search/brandsearch', {
        method: 'POST',
        body: JSON.stringify(searchData),
      }),
  },

  // Dashboard Data
  dashboard: {
    // Get posts by brand with optional filters
    getPosts: (params) => {
      const p = new URLSearchParams({ ...(params || {}), _: String(Date.now()) });
      const queryString = p.toString();
      // Avoid custom headers so the browser does not preflight the request
      return apiRequest(`/api/search/data?${queryString}`);
    },
    
    // Get all keywords for a brand
    getKeywords: (brandName) => {
      const ts = Date.now();
      return apiRequest(`/api/search/keywords?brandName=${encodeURIComponent(brandName)}&_=${ts}`);
    },
  },

  // Data endpoints
  data: {
    // Get user-accessible social posts (requires email parameter)
    userPosts: (params) => {
      const p = new URLSearchParams({ ...(params || {}), _: String(Date.now()) });
      return apiRequest(`/api/data/user-posts?${p.toString()}`);
    },
  },

  // Channel configuration (proposed endpoints)
  channels: {
    list: (brandName) =>
      apiRequest(`/api/channels/list?brandName=${encodeURIComponent(brandName)}`),
    connect: (payload) =>
      apiRequest('/api/channels/connect', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    reauthorize: (payload) =>
      apiRequest('/api/channels/reauthorize', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    remove: (payload) =>
      apiRequest('/api/channels/delete', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  // Users (admin)
  users: {
    create: (payload) => {
      let token = '';
      try {
        const m = (typeof document !== 'undefined' ? document.cookie : '').match(/(?:^|; )auth=([^;]+)/);
        token = m ? decodeURIComponent(m[1]) : '';
      } catch {}
      return apiRequest('/api/users/create', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify(payload),
      });
    },
  },
};

export default api;

