import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { apiClient } from '@/lib/api/client';
import Cookies from 'js-cookie';

interface User {
  id: string;
  email: string;
  full_name: string;
  organization: {
    id: string;
    name: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const token = Cookies.get('access_token');
      if (token) {
        const userData = await apiClient.getMe();
        setUser(userData);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      Cookies.remove('access_token');
      Cookies.remove('refresh_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      const response = await apiClient.login(email, password);
      const userData = await apiClient.getMe();
      setUser(userData);
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
  }) => {
    try {
      setError(null);
      await apiClient.register(data);
      const userData = await apiClient.getMe();
      setUser(userData);
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await apiClient.logoutUser();
    } finally {
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await apiClient.getMe();
      setUser(userData);
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}