import { create } from 'zustand';
import { authApi } from '../config/api';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
  locale: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const { accessToken, refreshToken, user } = await authApi.login({ email, password });
    authApi.setTokens(accessToken, refreshToken);
    set({ user, isAuthenticated: true });
  },

  register: async (fullName, email, password) => {
    const { accessToken, refreshToken, user } = await authApi.register({ fullName, email, password });
    authApi.setTokens(accessToken, refreshToken);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    try { await authApi.logout(); } catch {}
    authApi.clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      if (!authApi.getToken()) {
        set({ isLoading: false });
        return;
      }
      const user = await authApi.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      authApi.clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateUser: async (data) => {
    const user = await authApi.updateMe(data);
    set({ user });
  },
}));
