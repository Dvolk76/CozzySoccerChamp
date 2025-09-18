import WebApp from '@twa-dev/sdk';

const API_BASE = import.meta.env.VITE_API_BASE || '';

class ApiClient {
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (WebApp.initData) {
      headers['X-Telegram-Init-Data'] = WebApp.initData;
    }
    
    return headers;
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    // Build URL and also pass initData via query as a fallback (some proxies can drop headers)
    const url = new URL(`${API_BASE}${path}`, window.location.origin);
    if (WebApp.initData) {
      url.searchParams.set('initData', WebApp.initData);
    }

    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} ${error}`);
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async post<T>(path: string, body: any): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async patch<T>(path: string, body: any): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  // Auth
  async getMe() {
    return this.get<{ user: any }>('/api/me');
  }

  async claimAdmin(password: string) {
    return this.post<{ user: any }>('/api/admin/claim', { 
      password 
    });
  }

  // Matches
  async getMatches() {
    return this.get<{ matches: any[] }>('/api/matches');
  }

  // Predictions
  async createPrediction(matchId: string, predHome: number, predAway: number) {
    return this.post<{ prediction: any }>('/api/predictions', {
      matchId,
      predHome,
      predAway,
    });
  }

  // Leaderboard
  async getLeaderboard() {
    return this.get<{ leaderboard: any[] }>('/api/leaderboard');
  }

  // Admin
  async syncMatches(season?: number) {
    return this.post<{ count: number }>('/api/admin/sync', { 
      season: season || new Date().getFullYear() 
    });
  }

  async recalcAll() {
    return this.post<{ matches: number }>('/api/admin/recalc-all', {});
  }

  async wipeUsers(password: string) {
    return this.post<{ deletedUsers: number }>('/api/admin/wipe-users', { password });
  }

  // Admin user management
  async getUsers() {
    return this.get<{ users: any[] }>('/api/admin/users');
  }

  async getUserPredictions(userId: string) {
    return this.get<{ user: any; predictions: any[]; matches: any[] }>(`/api/admin/users/${userId}/predictions`);
  }

  async updateUserPrediction(userId: string, matchId: string, predHome: number, predAway: number) {
    return this.post<{ prediction: any }>(`/api/admin/users/${userId}/predictions`, {
      matchId,
      predHome,
      predAway,
    });
  }

  async deleteUserPrediction(userId: string, matchId: string) {
    return this.request<{ success: boolean }>(`/api/admin/users/${userId}/predictions/${matchId}`, {
      method: 'DELETE',
    });
  }

  // Cache management
  async refreshCache() {
    return this.post<{ matches: number; leaderboard: number }>('/api/admin/refresh-cache', {});
  }

  async getCacheStats() {
    return this.get<{ stats: any }>('/api/admin/cache-stats');
  }
}

export const api = new ApiClient();
