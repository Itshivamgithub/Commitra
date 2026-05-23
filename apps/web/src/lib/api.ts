import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let inMemoryToken = '';
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

export const getAccessToken = () => inMemoryToken;
export const setAccessToken = (token: string) => {
  inMemoryToken = token;
};

// Add in-memory JWT to Authorization header for every request
api.interceptors.request.use(
  (config) => {
    if (inMemoryToken && config.headers) {
      config.headers.Authorization = `Bearer ${inMemoryToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to catch 401s and attempt transparent refresh token exchange
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Avoid processing if there's no response (network errors)
    if (!error.response) {
      return Promise.reject(error);
    }

    const isRefreshRequest = originalRequest.url?.includes('/api/auth/refresh');

    // If it's a 401, we want to try refreshing the token unless this is already a refresh request
    if (error.response.status === 401 && !originalRequest._retry && !isRefreshRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject: (err: any) => {
              reject(err);
            },
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Post to backend refresh route which reads the httpOnly cookie
        const response = await api.post('/api/auth/refresh');
        const { accessToken } = response.data.data;
        
        setAccessToken(accessToken);
        isRefreshing = false;
        
        processQueue(null, accessToken);
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);
        setAccessToken('');
        
        // Client side redirect to login page upon session expiration
        if (typeof window !== 'undefined') {
          // Avoid loop if already on login page, and don't interrupt the callback process
          const path = window.location.pathname;
          if (!path.includes('/login') && !path.includes('/callback')) {
            window.location.href = '/login?expired=true';
          }
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
