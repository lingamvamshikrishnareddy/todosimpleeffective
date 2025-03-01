import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';


// Create axios instance with defaults
const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 10000, // 10 second timeout
    headers: {
      'Content-Type': 'application/json',
    }
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

  

// Response interceptor for global error handling and retries
const MAX_RETRIES = 3;
apiClient.interceptors.response.use(
  response => response.data,
  async error => {
    const originalRequest = error.config;
    
    // Implement retry logic for network errors or server errors (5xx)
    if ((error.response && error.response.status >= 500) || error.code === 'ECONNABORTED') {
      if (!originalRequest._retry || originalRequest._retry < MAX_RETRIES) {
        originalRequest._retry = (originalRequest._retry || 0) + 1;
        
        // Exponential backoff
        const delay = Math.pow(2, originalRequest._retry) * 300;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return apiClient(originalRequest);
      }
    }
    
    // Handle 401 Unauthorized - refresh token or redirect to login
    if (error.response && error.response.status === 401) {
      try {
        // Attempt to refresh token
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          // Don't retry the refresh token request
          if (originalRequest.url === '/auth/refresh') {
            throw error;
          }
          
          // Call refresh token endpoint
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken
          });
          
          // Update tokens
          const { token } = response.data;
          localStorage.setItem('authToken', token);
          
          // Retry original request with new token
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // If refresh fails, redirect to login
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error.response ? error.response.data : error);
  }
);


// Task API endpoints with request batching and caching capabilities
class TaskAPI {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.batchTimeout = null;
    this.batchSize = 50; // Maximum batch size
    this.batchQueue = [];
    this.requestQueue = [];
    
    // Cache config
    this.cacheExpiry = 30000; // 30 seconds
  }
  
  // Get cached data or fetch new
  getCachedData(key, fetchFn) {
    const cached = this.cache.get(key);
    
    // If we have valid cached data, use it
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return Promise.resolve(cached.data);
    }
    
    // If there's already a pending request for this data
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }
    
    // Make a new request and cache the promise
    const request = fetchFn().then(data => {
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
      this.pendingRequests.delete(key);
      return data;
    }).catch(error => {
      this.pendingRequests.delete(key);
      throw error;
    });
    
    this.pendingRequests.set(key, request);
    return request;
  }
  
  // Clear cache for a specific key or entire cache
  invalidateCache(key = null) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
  
  // Add request to batch queue
  addToBatch(endpoint, data, resolve, reject) {
    this.batchQueue.push({ endpoint, data, resolve, reject });
    
    // Process batch immediately if we've reached max batch size
    if (this.batchQueue.length >= this.batchSize) {
      this.processBatch();
    } else if (!this.batchTimeout) {
      // Otherwise set a timeout to process batch soon
      this.batchTimeout = setTimeout(() => this.processBatch(), 50);
    }
  }
  
  // Process queued requests in a batch
  async processBatch() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    if (this.batchQueue.length === 0) return;
    
    const batch = this.batchQueue.splice(0, this.batchSize);
    
    try {
      // Group requests by endpoint
      const endpointGroups = {};
      batch.forEach(item => {
        if (!endpointGroups[item.endpoint]) {
          endpointGroups[item.endpoint] = [];
        }
        endpointGroups[item.endpoint].push(item);
      });
      
      // Process each endpoint group
      const promises = Object.entries(endpointGroups).map(async ([endpoint, items]) => {
        try {
          // Make a batch request to the server
          const payload = items.map(item => item.data);
          const response = await apiClient.post(`/batch${endpoint}`, { items: payload });
          
          // Distribute responses to original requesters
          response.forEach((result, index) => {
            if (result.error) {
              items[index].reject(result.error);
            } else {
              items[index].resolve(result.data);
            }
          });
        } catch (error) {
          // On batch failure, reject all requests in this group
          items.forEach(item => item.reject(error));
        }
      });
      
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Batch processing error:', error);
      // Reject all requests on catastrophic failure
      batch.forEach(item => item.reject(error));
    }
    
    // Process any new items that were added during this batch
    if (this.batchQueue.length > 0) {
      this.processBatch();
    }
  }
  
  // Queue management for throttling
  enqueueRequest(fn) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ fn, resolve, reject });
      
      // Start processing the queue if it's not already running
      if (this.requestQueue.length === 1) {
        this.processQueue();
      }
    });
  }
  
  async processQueue() {
    const MAX_CONCURRENT = 10;
    const RATE_LIMIT = 100; // Process 100 requests per second
    
    const processNext = async () => {
      if (this.requestQueue.length === 0) return;
      
      const { fn, resolve, reject } = this.requestQueue.shift();
      
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
      
      // Rate limiting with setTimeout
      setTimeout(() => {
        processNext();
      }, 1000 / RATE_LIMIT);
    };
    
    // Start multiple concurrent processors
    const processors = Array(Math.min(MAX_CONCURRENT, this.requestQueue.length))
      .fill()
      .map(() => processNext());
    
    await Promise.allSettled(processors);
  }
  
  // API methods for tasks
  getTasks(params = {}) {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    const cacheKey = `tasks_${queryString}`;
    
    return this.getCachedData(cacheKey, () => 
      this.enqueueRequest(() => apiClient.get(`/tasks?${queryString}`))
    );
  }
  
  getTaskById(id) {
    const cacheKey = `task_${id}`;
    
    return this.getCachedData(cacheKey, () => 
      this.enqueueRequest(() => apiClient.get(`/tasks/${id}`))
    );
  }
  
  createTask(taskData) {
    return this.enqueueRequest(() => 
      apiClient.post('/tasks', taskData)
    ).then(response => {
      this.invalidateCache(); // Invalidate task list cache
      return response;
    });
  }
  
  updateTask(id, taskData) {
    return this.enqueueRequest(() => 
      apiClient.put(`/tasks/${id}`, taskData)
    ).then(response => {
      this.invalidateCache(`task_${id}`);
      this.invalidateCache(); // Invalidate task lists
      return response;
    });
  }
  
  deleteTask(id) {
    return this.enqueueRequest(() => 
      apiClient.delete(`/tasks/${id}`)
    ).then(response => {
      this.invalidateCache(`task_${id}`);
      this.invalidateCache(); // Invalidate task lists
      return response;
    });
  }
  
  toggleTaskStatus(id) {
    return this.enqueueRequest(() => 
      apiClient.patch(`/tasks/${id}/toggle`)
    ).then(response => {
      this.invalidateCache(`task_${id}`);
      this.invalidateCache(); // Invalidate task lists
      return response;
    });
  }
  
  bulkDeleteTasks(ids) {
    return this.enqueueRequest(() => 
      apiClient.post('/tasks/bulk-delete', { ids })
    ).then(response => {
      this.invalidateCache(); // Invalidate all task-related caches
      return response;
    });
  }
  
  bulkUpdateTasks(tasks) {
    return this.enqueueRequest(() => 
      apiClient.post('/tasks/bulk-update', { tasks })
    ).then(response => {
      this.invalidateCache(); // Invalidate all task-related caches
      return response;
    });
  }
}

// Auth API endpoints
class AuthAPI {
    constructor() {
      this.requestInProgress = false;
      this.concurrentRequests = new Map();
    }
    
    async login(credentials) {
      try {
        const response = await apiClient.post('/auth/login', credentials);
        
        if (response.token) {
          localStorage.setItem('authToken', response.token);
        }
        
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
        
        return response;
      } catch (error) {
        console.error('Login error:', error);
        throw error;
      }
    }
    
    async register(userData) {
      try {
        console.log('Attempting to register user at:', `${apiClient.defaults.baseURL}/api/users`);
        console.log('User data:', userData);
        const response = await apiClient.post('/api/users', userData);
        console.log('Registration response:', response);
        return response;
      } catch (error) {
        console.error('Registration error:', error.response ? error.response.data : error.message);
        throw error;
      }
    }
    
    async logout() {
      try {
        // Only attempt to revoke token on server if we have a token
        const token = localStorage.getItem('authToken');
        if (token) {
          await apiClient.post('/users/logout');
        }
        
        // Clear local storage regardless of server response
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        
        return { success: true };
      } catch (error) {
        // Still clear tokens even if server request fails
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        
        console.error('Logout error:', error);
        return { success: true, error };
      }
    }
    
    async refreshToken() {
      // Prevent multiple concurrent refresh requests
      if (this.requestInProgress) {
        // Return existing promise if there's already a request in progress
        if (!this.concurrentRequests.has('refreshToken')) {
          this.concurrentRequests.set('refreshToken', new Promise((resolve, reject) => {
            const interval = setInterval(() => {
              if (!this.requestInProgress) {
                clearInterval(interval);
                const token = localStorage.getItem('authToken');
                if (token) {
                  resolve({ token });
                } else {
                  reject(new Error('Token refresh failed'));
                }
              }
            }, 100);
          }));
        }
        
        return this.concurrentRequests.get('refreshToken');
      }
      
      this.requestInProgress = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        const response = await apiClient.post('/auth/refresh', { refreshToken });
        
        if (response.token) {
          localStorage.setItem('authToken', response.token);
        }
        
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
        
        return response;
      } catch (error) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        console.error('Token refresh error:', error);
        throw error;
      } finally {
        this.requestInProgress = false;
        this.concurrentRequests.delete('refreshToken');
      }
    }
    
    isAuthenticated() {
      return localStorage.getItem('authToken') !== null;
    }
  }
  
const authAPI = new AuthAPI();
  

// User profile and settings API
class UserAPI {
  async getProfile() {
    try {
      return await apiClient.get('/users/profile');
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  }
  
  async updateProfile(profileData) {
    try {
      return await apiClient.put('/users/profile', profileData);
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }
  
  async updateSettings(settings) {
    try {
      return await apiClient.put('/users/settings', settings);
    } catch (error) {
      console.error('Update settings error:', error);
      throw error;
    }
  }
  
  async changePassword(passwordData) {
    try {
      return await apiClient.post('/users/change-password', passwordData);
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }
}

// Stats API for analytics
class StatsAPI {
  async getTaskStats(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value);
        }
      });
      
      const queryString = queryParams.toString();
      return await apiClient.get(`/stats/tasks?${queryString}`);
    } catch (error) {
      console.error('Get task stats error:', error);
      throw error;
    }
  }
}

// Create instances
const taskAPI = new TaskAPI();

const userAPI = new UserAPI();
const statsAPI = new StatsAPI();

// Combine all APIs
const api = {
  // Task management
  getTasks: params => taskAPI.getTasks(params),
  getTaskById: id => taskAPI.getTaskById(id),
  createTask: data => taskAPI.createTask(data),
  updateTask: (id, data) => taskAPI.updateTask(id, data),
  deleteTask: id => taskAPI.deleteTask(id),
  toggleTaskStatus: id => taskAPI.toggleTaskStatus(id),
  bulkDeleteTasks: ids => taskAPI.bulkDeleteTasks(ids),
  bulkUpdateTasks: tasks => taskAPI.bulkUpdateTasks(tasks),
  invalidateTaskCache: key => taskAPI.invalidateCache(key),
  
  // Authentication
  login: credentials => authAPI.login(credentials),
  register: userData => authAPI.register(userData),
  logout: () => authAPI.logout(),
  refreshToken: () => authAPI.refreshToken(),
  isAuthenticated: () => authAPI.isAuthenticated(),
  
  // User profile and settings
  getProfile: () => userAPI.getProfile(),
  updateProfile: data => userAPI.updateProfile(data),
  updateSettings: settings => userAPI.updateSettings(settings),
  changePassword: data => userAPI.changePassword(data),
  
  // Analytics and stats
  getTaskStats: params => statsAPI.getTaskStats(params),
  
  // Direct access to API instances (for advanced usage)
  instances: {
    taskAPI,
    authAPI,
    userAPI,
    statsAPI
  },
  
  // Connection management
  setBaseURL: url => {
    apiClient.defaults.baseURL = url;
  },
  setTimeout: timeout => {
    apiClient.defaults.timeout = timeout;
  },
  
  // Debug helpers
  clearAllCaches: () => {
    taskAPI.invalidateCache();
  }
};

export default api;