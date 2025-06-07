import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

// Enhanced configuration with environment-specific settings
const API_CONFIG = {
  baseURL: API_URL,
  timeout: 15000, // 15 seconds
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  maxRetries: 3,
  retryDelay: 1000, // Milliseconds
  rateLimitPerSecond: 10,
  maxConcurrentRequests: 6,
  cache: {
    defaultExpiry: 30 * 1000,  // 30 seconds
    longExpiry: 5 * 60 * 1000, // 5 minutes
    shortExpiry: 10 * 1000,    // 10 seconds
  }
};

// Enhanced error types for better error handling
class APIError extends Error {
  constructor(message, status, code, originalError) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

class NetworkError extends APIError {
  constructor(message, originalError) {
    super(message, null, 'NETWORK_ERROR', originalError);
    this.name = 'NetworkError';
  }
}

class AuthenticationError extends APIError {
  constructor(message, status = 401) {
    super(message, status, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

class RateLimitError extends APIError {
  constructor(message, retryAfter) {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter; // Milliseconds
  }
}

// Enhanced token management with better security practices
class TokenManager {
  constructor() {
    this.isRefreshing = false;
    this.failedQueue = [];
    this.localStorageAvailable = typeof localStorage !== 'undefined';
  }

  _getItem(key) {
    if (!this.localStorageAvailable) return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`Failed to access localStorage for ${key}:`, error);
      return null;
    }
  }

  _setItem(key, value) {
    if (!this.localStorageAvailable) {
        console.warn('localStorage not available, cannot set item.');
        return;
    }
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error(`Failed to store ${key} in localStorage:`, error);
      throw new Error('Token storage failed');
    }
  }

  _removeItem(key) {
    if (!this.localStorageAvailable) return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove ${key} from localStorage:`, error);
    }
  }

  getAuthToken() {
    return this._getItem('authToken');
  }

  getRefreshToken() {
    return this._getItem('refreshToken');
  }

  setTokens(authToken, refreshToken) {
    if (authToken) this._setItem('authToken', authToken);
    // Allow explicitly setting refreshToken to null to clear it, or providing a new one
    if (refreshToken !== undefined) {
        if (refreshToken === null) {
            this._removeItem('refreshToken');
        } else {
            this._setItem('refreshToken', refreshToken);
        }
    }
  }

  clearTokens() {
    this._removeItem('authToken');
    this._removeItem('refreshToken');
  }

  isTokenValid(token) {
    if (!token) return false;
    
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false; // Not a JWT
      
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return true; // No expiration claim, assume valid (or handle as invalid)

      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const bufferTime = 5 * 60 * 1000; // 5 minutes buffer to account for clock skew and request time
      
      return expirationTime > (Date.now() + bufferTime);
    } catch (error) {
      console.error('Error validating token:', error);
      return false; // Invalid token if parsing or structure is wrong
    }
  }

  getUserIdFromToken(token = null) {
    const authToken = token || this.getAuthToken();
    if (!authToken) return null;
    
    try {
      const parts = authToken.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload.id || payload.sub || payload.userId || null;
    } catch (error) {
      console.error('Error extracting user ID from token:', error);
      return null;
    }
  }

  isAuthenticated() {
    const token = this.getAuthToken();
    return token && this.isTokenValid(token);
  }

  async refreshTokens() {
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.failedQueue.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      this.isRefreshing = false;
      this.failedQueue.forEach(({ reject }) => reject(new AuthenticationError('No refresh token available')));
      this.failedQueue = [];
      throw new AuthenticationError('No refresh token available');
    }

    try {
      // Use a raw axios instance for refresh token to avoid circular interceptor issues
      const response = await axios.post(`${API_CONFIG.baseURL}/auth/refresh`, {
        refreshToken
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: API_CONFIG.withCredentials,
        timeout: 10000 // Specific timeout for refresh
      });

      const { token, refreshToken: newRefreshToken } = response.data;
      this.setTokens(token, newRefreshToken);

      this.failedQueue.forEach(({ resolve }) => resolve(token));
      return token;
    } catch (error) {
      this.failedQueue.forEach(({ reject }) => reject(error));
      this.clearTokens(); // Critical: clear tokens on refresh failure
      // Determine if the error is from Axios and has a response
      if (axios.isAxiosError(error) && error.response) {
        throw new AuthenticationError(`Token refresh failed: ${error.response.data?.message || error.message}`, error.response.status);
      }
      throw new AuthenticationError(`Token refresh failed: ${error.message}`);
    } finally {
      this.isRefreshing = false;
      this.failedQueue = [];
    }
  }
}

const tokenManager = new TokenManager();

// Create axios instance with enhanced configuration
const apiClient = axios.create(API_CONFIG);

// Enhanced request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = tokenManager.getAuthToken();
    // Attach token if it's valid. If not, let the request proceed without it;
    // the backend will return a 401 if it's required and missing/invalid.
    if (token && tokenManager.isTokenValid(token)) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Add request ID and start time for debugging and performance monitoring
    config.metadata = { 
      requestId: Math.random().toString(36).substring(2, 11),
      startTime: Date.now()
    };
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    // This error occurs before the request is sent
    return Promise.reject(new NetworkError('Request configuration failed', error));
  }
);

// Enhanced response interceptor with comprehensive error handling
const RETRY_CODES = [408, 429, 500, 502, 503, 504]; // Status codes that might warrant a retry
const SKIP_RETRY_ENDPOINTS = ['/auth/logout', '/tasks/bulk-delete', '/tasks/bulk-update']; // Endpoints not safe for retry

apiClient.interceptors.response.use(
  (response) => {
    // Log successful requests in development
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - (response.config.metadata?.startTime || Date.now());
      console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} (${response.status}) (${duration}ms)`);
    }
    return response.data; // Key change: return data directly for convenience
  },
  async (error) => {
    const originalRequest = error.config;
    const requestId = originalRequest?.metadata?.requestId;
    
    console.error(`❌ API Error [${requestId}]:`, {
      url: originalRequest?.url,
      method: originalRequest?.method,
      status: error.response?.status,
      message: error.message,
      responseData: error.response?.data,
      // originalError: error // Uncomment if deep original error inspection is needed
    });

    // Handle network errors (request made but no response received, or setup error)
    if (!error.response && error.isAxiosError) { // Check if it's an Axios error without a response
      throw new NetworkError(`Network request failed for ${originalRequest?.url}: ${error.message}`, error);
    }
    if (!error.response) { // Non-Axios error or other issue
        throw new APIError(error.message || 'An unknown network error occurred', null, 'UNKNOWN_NETWORK_ERROR', error);
    }


    const { status, data, headers } = error.response;
    
    // Handle authentication errors (401 Unauthorized)
    if (status === 401 && !originalRequest._authRetried) {
      // Avoid refresh loops for auth endpoints
      if (originalRequest.url?.includes('/auth/refresh') || 
          originalRequest.url?.includes('/auth/login')) {
        tokenManager.clearTokens(); // Ensure tokens are cleared
        throw new AuthenticationError(data?.message || 'Authentication failed', status);
      }

      originalRequest._authRetried = true; // Mark to prevent infinite refresh loops
      
      try {
        const newToken = await tokenManager.refreshTokens();
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient(originalRequest); // Retry the original request with the new token
      } catch (refreshError) {
        // If refresh fails, a robust AuthenticationError is already thrown by refreshTokens()
        // The application should catch this and decide on redirection.
        // console.warn('Token refresh failed, user needs to re-authenticate.', refreshError);
        // if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        //   // Consider moving this side-effect to the UI layer
        //   // window.location.href = '/login';
        // }
        throw refreshError; // Re-throw the error from tokenManager.refreshTokens()
      }
    }

    // Handle rate limiting (429 Too Many Requests)
    if (status === 429) {
      const retryAfterHeader = headers?.['retry-after'];
      // retry-after can be in seconds or an HTTP-date. Assuming seconds for simplicity here.
      const delay = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : API_CONFIG.retryDelay;
      throw new RateLimitError(data?.message || 'Rate limit exceeded', delay);
    }

    // Generic retry logic for specific server error codes
    const shouldSkipRetry = SKIP_RETRY_ENDPOINTS.some(endpoint => originalRequest.url?.includes(endpoint));
    
    if (!shouldSkipRetry && RETRY_CODES.includes(status)) {
      const retryCount = originalRequest._retryCount || 0;
      
      if (retryCount < API_CONFIG.maxRetries) {
        originalRequest._retryCount = retryCount + 1;
        
        // Exponential backoff with jitter
        const backoffDelay = Math.min(
          API_CONFIG.retryDelay * Math.pow(2, retryCount) * (1 + Math.random() * 0.3),
          10000 // Max backoff delay
        );
        
        console.log(`🔄 Retrying request to ${originalRequest.url} (${retryCount + 1}/${API_CONFIG.maxRetries}) after ${Math.round(backoffDelay)}ms`);
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return apiClient(originalRequest);
      }
    }

    // For all other errors, create a standardized APIError
    const errorMessage = data?.message || error.message || 'An unknown API error occurred';
    const errorCode = data?.code || `HTTP_${status}`;
    throw new APIError(errorMessage, status, errorCode, error);
  }
);

// Enhanced base API class with caching, queuing, rate limiting, and concurrency control
class BaseAPI {
  constructor(client = apiClient) {
    this.client = client;
    this.cache = new Map();
    this.pendingRequests = new Map(); // Deduplicates identical concurrent requests
    this.requestQueue = []; // For managing sequential execution order if needed
    this.processing = false; // Flag for queue processing state
    this.activeRequests = 0; // Count of currently active dispatched requests
    this.requestTimestamps = []; // For rate limiting
    
    this.processQueue = this.processQueue.bind(this);
    this.enqueueRequest = this.enqueueRequest.bind(this);
  }

  shouldRateLimit() {
    const now = Date.now();
    // Filter timestamps older than 1 second
    this.requestTimestamps = this.requestTimestamps.filter(time => now - time < 1000);
    return this.requestTimestamps.length >= API_CONFIG.rateLimitPerSecond;
  }

  trackRequest() {
    this.requestTimestamps.push(Date.now());
  }

  async getCachedData(key, fetchFn, options = {}) {
    const expiryTime = options.longCache
      ? API_CONFIG.cache.longExpiry
      : (options.shortCache ? API_CONFIG.cache.shortExpiry : API_CONFIG.cache.defaultExpiry);

    const cachedItem = this.cache.get(key);
    if (cachedItem && !cachedItem.isError && (Date.now() - cachedItem.timestamp < expiryTime)) {
      return Promise.resolve(cachedItem.data);
    }

    // Short-term caching for errors to prevent hammering failing endpoints
    if (cachedItem?.isError && (Date.now() - cachedItem.timestamp < 5000)) { // Cache errors for 5s
      return Promise.reject(cachedItem.error);
    }

    // Deduplicate concurrent requests for the same key
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    const requestPromise = this.enqueueRequest(fetchFn) // Use queue for all actual fetches
      .then(data => {
        this.cache.set(key, { data, timestamp: Date.now(), isError: false });
        this.pendingRequests.delete(key);
        return data;
      })
      .catch(error => {
        this.cache.set(key, { error, timestamp: Date.now(), isError: true });
        this.pendingRequests.delete(key);
        throw error; // Propagate the error
      });

    this.pendingRequests.set(key, requestPromise);
    return requestPromise;
  }

  invalidateCache(keyOrPredicate = null) {
    if (keyOrPredicate === null) {
      this.cache.clear();
      this.pendingRequests.clear(); // Also clear pending requests if all cache is gone
      if (process.env.NODE_ENV === 'development') console.log('🗑️ Cache cleared entirely');
    } else if (typeof keyOrPredicate === 'string') {
      this.cache.delete(keyOrPredicate);
      this.pendingRequests.delete(keyOrPredicate); // Remove from pending if present
      if (process.env.NODE_ENV === 'development') console.log(`🗑️ Cache invalidated for key: ${keyOrPredicate}`);
    } else if (typeof keyOrPredicate === 'function') {
      let invalidatedCount = 0;
      for (const cacheKey of this.cache.keys()) {
        if (keyOrPredicate(cacheKey)) {
          this.cache.delete(cacheKey);
          this.pendingRequests.delete(cacheKey);
          invalidatedCount++;
        }
      }
      if (process.env.NODE_ENV === 'development') console.log(`🗑️ Cache invalidated for ${invalidatedCount} keys matching predicate`);
    }
  }

  enqueueRequest(fn, priority = 'normal') {
    return new Promise((resolve, reject) => {
      const request = { 
        fn, 
        resolve, 
        reject, 
        priority, 
        timestamp: Date.now(),
        id: Math.random().toString(36).substring(2, 11) // Unique ID for queued request
      };

      // Simple priority implementation (high goes to front, low to back)
      if (priority === 'high') {
        this.requestQueue.unshift(request);
      } else if (priority === 'low') {
        this.requestQueue.push(request);
      } else { // normal
        // Insert normal priority before low priority, otherwise append
        const lowPriorityIndex = this.requestQueue.findIndex(r => r.priority === 'low');
        if (lowPriorityIndex !== -1) {
          this.requestQueue.splice(lowPriorityIndex, 0, request);
        } else {
          this.requestQueue.push(request);
        }
      }
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing) return; // Already processing the decision to launch workers
    this.processing = true;

    const processNextRequest = async () => {
      if (this.requestQueue.length === 0) {
        // No items left for this worker thread
        return;
      }

      if (this.shouldRateLimit()) {
        // If rate-limited, this worker thread defers and tries again
        setTimeout(processNextRequest, 100 + Math.random() * 50);
        return;
      }

      const requestToProcess = this.requestQueue.shift(); // Get the highest priority request
      if (!requestToProcess) {
         // Should not happen if queue.length > 0 check passed, but good guard
        return;
      }

      this.activeRequests++;
      this.trackRequest(); // Mark timestamp for rate limiting

      try {
        const result = await requestToProcess.fn();
        requestToProcess.resolve(result);
      } catch (error) {
        requestToProcess.reject(error);
      } finally {
        this.activeRequests--;
        // This worker finished, try to pick up another request if queue has items
        if (this.requestQueue.length > 0) {
          processNextRequest(); // Continue processing with this worker thread
        }
        // If queue is empty, this worker thread finishes.
        // The outer processQueue logic will re-evaluate if all workers stop.
      }
    };

    // Manager: Launch worker threads up to the concurrent limit
    const workersToLaunch = [];
    while (this.activeRequests < API_CONFIG.maxConcurrentRequests && 
           this.requestQueue.length > 0 &&
           !this.shouldRateLimit()) {
      // Each call to processNextRequest effectively starts a new "worker thread"
      // that will self-sustain as long as there are requests.
      // We don't increment activeRequests here, processNextRequest does it.
      workersToLaunch.push(processNextRequest());
    }

    if (workersToLaunch.length > 0) {
      // Wait for the first task of each newly launched worker to settle.
      // Workers will continue processing subsequent tasks on their own.
      await Promise.allSettled(workersToLaunch);
    }

    // After the initial batch of workers might have completed their first task or deferred:
    // Check if the queue still needs attention (e.g., if all workers became idle or hit rate limits).
    this.processing = false; // Allow processQueue to be called again by enqueueRequest or setTimeout
    
    if (this.requestQueue.length > 0 && this.activeRequests < API_CONFIG.maxConcurrentRequests) {
      // If there are still requests and capacity, try to kick off more processing.
      // This could be due to workers finishing or rate limit passing.
      this.processQueue();
    } else if (this.requestQueue.length > 0 && (this.activeRequests >= API_CONFIG.maxConcurrentRequests || this.shouldRateLimit())) {
      // Queue has items, but we are at capacity or rate-limited. Schedule a check.
      setTimeout(this.processQueue, 100 + Math.random() * 50);
    }
    // If queue is empty, processing naturally stops.
  }

  buildQueryString(params) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') { // Check for non-empty strings too
        if (Array.isArray(value)) {
          value.forEach(v => {
            if (v !== undefined && v !== null && String(v).trim() !== '') {
              queryParams.append(key, v);
            }
          });
        } else {
          queryParams.append(key, value);
        }
      }
    });
    return queryParams.toString();
  }
}


class TaskAPI extends BaseAPI {
  constructor(client) { // client will default to apiClient if new TaskAPI() is called
    super(client);
  }

  async getTasks(params = {}) {
    try {
      const queryString = this.buildQueryString(params);
      const cacheKey = `tasks_list_${queryString || 'all'}`; 
      
      return await this.getCachedData(
        cacheKey, 
        () => this.client.get(`/tasks?${queryString}`),
        { shortCache: true }
      );
    } catch (error) {
      console.error(`TaskAPI Error in getTasks: ${error.message}`, error);
      throw error;
    }
  }

  async getTaskById(taskId) {
    if (!taskId) {
      throw new APIError('Task ID is required for getTaskById', 400, 'INVALID_TASK_ID');
    }
    const cacheKey = `task_item_${taskId}`;
    try {
      return await this.getCachedData(
        cacheKey, 
        () => this.client.get(`/tasks/${taskId}`)
      );
    } catch (error) {
      console.error(`TaskAPI Error in getTaskById (${taskId}): ${error.message}`, error);
      throw error;
    }
  }

  async createTask(taskData) {
    if (!taskData || typeof taskData !== 'object' || !taskData.title) {
      throw new APIError('Valid task data with a title is required for createTask', 400, 'INVALID_TASK_DATA');
    }
    try {
      const result = await this.enqueueRequest(
        () => this.client.post('/tasks', taskData), 
        'high'
      );
      
      this.invalidateCache(key => key.startsWith('tasks_list_'));
      this.invalidateCache('task_stats');
      return result;
    } catch (error) {
      console.error(`TaskAPI Error in createTask: ${error.message}`, error);
      throw error;
    }
  }

  async updateTask(taskId, taskData) {
    if (!taskId) {
      throw new APIError('Task ID is required for updateTask', 400, 'INVALID_TASK_ID');
    }
    if (!taskData || typeof taskData !== 'object') {
      throw new APIError('Valid task update data is required', 400, 'INVALID_TASK_UPDATE_DATA');
    }
    try {
      const result = await this.enqueueRequest(
        () => this.client.put(`/tasks/${taskId}`, taskData)
      );
      
      this.invalidateCache(`task_item_${taskId}`);
      this.invalidateCache(key => key.startsWith('tasks_list_'));
      this.invalidateCache('task_stats');
      return result;
    } catch (error) {
      console.error(`TaskAPI Error in updateTask (${taskId}): ${error.message}`, error);
      throw error;
    }
  }

  async deleteTask(taskId) {
    if (!taskId) {
      throw new APIError('Task ID is required for deleteTask', 400, 'INVALID_TASK_ID');
    }
    try {
      const result = await this.enqueueRequest(
        () => this.client.delete(`/tasks/${taskId}`)
      );
      
      this.invalidateCache(`task_item_${taskId}`);
      this.invalidateCache(key => key.startsWith('tasks_list_'));
      this.invalidateCache('task_stats');
      return result;
    } catch (error) {
      console.error(`TaskAPI Error in deleteTask (${taskId}): ${error.message}`, error);
      throw error;
    }
  }

  async toggleTaskStatus(taskId) {
    if (!taskId) {
      throw new APIError('Task ID is required for toggleTaskStatus', 400, 'INVALID_TASK_ID');
    }
    try {
      const result = await this.enqueueRequest(
        () => this.client.patch(`/tasks/${taskId}/toggle`)
      );
      
      this.invalidateCache(`task_item_${taskId}`);
      this.invalidateCache(key => key.startsWith('tasks_list_'));
      this.invalidateCache('task_stats');
      return result;
    } catch (error) {
      console.error(`TaskAPI Error in toggleTaskStatus (${taskId}): ${error.message}`, error);
      throw error;
    }
  }

  async searchTasks(searchTerm, filters = {}) {
    if (!searchTerm || typeof searchTerm !== 'string') {
      throw new APIError('Search term is required for searchTasks', 400, 'INVALID_SEARCH_TERM');
    }
    const params = { search: searchTerm, ...filters };
    const queryString = this.buildQueryString(params);
    const cacheKey = `tasks_search_${queryString}`;
    
    try {
      return await this.getCachedData(
        cacheKey,
        () => this.client.get(`/tasks/search?${queryString}`),
        { shortCache: true }
      );
    } catch (error) {
      console.error(`TaskAPI Error in searchTasks: ${error.message}`, error);
      throw error;
    }
  }

  async getTaskStats() {
    const cacheKey = 'task_stats';
    try {
      return await this.getCachedData(
        cacheKey,
        () => this.client.get('/tasks/stats'),
        { longCache: true }
      );
    } catch (error) {
      console.error(`TaskAPI Error in getTaskStats: ${error.message}`, error);
      throw error;
    }
  }

  async bulkUpdateTasks(taskIds, updateData) {
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new APIError('Task IDs array is required for bulkUpdateTasks', 400, 'INVALID_TASK_IDS');
    }
    if (!updateData || typeof updateData !== 'object') {
      throw new APIError('Update data is required for bulkUpdateTasks', 400, 'INVALID_UPDATE_DATA');
    }
    try {
      const result = await this.enqueueRequest(
        () => this.client.put('/tasks/bulk-update', { taskIds, updateData }),
        'high'
      );
      
      taskIds.forEach(id => this.invalidateCache(`task_item_${id}`));
      this.invalidateCache(key => key.startsWith('tasks_list_'));
      this.invalidateCache('task_stats');
      return result;
    } catch (error) {
      console.error(`TaskAPI Error in bulkUpdateTasks: ${error.message}`, error);
      throw error;
    }
  }

  async bulkDeleteTasks(taskIds) {
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new APIError('Task IDs array is required for bulkDeleteTasks', 400, 'INVALID_TASK_IDS');
    }
    try {
      const result = await this.enqueueRequest(
        () => this.client.delete('/tasks/bulk-delete', { data: { taskIds } }), // Pass data for DELETE
        'high'
      );
      
      taskIds.forEach(id => this.invalidateCache(`task_item_${id}`));
      this.invalidateCache(key => key.startsWith('tasks_list_'));
      this.invalidateCache('task_stats');
      return result;
    } catch (error) {
      console.error(`TaskAPI Error in bulkDeleteTasks: ${error.message}`, error);
      throw error;
    }
  }
}

// AuthAPI does not extend BaseAPI as its methods have specific behaviors (no general caching/queueing)
class AuthAPI {
  constructor(client = apiClient) {
    this.client = client;
    this.tokenManager = tokenManager; // Use the global tokenManager instance
  }

  async login(credentials) {
    if (!credentials?.email || !credentials?.password) {
      throw new APIError('Email and password are required for login', 400, 'INVALID_CREDENTIALS');
    }
    try {
      // apiClient already returns data property due to interceptor
      const responseData = await this.client.post('/auth/login', credentials);
      if (responseData.token) { // Assuming 'token' and 'refreshToken' are in responseData
        this.tokenManager.setTokens(responseData.token, responseData.refreshToken);
      }
      return responseData;
    } catch (error) {
      console.error(`AuthAPI Error in login: ${error.message}`, error);
      throw error; // Error is already processed by interceptor
    }
  }

  async register(userData) {
    if (!userData?.email || !userData?.password) {
      throw new APIError('Email and password are required for registration', 400, 'INVALID_USER_DATA');
    }
    try {
      return await this.client.post('/auth/register', userData);
    } catch (error) {
      console.error(`AuthAPI Error in register: ${error.message}`, error);
      throw error;
    }
  }

  async logout() {
    try {
      await this.client.post('/auth/logout');
    } catch (error) {
      // Log and ignore server-side logout errors, proceed with client-side cleanup
      console.warn(`AuthAPI warning during logout: ${error.message}`, error);
    } finally {
      this.tokenManager.clearTokens(); // Always clear tokens client-side
    }
  }

  async forgotPassword(email) {
    if (!email) {
      throw new APIError('Email is required for forgotPassword', 400, 'INVALID_EMAIL');
    }
    try {
      return await this.client.post('/auth/forgot-password', { email });
    } catch (error) {
      console.error(`AuthAPI Error in forgotPassword: ${error.message}`, error);
      throw error;
    }
  }

  async validateResetToken(token) {
    if (!token) {
      throw new APIError('Reset token is required for validateResetToken', 400, 'INVALID_TOKEN');
    }
    try {
      return await this.client.get(`/auth/reset-password/${token}`);
    } catch (error) {
      console.error(`AuthAPI Error in validateResetToken: ${error.message}`, error);
      throw error;
    }
  }

  async resetPassword(token, newPassword) {
    if (!token || !newPassword) {
      throw new APIError('Token and new password are required for resetPassword', 400, 'INVALID_RESET_DATA');
    }
    try {
      return await this.client.post('/auth/reset-password', { token, newPassword });
    } catch (error) {
      console.error(`AuthAPI Error in resetPassword: ${error.message}`, error);
      throw error;
    }
  }

  async refreshToken() {
    // This delegates directly to tokenManager's refreshTokens method
    try {
      return await this.tokenManager.refreshTokens();
    } catch (error) {
       console.error(`AuthAPI Error in refreshToken: ${error.message}`, error);
       throw error; // Error from tokenManager is already an AuthenticationError
    }
  }

  isAuthenticated() {
    return this.tokenManager.isAuthenticated();
  }

  getCurrentUserId() {
    return this.tokenManager.getUserIdFromToken();
  }
}

class UserAPI extends BaseAPI {
  constructor(client) { // client will default to apiClient if new UserAPI() is called
    super(client);
  }

  async getProfile() {
    try {
      return await this.getCachedData(
        'user_profile',
        () => this.client.get('/user/profile'),
        { longCache: true }
      );
    } catch (error) {
      console.error(`UserAPI Error in getProfile: ${error.message}`, error);
      throw error;
    }
  }

  async updateProfile(userData) {
    if (!userData || typeof userData !== 'object') {
      throw new APIError('User data object is required for updateProfile', 400, 'INVALID_USER_DATA');
    }
    try {
      const result = await this.client.put('/user/profile', userData);
      this.invalidateCache('user_profile'); // Invalidate after successful update
      return result;
    } catch (error) {
      console.error(`UserAPI Error in updateProfile: ${error.message}`, error);
      throw error;
    }
  }

  async changePassword(passwordData) {
    if (!passwordData?.currentPassword || !passwordData?.newPassword) {
      throw new APIError('Current and new passwords are required for changePassword', 400, 'INVALID_PASSWORD_DATA');
    }
    try {
      return await this.client.put('/user/password', passwordData);
    } catch (error) {
      console.error(`UserAPI Error in changePassword: ${error.message}`, error);
      throw error;
    }
  }

  async uploadAvatar(file) {
    if (!(file instanceof File)) {
      throw new APIError('A valid File object is required for avatar upload', 400, 'INVALID_FILE');
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      // For multipart/form-data, axios usually sets Content-Type automatically
      // if you pass FormData directly as data.
      const result = await this.client.post('/user/avatar', formData, {
        headers: {
          // 'Content-Type': 'multipart/form-data', // Axios should set this with boundary
        }
      });
      this.invalidateCache('user_profile'); // Avatar change likely affects profile
      return result;
    } catch (error) {
      console.error(`UserAPI Error in uploadAvatar: ${error.message}`, error);
      throw error;
    }
  }
}

// Create API instances
const taskApi = new TaskAPI(); // Uses default apiClient
const authApi = new AuthAPI(); // Uses default apiClient and global tokenManager
const userApi = new UserAPI(); // Uses default apiClient

// Consolidated API object for easier import and use
const api = {
  tasks: taskApi,
  auth: authApi,
  user: userApi,
  // Expose utility functions from tokenManager or for general use
  isAuthenticated: () => tokenManager.isAuthenticated(),
  getCurrentUserId: () => tokenManager.getUserIdFromToken(),
  clearAllCache: () => { // More descriptive name
    taskApi.invalidateCache(); // Clear all task-related cache
    userApi.invalidateCache(); // Clear all user-related cache
    // Add other API cache invalidations if they exist
    if (process.env.NODE_ENV === 'development') console.log('🗑️ All known API caches cleared.');
  },
  // Expose error classes for type checking by consumers if needed
  errors: {
    APIError,
    NetworkError,
    AuthenticationError,
    RateLimitError
  }
};

// Export individual components and the consolidated api object
export {
  apiClient, // The configured axios instance
  taskApi,
  authApi,
  userApi,
  tokenManager, // For direct token management if necessary
  APIError,
  NetworkError,
  AuthenticationError,
  RateLimitError,
  BaseAPI // Export BaseAPI if it's intended to be subclassed externally
};

export default api;