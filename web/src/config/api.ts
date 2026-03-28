const API_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'recipe_ai_token';
const REFRESH_KEY = 'recipe_ai_refresh';

async function api<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

  // Auto-refresh on 401
  if (response.status === 401 && localStorage.getItem(REFRESH_KEY)) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${localStorage.getItem(TOKEN_KEY)}`;
      response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

async function refreshTokens(): Promise<boolean> {
  try {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return false;
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      clearTokens();
      return false;
    }
    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// API helpers
export const authApi = {
  register: (data: { fullName: string; email: string; password: string }) =>
    api<{ accessToken: string; refreshToken: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    api<{ accessToken: string; refreshToken: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    return api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
  },
  getMe: () => api<any>('/auth/me'),
  updateMe: (data: any) => api<any>('/auth/me', { method: 'PUT', body: JSON.stringify(data) }),
  getToken,
  setTokens,
  clearTokens,
};

export const recipesApi = {
  list: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return api<{ recipes: any[]; total: number }>(`/recipes${query}`);
  },
  get: (id: string) => api<any>(`/recipes/${id}`),
  create: (data: any) => api<any>('/recipes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => api<any>(`/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/recipes/${id}`, { method: 'DELETE' }),
  search: (params: Record<string, string>) => {
    const query = '?' + new URLSearchParams(params).toString();
    return api<{ recipes: any[]; total: number }>(`/recipes/search${query}`);
  },
};

export const savedRecipesApi = {
  list: () => api<any[]>('/saved-recipes'),
  save: (data: any) => api<any>('/saved-recipes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => api<any>(`/saved-recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/saved-recipes/${id}`, { method: 'DELETE' }),
};

export const categoriesApi = {
  list: () => api<any[]>('/categories'),
  create: (data: any) => api<any>('/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => api<any>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/categories/${id}`, { method: 'DELETE' }),
};

export const aiApi = {
  generate: (data: any) => api<any>('/ai/generate', { method: 'POST', body: JSON.stringify(data) }),
  modify: (data: any) => api<any>('/ai/modify', { method: 'POST', body: JSON.stringify(data) }),
  importText: (data: { text: string }) => api<any>('/ai/import-text', { method: 'POST', body: JSON.stringify(data) }),
  importUrl: (data: { url: string }) => api<any>('/ai/import-url', { method: 'POST', body: JSON.stringify(data) }),
  importImage: (data: { imageUrl: string }) => api<any>('/ai/import-image', { method: 'POST', body: JSON.stringify(data) }),
  chat: (data: any) => api<any>('/ai/chat', { method: 'POST', body: JSON.stringify(data) }),
};

export const uploadsApi = {
  getUploadUrl: (filename: string, contentType: string) =>
    api<{ uploadUrl: string; key: string }>('/uploads/url', { method: 'POST', body: JSON.stringify({ filename, contentType }) }),
  getFileUrl: (key: string) =>
    api<{ url: string }>(`/uploads/url?key=${encodeURIComponent(key)}`),
};
