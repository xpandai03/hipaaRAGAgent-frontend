import axios, { AxiosInstance, AxiosError } from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  private client: AxiosInstance;
  private refreshing = false;
  private refreshQueue: Array<(token: string) => void> = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.client.interceptors.request.use(
      (config) => {
        const token = Cookies.get('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.refreshing) {
            return new Promise((resolve) => {
              this.refreshQueue.push((token: string) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(this.client(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.refreshing = true;

          try {
            const refreshToken = Cookies.get('refresh_token');
            if (!refreshToken) {
              this.logout();
              return Promise.reject(error);
            }

            const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
              refresh_token: refreshToken,
            });

            const { access_token } = response.data;
            Cookies.set('access_token', access_token, { expires: 1 });
            
            this.refreshQueue.forEach((callback) => callback(access_token));
            this.refreshQueue = [];
            
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            this.logout();
            return Promise.reject(refreshError);
          } finally {
            this.refreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private logout() {
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    window.location.href = '/login';
  }

  async register(data: {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
  }) {
    const response = await this.client.post('/api/auth/register', data);
    const { access_token, refresh_token } = response.data;
    
    Cookies.set('access_token', access_token, { expires: 1 });
    Cookies.set('refresh_token', refresh_token, { expires: 7 });
    
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/api/auth/login', { email, password });
    const { access_token, refresh_token } = response.data;
    
    Cookies.set('access_token', access_token, { expires: 1 });
    Cookies.set('refresh_token', refresh_token, { expires: 7 });
    
    return response.data;
  }

  async logoutUser() {
    try {
      await this.client.post('/api/auth/logout');
    } finally {
      this.logout();
    }
  }

  async getMe() {
    const response = await this.client.get('/api/auth/me');
    return response.data;
  }

  async createConversation(title?: string) {
    const response = await this.client.post('/api/conversations', { title });
    return response.data;
  }

  async getConversations() {
    const response = await this.client.get('/api/conversations');
    return response.data;
  }

  async getConversation(id: string) {
    const response = await this.client.get(`/api/conversations/${id}`);
    return response.data;
  }

  async deleteConversation(id: string) {
    await this.client.delete(`/api/conversations/${id}`);
  }

  async uploadDocument(file: File, metadata?: any) {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await this.client.post('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getDocuments() {
    const response = await this.client.get('/api/documents');
    return response.data;
  }

  async deleteDocument(id: string) {
    await this.client.delete(`/api/documents/${id}`);
  }

  streamChat(conversationId: string, message: string) {
    return new EventSource(
      `${API_BASE_URL}/api/chat/stream?conversation_id=${conversationId}&message=${encodeURIComponent(message)}`,
      {
        withCredentials: true,
      }
    );
  }
}

export const apiClient = new ApiClient();