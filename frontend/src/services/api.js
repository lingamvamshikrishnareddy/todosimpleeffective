import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

// Create axios instance with defaults
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000, // Increased timeout for network congestion
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true // Send cookies with cross-origin requests
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Enhanced response interceptor with better retry logic and rate limiting handling
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RETRY_CODES = [408, 429, 500, 502, 503, 504];

apiClient.interceptors.response.use(
  response => response.data,
  async error => {
    const originalRequest = error.config;
    
    // Skip retry for certain endpoints to avoid duplication
    const skipRetryEndpoints = ['/tasks/bulk-delete', '/tasks/bulk-update', '/auth/logout'];
    const shouldSkipRetry = skipRetryEndpoints.some(endpoint => originalRequest.url.includes(endpoint));
    
    if (!shouldSkipRetry && (!originalRequest._retry || originalRequest._retry < MAX_RETRIES)) {
      const status = error.response?.status;
      
      // Retry on network errors or specific status codes
      if (!error.response || RETRY_CODES.includes(status)) {
        originalRequest._retry = (originalRequest._retry || 0) + 1;
        
        // Calculate backoff delay with jitter to prevent thundering herd
        const jitter = Math.random() * 0.3;
        const backoffFactor = Math.min(Math.pow(2, originalRequest._retry - 1), 10);
        const delay = RETRY_DELAY_MS * backoffFactor * (1 + jitter);
        
        console.log(`API retry ${originalRequest._retry}/${MAX_RETRIES} for ${originalRequest.url} after ${Math.round(delay)}ms`);
        
        // Special handling for rate limiting
        if (status === 429) {
          // Extract retry-after header if available or use our calculated delay
          const retryAfter = error.response.headers['retry-after'];
          const retryDelay = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
          
          console.log(`Rate limited. Retrying after ${retryDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        return apiClient(originalRequest);
      }
    }
    
    // Handle 401 Unauthorized - refresh token or redirect to login
    if (error.response && error.response.status === 401) {
      // Skip refresh token attempt if already in progress
      if (originalRequest.url.includes('/auth/refresh') || originalRequest._hasRefreshed) {
        throw new Error('Token refresh failed');
      }
      
      // Flag to prevent infinite refresh loop
      originalRequest._hasRefreshed = true;
      
      try {
        // Attempt to refresh token
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        // Call refresh token endpoint
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          withCredentials: true // Send cookies
        });
        
        // Update tokens
        const { token } = response.data;
        localStorage.setItem('authToken', token);
        
        // Update authorization header and retry
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // If refresh fails, clean up tokens and redirect to login
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        
        // Don't redirect for background API calls
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        
        throw refreshError; // Re-throw to properly handle the error
      }
    }
    
    // Create a standardized error object
    const errorResponse = {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    };
    
    return Promise.reject(errorResponse);
  }
);

// Authentication utilities
// Check if user is authenticated
const isAuthenticated = () => {
  const token = localStorage.getItem('authToken');
  if (!token) return false;
  
  // Optional: Check if token is expired
  try {
    // Get payload from JWT (token structure: header.payload.signature)
    const payload = token.split('.')[1];
    if (!payload) return false;
    
    const decodedData = JSON.parse(atob(payload));
    const expirationTime = decodedData.exp * 1000; // Convert to milliseconds
    
    return expirationTime > Date.now();
  } catch (error) {
    console.error('Error checking token validity:', error);
    return false;
  }
};

// Get current user ID from token
const getCurrentUserId = () => {
  const token = localStorage.getItem('authToken');
  if (!token) return null;
  
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    
    const decodedData = JSON.parse(atob(payload));
    return decodedData.id;
  } catch (error) {
    console.error('Error extracting user ID from token:', error);
    return null;
  }
};

// Logout helper
const logout = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  
  // If you're using cookies for refresh tokens, you would also clear them here
  // via the logout API endpoint
  return apiClient.post('/auth/logout').catch(error => {
    console.warn('Error during logout API call:', error);
    // Continue with client-side logout even if server logout fails
  });
};

// Login helper
const login = async (credentials) => {
  const data = await apiClient.post('/auth/login', credentials);
  if (data.token) {
    localStorage.setItem('authToken', data.token);
  }
  if (data.refreshToken) {
    localStorage.setItem('refreshToken', data.refreshToken);
  }
  return data;
};

// Enhanced Task API with better request management and queuing
class TaskAPI {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.requestQueue = [];
    this.processing = false;
    this.activeRequests = 0;
    this.MAX_CONCURRENT = 6; // Maximum concurrent requests
    
    // Rate limiting parameters
    this.rateLimitPerSecond = 10;
    this.requestTimestamps = [];
    
    // Cache config with adaptive expiration
    this.cacheConfig = {
      defaultExpiry: 30000, // 30 seconds
      longExpiry: 5 * 60 * 1000, // 5 minutes for static resources
      shortExpiry: 10000 // 10 seconds for frequently changing data
    };
  }
  
  // Check if we should apply rate limiting
  shouldRateLimit() {
    const now = Date.now();
    
    // Remove timestamps older than 1 second
    this.requestTimestamps = this.requestTimestamps.filter(time => now - time < 1000);
    
    // Check if we've reached our limit
    return this.requestTimestamps.length >= this.rateLimitPerSecond;
  }
  
  // Track request for rate limiting
  trackRequest() {
    this.requestTimestamps.push(Date.now());
  }
  
  // Enhanced cache management with expiration policies
  getCachedData(key, fetchFn, options = {}) {
    const cached = this.cache.get(key);
    const expiryTime = options.longCache 
      ? this.cacheConfig.longExpiry 
      : (options.shortCache ? this.cacheConfig.shortExpiry : this.cacheConfig.defaultExpiry);
    
    // If we have valid cached data, use it
    if (cached && Date.now() - cached.timestamp < expiryTime) {
      return Promise.resolve(cached.data);
    }
    
    // If there's already a pending request for this data
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }
    
    // Make a new request and cache the promise
    const request = this.enqueueRequest(() => fetchFn())
      .then(data => {
        this.cache.set(key, {
          data,
          timestamp: Date.now()
        });
        this.pendingRequests.delete(key);
        return data;
      })
      .catch(error => {
        this.pendingRequests.delete(key);
        throw error;
      });
    
    this.pendingRequests.set(key, request);
    return request;
  }
  
  // Clear cache for a specific key or entire cache
  invalidateCache(key = null) {
    if (key === null) {
      this.cache.clear();
    } else if (typeof key === 'string') {
      this.cache.delete(key);
    } else if (typeof key === 'function') {
      // Handle function-based invalidation
      for (const cacheKey of this.cache.keys()) {
        if (key(cacheKey)) {
          this.cache.delete(cacheKey);
        }
      }
    }
  }
  
  // Improved request queuing with priority support
  enqueueRequest(fn, priority = 'normal') {
    return new Promise((resolve, reject) => {
      const request = { fn, resolve, reject, priority, timestamp: Date.now() };
      
      // Insert by priority (high, normal, low)
      if (priority === 'high') {
        this.requestQueue.unshift(request);
      } else if (priority === 'low') {
        this.requestQueue.push(request);
      } else {
        // Insert normal priority requests at the front of normal/low section
        const index = this.requestQueue.findIndex(r => r.priority === 'low');
        if (index === -1) {
          this.requestQueue.push(request);
        } else {
          this.requestQueue.splice(index, 0, request);
        }
      }
      
      // Start processing the queue if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  // Process request queue with improved concurrency management
  async processQueue() {
    if (this.processing) return;
    this.processing = true;
    
    const processNext = async () => {
      // Stop if queue is empty or we've reached max concurrent requests
      if (this.requestQueue.length === 0 || this.activeRequests >= this.MAX_CONCURRENT) {
        if (this.requestQueue.length === 0 && this.activeRequests === 0) {
          this.processing = false;
        }
        return;
      }
      
      // Check rate limiting
      if (this.shouldRateLimit()) {
        // Wait a bit before trying again
        setTimeout(() => processNext(), 100);
        return;
      }
      
      // Dequeue request
      const request = this.requestQueue.shift();
      this.activeRequests++;
      this.trackRequest();
      
      try {
        const result = await request.fn();
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      } finally {
        this.activeRequests--;
        // Process next item
        processNext();
      }
    };
    
    // Start multiple processors up to MAX_CONCURRENT
    const processors = Array(Math.min(this.MAX_CONCURRENT, this.requestQueue.length))
      .fill()
      .map(() => processNext());
    
    await Promise.allSettled(processors);
    
    // If there are still items in the queue, continue processing
    if (this.requestQueue.length > 0 && this.activeRequests < this.MAX_CONCURRENT) {
      this.processQueue();
    } else if (this.requestQueue.length === 0 && this.activeRequests === 0) {
      this.processing = false;
    }
  }
  
  // Enhanced API methods with better error handling and caching
  
  getTasks(params = {}) {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    const cacheKey = `tasks_${queryString}`;
    
    // Short expiry for task lists as they change frequently
    return this.getCachedData(cacheKey, () => 
      apiClient.get(`/tasks?${queryString}`)
    , { shortCache: true });
  }
  
  getTaskById(taskId) {
    const cacheKey = `task_${taskId}`;
    
    return this.getCachedData(cacheKey, () =>
      apiClient.get(`/tasks/${taskId}`)
    );
  }
  
  createTask(taskData) {
    // Invalidate task list cache on create
    this.invalidateCache((key) => key.startsWith('tasks_'));
    
    return this.enqueueRequest(() =>
      apiClient.post('/tasks', taskData)
    , 'high');
  }
  
  updateTask(taskId, taskData) {
    // Invalidate specific task cache and task lists
    this.invalidateCache(`task_${taskId}`);
    this.invalidateCache((key) => key.startsWith('tasks_'));
    
    return this.enqueueRequest(() =>
      apiClient.put(`/tasks/${taskId}`, taskData)
    );
  }
  
  deleteTask(taskId) {
    // Invalidate specific task cache and task lists
    this.invalidateCache(`task_${taskId}`);
    this.invalidateCache((key) => key.startsWith('tasks_'));
    
    return this.enqueueRequest(() =>
      apiClient.delete(`/tasks/${taskId}`)
    );
  }
  
  toggleTaskStatus(taskId) {
    // Invalidate specific task cache and task lists
    this.invalidateCache(`task_${taskId}`);
    this.invalidateCache((key) => key.startsWith('tasks_'));
    
    return this.enqueueRequest(() =>
      apiClient.patch(`/tasks/${taskId}/toggle`)
    );
  }
  
  // Bulk operations with optimized handling
  bulkUpdateTasks(taskIds, updateData) {
    // Invalidate all affected task caches and task lists
    taskIds.forEach(id => {
      this.invalidateCache(`task_${id}`);
    });
    this.invalidateCache((key) => key.startsWith('tasks_'));
    
    return this.enqueueRequest(() =>
      apiClient.put('/tasks/bulk-update', { taskIds, updateData })
    , 'high');
  }
  
  bulkDeleteTasks(taskIds) {
    // Invalidate all affected task caches and task lists
    taskIds.forEach(id => {
      this.invalidateCache(`task_${id}`);
    });
    this.invalidateCache((key) => key.startsWith('tasks_'));
    
    return this.enqueueRequest(() =>
      apiClient.delete('/tasks/bulk-delete', { data: { taskIds } })
    , 'high');
  }
  
  // Search tasks with debounced caching
  searchTasks(searchTerm, filters = {}) {
    const queryParams = new URLSearchParams();
    queryParams.append('search', searchTerm);
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    const cacheKey = `search_${queryString}`;
    
    // Very short expiry for search results
    return this.getCachedData(cacheKey, () => 
      apiClient.get(`/tasks/search?${queryString}`)
    , { shortCache: true });
  }
  
  // Get task statistics with longer cache
  getTaskStats() {
    return this.getCachedData('task_stats', () =>
      apiClient.get('/tasks/stats')
    , { longCache: true });
  }
}

// Authentication API with token management
class AuthAPI {
  login(credentials) {
    return login(credentials);
  }
  
  register(userData) {
    return apiClient.post('/auth/register', userData);
  }
  
  logout() {
    return logout();
  }
  
  forgotPassword(email) {
    return apiClient.post('/auth/forgot-password', { email });
  }
  
  validateResetToken(token) {
    return apiClient.get(`/auth/reset-password/${token}`);
  }
  
  resetPassword(token, newPassword) {
    return apiClient.post('/auth/reset-password', { token, newPassword });
  }
  
  refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      return Promise.reject(new Error('No refresh token available'));
    }
    
    return apiClient.post('/auth/refresh', { refreshToken })
      .then(data => {
        if (data.token) {
          localStorage.setItem('authToken', data.token);
        }
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        return data;
      });
  }
  
  // Check if the user is authenticated
  isAuthenticated() {
    return isAuthenticated();
  }
  
  // Get current user ID
  getCurrentUserId() {
    return getCurrentUserId();
  }
}

// User API for profile management
class UserAPI {
  getProfile() {
    return this.getCachedData('user_profile', () =>
      apiClient.get('/user/profile')
    );
  }
  
  updateProfile(userData) {
    this.invalidateCache('user_profile');
    
    return apiClient.put('/user/profile', userData);
  }
  
  changePassword(passwordData) {
    return apiClient.put('/user/password', passwordData);
  }
  
  // Inherit caching methods from TaskAPI
  getCachedData(key, fetchFn, options = {}) {
    return taskApi.getCachedData(key, fetchFn, options);
  }
  
  invalidateCache(key = null) {
    return taskApi.invalidateCache(key);
  }
}

// Create instances of the API classes
const taskApi = new TaskAPI();
const authApi = new AuthAPI();
const userApi = new UserAPI();

// Create a consolidated API object that includes utility functions
const api = {
  tasks: taskApi,
  auth: authApi,
  user: userApi,
  // Add utility functions at the top level for convenience
  isAuthenticated,
  getCurrentUserId,
  login,
  logout
};

// Export the API instances and client
export {
  apiClient,
  taskApi,
  authApi,
  userApi,
  isAuthenticated,
  getCurrentUserId
};

// Default export for convenience
export default api;