import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import base64 from 'base-64'; // For decoding JWT

// --- Configuration ---
// TODO: Configure your API URL properly.
// Use react-native-config, a simple config file, or hardcode for testing.
const API_URL = 'YOUR_API_ENDPOINT_HERE'; // e.g., 'https://yourapi.com/api' or 'http://localhost:3000/api'
if (API_URL === 'YOUR_API_ENDPOINT_HERE') {
  console.warn('API_URL is not configured in api.js. Please set your API endpoint.');
}

// --- Constants ---
const AUTH_TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RETRY_CODES = [408, 429, 500, 502, 503, 504]; // Network or server errors eligible for retry

// --- Axios Instance ---
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000, // Increased timeout for potentially slower mobile networks
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json', // Good practice for APIs
  },
  // withCredentials might be less relevant if using token auth, but keep if needed for cookies
  // withCredentials: true,
});

// --- Request Interceptor (Async for AsyncStorage) ---
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Flag to prevent multiple concurrent token refresh attempts
let isRefreshing = false;
let failedQueue = []; // Store requests that failed due to 401

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// --- Response Interceptor (Async for AsyncStorage & Refresh Logic) ---
apiClient.interceptors.response.use(
  (response) => response.data, // Return only the data part of the response
  async (error) => {
    const originalRequest = error.config;

    // --- Retry Logic ---
    const skipRetryEndpoints = ['/tasks/bulk-delete', '/tasks/bulk-update', '/auth/logout'];
    const shouldSkipRetry = skipRetryEndpoints.some(endpoint => originalRequest.url?.includes(endpoint));
    const status = error.response?.status;

    // Check if eligible for retry
    if (!shouldSkipRetry && (!originalRequest._retry || originalRequest._retry < MAX_RETRIES)) {
      if (!error.response || RETRY_CODES.includes(status)) {
        originalRequest._retry = (originalRequest._retry || 0) + 1;

        const jitter = Math.random() * 0.3;
        const backoffFactor = Math.min(Math.pow(2, originalRequest._retry - 1), 10); // Cap backoff
        let delay = RETRY_DELAY_MS * backoffFactor * (1 + jitter);

        console.log(`API retry ${originalRequest._retry}/${MAX_RETRIES} for ${originalRequest.url} after ${Math.round(delay)}ms (Status: ${status || 'Network Error'})`);

        // Handle rate limiting specifically
        if (status === 429) {
          const retryAfter = error.response.headers?.['retry-after']; // Case-insensitive header check is handled by axios lowercasing keys
          const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : null;
          if (retryAfterSeconds) {
            delay = retryAfterSeconds * 1000;
            console.log(`Rate limited. Retrying after ${delay}ms (from Retry-After header)`);
          } else {
             console.log(`Rate limited. Retrying after calculated delay ${delay}ms`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        return apiClient(originalRequest); // Retry the request
      }
    }

    // --- Token Refresh Logic (401 Unauthorized) ---
    if (status === 401 && !originalRequest._hasRefreshed) {
      // Avoid refresh loops for refresh endpoint itself or login
      if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
        // Clear tokens if refresh/login itself fails with 401
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
        await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
        // Signal logout needed - calling code should handle navigation
        return Promise.reject(new Error('Authentication failed'));
      }

      if (isRefreshing) {
        // If refresh is already in progress, queue the original request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
        .then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return apiClient(originalRequest); // Retry with new token
        })
        .catch(err => {
          return Promise.reject(err); // Propagate the error from refresh failure
        });
      }

      originalRequest._hasRefreshed = true; // Mark this request attempt
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Use axios directly to avoid interceptor loop for refresh token request
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken
        }, {
          headers: { 'Content-Type': 'application/json' }
          // No Authorization header needed for refresh token typically
        });

        const newAuthToken = data.token; // Adjust based on your refresh response structure
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, newAuthToken);

        // If your API also returns a new refresh token, store it
        if (data.refreshToken) {
           await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
        }

        // Apply the new token to the original request and subsequent queued requests
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAuthToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newAuthToken}`;
        processQueue(null, newAuthToken); // Resolve queued requests

        return apiClient(originalRequest); // Retry the original request with the new token

      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError.message);
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
        await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
        processQueue(refreshError, null); // Reject queued requests
        // Signal logout needed - calling code should handle navigation
        // We throw a specific error or the original one for context
        return Promise.reject(new Error('Session expired. Please log in again.'));
      } finally {
        isRefreshing = false;
      }
    }

    // --- Standardized Error Handling ---
    const errorResponse = {
      status: error.response?.status,
      message: error.response?.data?.message || error.message || 'An unknown error occurred',
      data: error.response?.data,
      config: originalRequest // Include original request config for debugging
    };

    console.error('API Error:', JSON.stringify(errorResponse, null, 2)); // Log detailed error
    return Promise.reject(errorResponse); // Reject with standardized error object
  }
);


// --- Authentication Utilities (Async) ---
const isAuthenticated = async () => {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return false;

  try {
    const payload = token.split('.')[1];
    if (!payload) return false;

    const decodedData = JSON.parse(base64.decode(payload));
    const expirationTime = decodedData.exp * 1000; // Convert JWT exp (seconds) to milliseconds

    return expirationTime > Date.now();
  } catch (error) {
    console.error('Error checking token validity:', error);
    // If token is malformed, consider it invalid
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY); // Clean up bad token
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    return false;
  }
};

const getCurrentUserId = async () => {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const decodedData = JSON.parse(base64.decode(payload));
    return decodedData.id || decodedData.sub; // Common JWT fields for user ID
  } catch (error) {
    console.error('Error extracting user ID from token:', error);
    return null;
  }
};

// Logout helper (Async)
const logout = async () => {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);

  // Clear local tokens immediately
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  // Clear Authorization header from default Axios instance settings
  delete apiClient.defaults.headers.common['Authorization'];

  // Attempt to invalidate tokens on the server (best effort)
  try {
    // Send relevant tokens if your logout endpoint requires them
    await apiClient.post('/auth/logout', { refreshToken }); // Adjust payload as needed
  } catch (error) {
    // Log error but don't prevent client-side logout
    console.warn('Error during server logout API call:', error.message);
  }
  // NOTE: Navigation to login screen must be handled by the calling code (e.g., in App state management)
};

// Login helper (Async)
const login = async (credentials) => {
  try {
    const data = await apiClient.post('/auth/login', credentials);
    if (data.token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
      // Set default header for subsequent requests in this session
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    }
    if (data.refreshToken) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    return data; // Return user data or confirmation
  } catch (error) {
    // Error already processed by interceptor, just re-throw
    throw error;
  }
};

// --- Enhanced Task API (Mostly unchanged, adapted query params) ---
class TaskAPI {
  constructor() {
    // Caching, queuing, rate limiting logic remains the same
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.requestQueue = [];
    this.processing = false;
    this.activeRequests = 0;
    this.MAX_CONCURRENT = 5; // Adjusted for potentially less stable mobile networks
    this.rateLimitPerSecond = 8; // Adjusted for mobile context
    this.requestTimestamps = [];
    this.cacheConfig = {
      defaultExpiry: 30000,
      longExpiry: 5 * 60 * 1000,
      shortExpiry: 10000
    };
  }

  // Helper to build query strings safely
  buildQueryString(params) {
      const queryParts = [];
      for (const key in params) {
          if (Object.prototype.hasOwnProperty.call(params, key) && params[key] !== undefined) {
              queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
          }
      }
      return queryParts.join('&');
  }

  // --- Caching, Queuing, Rate Limiting Methods (Keep as is from original) ---
  // shouldRateLimit, trackRequest, getCachedData, invalidateCache,
  // enqueueRequest, processQueue...
  // (These methods are platform-independent JavaScript logic)

  // --- API Methods using buildQueryString ---
  getTasks(params = {}) {
    const queryString = this.buildQueryString(params);
    const cacheKey = `tasks_${queryString || 'all'}`; // Handle empty query string
    return this.getCachedData(cacheKey, () =>
      apiClient.get(`/tasks${queryString ? `?${queryString}` : ''}`)
    , { shortCache: true });
  }

  getTaskById(taskId) {
    const cacheKey = `task_${taskId}`;
    return this.getCachedData(cacheKey, () =>
      apiClient.get(`/tasks/${taskId}`)
    );
  }

  createTask(taskData) {
    this.invalidateCache((key) => key.startsWith('tasks_'));
    return this.enqueueRequest(() =>
      apiClient.post('/tasks', taskData)
    , 'high');
  }

  updateTask(taskId, taskData) {
    this.invalidateCache(`task_${taskId}`);
    this.invalidateCache((key) => key.startsWith('tasks_'));
    return this.enqueueRequest(() =>
      apiClient.put(`/tasks/${taskId}`, taskData)
    );
  }

  deleteTask(taskId) {
    this.invalidateCache(`task_${taskId}`);
    this.invalidateCache((key) => key.startsWith('tasks_'));
    return this.enqueueRequest(() =>
      apiClient.delete(`/tasks/${taskId}`)
    );
  }

  toggleTaskStatus(taskId) {
    this.invalidateCache(`task_${taskId}`);
    this.invalidateCache((key) => key.startsWith('tasks_'));
    return this.enqueueRequest(() =>
      apiClient.patch(`/tasks/${taskId}/toggle`)
    );
  }

  bulkUpdateTasks(taskIds, updateData) {
    taskIds.forEach(id => this.invalidateCache(`task_${id}`));
    this.invalidateCache((key) => key.startsWith('tasks_'));
    return this.enqueueRequest(() =>
      apiClient.put('/tasks/bulk-update', { taskIds, updateData })
    , 'high');
  }

  bulkDeleteTasks(taskIds) {
    taskIds.forEach(id => this.invalidateCache(`task_${id}`));
    this.invalidateCache((key) => key.startsWith('tasks_'));
    return this.enqueueRequest(() =>
      apiClient.delete('/tasks/bulk-delete', { data: { taskIds } }) // Pass data for DELETE body
    , 'high');
  }

  searchTasks(searchTerm, filters = {}) {
    const params = { search: searchTerm, ...filters };
    const queryString = this.buildQueryString(params);
    const cacheKey = `search_${queryString}`;
    return this.getCachedData(cacheKey, () =>
      apiClient.get(`/tasks/search${queryString ? `?${queryString}` : ''}`)
    , { shortCache: true });
  }

  getTaskStats() {
    return this.getCachedData('task_stats', () =>
      apiClient.get('/tasks/stats')
    , { longCache: true });
  }

  // --- Add back the methods from the original implementation ---
  // (Assume these methods are identical unless they use web-specific APIs)
  shouldRateLimit() {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(time => now - time < 1000);
    return this.requestTimestamps.length >= this.rateLimitPerSecond;
  }

  trackRequest() {
    this.requestTimestamps.push(Date.now());
  }

  getCachedData(key, fetchFn, options = {}) {
    const cached = this.cache.get(key);
    const expiryTime = options.longCache
      ? this.cacheConfig.longExpiry
      : (options.shortCache ? this.cacheConfig.shortExpiry : this.cacheConfig.defaultExpiry);

    if (cached && Date.now() - cached.timestamp < expiryTime) {
      console.log(`Cache hit for key: ${key}`);
      return Promise.resolve(cached.data);
    }
    console.log(`Cache miss for key: ${key}`);

    if (this.pendingRequests.has(key)) {
       console.log(`Request already pending for key: ${key}`);
      return this.pendingRequests.get(key);
    }

    console.log(`Fetching data for key: ${key}`);
    const request = this.enqueueRequest(() => fetchFn())
      .then(data => {
        console.log(`Data fetched successfully for key: ${key}, caching.`);
        this.cache.set(key, { data, timestamp: Date.now() });
        this.pendingRequests.delete(key);
        return data;
      })
      .catch(error => {
         console.error(`Error fetching data for key: ${key}`, error);
        this.pendingRequests.delete(key);
        // Don't cache errors unless specifically designed to
        throw error;
      });

    this.pendingRequests.set(key, request);
    return request;
  }

  invalidateCache(key = null) {
     console.log(`Invalidating cache for: ${key === null ? 'all' : (typeof key === 'function' ? 'matching keys' : key)}`);
    if (key === null) {
      this.cache.clear();
      console.log("Cleared all cache.");
    } else if (typeof key === 'string') {
      const deleted = this.cache.delete(key);
      if(deleted) console.log(`Invalidated cache for key: ${key}`);
    } else if (typeof key === 'function') { // Invalidate based on a predicate function
      let invalidatedCount = 0;
      for (const cacheKey of this.cache.keys()) {
        if (key(cacheKey)) {
          this.cache.delete(cacheKey);
          invalidatedCount++;
        }
      }
      console.log(`Invalidated ${invalidatedCount} cache entries based on predicate.`);
    }
  }

  enqueueRequest(fn, priority = 'normal') {
    return new Promise((resolve, reject) => {
      const request = { fn, resolve, reject, priority, timestamp: Date.now() };

       // Simple queueing for now, add priority logic if needed from original
      this.requestQueue.push(request);
      console.log(`Request queued (${priority}). Queue size: ${this.requestQueue.length}`);

      // Start processing if not already running and within limits
      this.processQueue();
    });
  }

  async processQueue() {
    // Prevent multiple concurrent processing loops, ensure only run if needed
    if (this.processing || this.requestQueue.length === 0 || this.activeRequests >= this.MAX_CONCURRENT) {
        if(this.requestQueue.length === 0 && this.activeRequests === 0) {
            this.processing = false; // Ensure processing stops if queue empty and no active reqs
        }
        return;
    }

    this.processing = true; // Mark as processing

    while (this.requestQueue.length > 0 && this.activeRequests < this.MAX_CONCURRENT) {
      if (this.shouldRateLimit()) {
        console.log(`Rate limit reached. Delaying queue processing.`);
        // Use setTimeout to yield and check again later, preventing a busy-wait loop
        setTimeout(() => {
            this.processing = false; // Allow processQueue to be called again
            this.processQueue();
        }, 100); // Check again shortly
        return; // Exit the current loop iteration
      }

      const request = this.requestQueue.shift(); // Get the next request
       console.log(`Processing request. Active: ${this.activeRequests + 1}/${this.MAX_CONCURRENT}. Queue: ${this.requestQueue.length}`);
      this.activeRequests++;
      this.trackRequest(); // Track for rate limiting

      // Execute the request asynchronously without blocking the loop
      // Use an IIAFE (Immediately Invoked Async Function Expression) or simple async call
      (async () => {
          try {
              const result = await request.fn();
              request.resolve(result);
          } catch (error) {
              request.reject(error);
          } finally {
              this.activeRequests--;
              console.log(`Request finished. Active: ${this.activeRequests}. Queue: ${this.requestQueue.length}`);
              // Immediately try to process the next item if conditions allow
               this.processing = false; // Reset processing flag before potentially recursive call
               this.processQueue();
          }
      })(); // Execute immediately
    }

    // If the loop finished because MAX_CONCURRENT was reached but queue still has items,
    // the finally block of the last finished request will trigger processQueue again.
    // If loop finished because queue is empty, set processing to false.
     if (this.requestQueue.length === 0) {
       this.processing = false;
       console.log("Request queue empty.");
     } else if(this.activeRequests === 0) {
        // Edge case: if loop exited but active requests somehow became 0
        this.processing = false;
        this.processQueue(); // Try again
     }
     // If processing is true here, it means MAX_CONCURRENT was hit, and we are waiting for requests to finish.
  }
}


// --- Auth API (Async Storage aware) ---
class AuthAPI {
  login(credentials) {
    // Uses the async login helper function
    return login(credentials);
  }

  async register(userData) {
    // Assumes registration doesn't immediately log in / return tokens handled by login()
    return apiClient.post('/auth/register', userData);
  }

  logout() {
    // Uses the async logout helper function
    return logout();
  }

  async forgotPassword(email) {
    return apiClient.post('/auth/forgot-password', { email });
  }

  async validateResetToken(token) {
    return apiClient.get(`/auth/reset-password/${token}`);
  }

  async resetPassword(token, newPassword) {
    return apiClient.post('/auth/reset-password', { token, newPassword });
  }

  // Note: Refresh token logic is primarily handled by the interceptor now.
  // This method could be kept for manual refresh triggers if needed.
  async refreshToken() {
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      return Promise.reject(new Error('No refresh token available for manual refresh'));
    }
    try {
      const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      if (data.token) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      }
      if (data.refreshToken) {
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      }
      return data;
    } catch(error) {
        console.error("Manual token refresh failed", error);
         // Decide if logout is necessary based on the error (e.g., 401 on refresh)
        if (error.response?.status === 401 || error.response?.status === 403) {
            await logout(); // Trigger logout if refresh token is invalid
            throw new Error("Session expired. Please log in again.");
        }
        throw error; // Re-throw other errors
    }
  }

  isAuthenticated() {
    // Uses the async isAuthenticated helper
    return isAuthenticated();
  }

  getCurrentUserId() {
    // Uses the async getCurrentUserId helper
    return getCurrentUserId();
  }
}

// --- User API (Using TaskAPI's cache methods via instance) ---
const taskApiInstance = new TaskAPI(); // Create instance to share caching mechanism

class UserAPI {
  async getProfile() {
    // Use taskApiInstance's caching method
    return taskApiInstance.getCachedData('user_profile', () =>
      apiClient.get('/user/profile')
    , { defaultExpiry: 60000 }); // Cache profile slightly longer maybe
  }

  async updateProfile(userData) {
    taskApiInstance.invalidateCache('user_profile');
    return apiClient.put('/user/profile', userData);
  }

  async changePassword(passwordData) {
    // Password change likely doesn't affect cached profile data unless you cache specific flags
    return apiClient.put('/user/password', passwordData);
  }

  // Expose cache invalidation if needed externally
  invalidateUserProfileCache() {
      taskApiInstance.invalidateCache('user_profile');
  }
}

// --- Instantiate and Export ---
const authApi = new AuthAPI();
const userApi = new UserAPI();
// Task API instance is already created: taskApiInstance

// Consolidated API object
const api = {
  tasks: taskApiInstance, // Use the shared instance
  auth: authApi,
  user: userApi,
  // Expose utility functions directly if convenient
  isAuthenticated,
  getCurrentUserId,
  login, // The async helper
  logout, // The async helper
};

// Export individuals and the consolidated object
export {
  apiClient,    // The configured axios instance
  taskApiInstance as taskApi, // Export instance with clear name
  authApi,
  userApi,
  isAuthenticated, // Async version
  getCurrentUserId, // Async version
  login, // Async version
  logout, // Async version
};

// Default export for easy import
export default api;