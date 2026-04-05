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

/** Backend list/search use `{ data, pagination }`; UI expects `{ recipes, total }`. */
function normalizeRecipeListResponse(body: unknown): { recipes: any[]; total: number } {
  if (!body || typeof body !== 'object') return { recipes: [], total: 0 };
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.recipes)) {
    const total = typeof b.total === 'number' ? b.total : b.recipes.length;
    return { recipes: b.recipes as any[], total };
  }
  const data = b.data;
  const pagination = b.pagination as Record<string, unknown> | undefined;
  if (Array.isArray(data) && pagination && typeof pagination.total === 'number') {
    return { recipes: data as any[], total: pagination.total };
  }
  if (Array.isArray(data)) {
    return { recipes: data as any[], total: (data as any[]).length };
  }
  return { recipes: [], total: 0 };
}

function unwrapData<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in body && (body as { data: unknown }).data !== undefined) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function unwrapNamedArray<T>(body: unknown, key: string): T[] {
  if (!body || typeof body !== 'object') return [];
  const v = (body as Record<string, unknown>)[key];
  return Array.isArray(v) ? (v as T[]) : [];
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
  forgotPassword: (data: { email: string }) =>
    api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) }),
  resetPassword: (data: { token: string; newPassword: string }) =>
    api<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: { fullName: string; email: string; password: string }) =>
    api<{ accessToken: string; refreshToken: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    api<{ accessToken: string; refreshToken: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    return api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
  },
  getMe: async () => {
    const res = await api<{ user: any }>('/auth/me');
    return res.user;
  },
  updateMe: async (data: any) => {
    const res = await api<{ user: any }>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.user;
  },
  getToken,
  setTokens,
  clearTokens,
};

export const recipesApi = {
  list: async (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    const raw = await api<unknown>(`/recipes${query}`);
    return normalizeRecipeListResponse(raw);
  },
  get: async (id: string) => {
    const raw = await api<unknown>(`/recipes/${id}`);
    return unwrapData<any>(raw);
  },
  create: async (data: any) => {
    const raw = await api<unknown>('/recipes', { method: 'POST', body: JSON.stringify(data) });
    return unwrapData<any>(raw);
  },
  update: async (id: string, data: any) => {
    const raw = await api<unknown>(`/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return unwrapData<any>(raw);
  },
  delete: (id: string) => api(`/recipes/${id}`, { method: 'DELETE' }),
  search: async (params: Record<string, string>) => {
    const query = '?' + new URLSearchParams(params).toString();
    const raw = await api<unknown>(`/recipes/search${query}`);
    return normalizeRecipeListResponse(raw);
  },
};

export const savedRecipesApi = {
  list: async () => {
    const raw = await api<unknown>('/saved-recipes');
    return unwrapNamedArray<any>(raw, 'savedRecipes');
  },
  save: (data: any) => api<any>('/saved-recipes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => api<any>(`/saved-recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => api(`/saved-recipes/${id}`, { method: 'DELETE' }),
};

export const categoriesApi = {
  list: async () => {
    const raw = await api<unknown>('/categories');
    return unwrapNamedArray<any>(raw, 'categories');
  },
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
