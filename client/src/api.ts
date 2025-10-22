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
    try {
      // Build URL and also pass initData via query as a fallback (some proxies can drop headers)
      const url = new URL(`${API_BASE}${path}`, window.location.origin);
      if (WebApp.initData) {
        url.searchParams.set('initData', WebApp.initData);
      }

      console.log('Making API request to:', url.toString());
      console.log('API_BASE:', API_BASE);
      console.log('WebApp.initData available:', !!WebApp.initData);
      
      const response = await fetch(url.toString(), {
        ...options,
        mode: 'cors',
        // We don't rely on cookies/session; avoid credentialed CORS for wider browser/WebView support
        credentials: 'omit',
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        const error = await response.text();
        console.error('API error:', response.status, error);
        throw new Error(`API Error: ${response.status} ${error}`);
      }

      const data = await response.json();
      console.log('API response data:', data);
      return data;
    } catch (error) {
      console.error('Failed to fetch:', error);
      
      // More specific error handling
      const verbose = (typeof window !== 'undefined' && localStorage.getItem('DEBUG_API') === '1') || (import.meta.env.VITE_DEBUG === '1');
      if (error instanceof Error) {
        if (verbose) {
          // Bubble up original error for debugging
          throw error;
        }
        if (error.message.includes('CORS')) {
          throw new Error('CORS error - check API configuration');
        }
        if (error.message.includes('401')) {
          throw new Error('Authentication required - open in Telegram');
        }
        if (error.message.includes('500')) {
          throw new Error('Server error - try again later');
        }
      }
      
      // Default masked error (can be unmasked with DEBUG_API=1)
      throw new Error('Network error. Please check your connection.');
    }
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
    const result = await this.get<{ matches: any[] }>('/api/matches');
    
    // Debug: показываем все live матчи
    const liveMatches = result.matches.filter((m: any) => 
      ['IN_PLAY', 'LIVE', 'PAUSED', 'TIMED'].includes(m.status) ||
      (new Date(m.kickoffAt) <= new Date() && !['FINISHED', 'CANCELLED', 'POSTPONED'].includes(m.status))
    );
    
    if (liveMatches.length > 0) {
      console.log('🟢 LIVE MATCHES FROM API:', liveMatches.map((m: any) => ({
        teams: `${m.homeTeam} vs ${m.awayTeam}`,
        status: m.status,
        scoreHome: m.scoreHome,
        scoreAway: m.scoreAway,
        kickoffAt: m.kickoffAt
      })));
    } else {
      console.log('⚪ No LIVE matches found in API response');
    }
    
    return result;
  }

  async getMatchPredictions(matchId: string) {
    return this.get<{ match: any; predictions: Array<{ userId: string; name: string; tg_user_id?: string; predHome: number; predAway: number; points: number; createdAt: string }> }>(`/api/matches/${matchId}/predictions`);
  }

  // Predictions
  async createPrediction(matchId: string, predHome: number, predAway: number) {
    return this.post<{ prediction: any }>('/api/predictions', {
      matchId,
      predHome,
      predAway,
    });
  }

  async getPredictionHistory(userId: string, matchId: string) {
    return this.get<any>(`/api/predictions/${userId}/${matchId}/history`);
  }

  // Leaderboard
  async getLeaderboard() {
    return this.get<{ leaderboard: any[] }>('/api/leaderboard');
  }

  async getLeaderboardByRounds() {
    return this.get<{ rounds: any[] }>('/api/leaderboard/by-rounds');
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

  async deleteUser(userId: string) {
    return this.request<{ success: boolean; deletedUser: string }>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Admin tournament picks & teams
  async getTeams() {
    return this.get<{ teams: string[] }>(`/api/admin/teams`);
  }

  async getUserPicks(userId: string) {
    return this.get<{ userId: string; championPick: string | null; topScorerPick: string | null }>(`/api/admin/users/${userId}/picks`);
  }

  async setUserPicks(userId: string, championPick?: string | null, topScorerPick?: string | null) {
    return this.post<{ user: any }>(`/api/admin/users/${userId}/picks`, {
      championPick,
      topScorerPick
    });
  }

  async awardBonuses(champion?: string, topScorer?: string, championPoints?: number, topScorerPoints?: number) {
    return this.post<{ updated: number }>(`/api/admin/award-bonuses`, {
      champion,
      topScorer,
      championPoints,
      topScorerPoints
    });
  }

  // Cache management
  async refreshCache() {
    return this.post<{ matches: number; leaderboard: number }>('/api/admin/refresh-cache', {});
  }

  async getCacheStats() {
    return this.get<{ stats: any }>('/api/admin/cache-stats');
  }

  // Admin match score editing
  async updateMatchScore(matchId: string, scoreHome: number, scoreAway: number, status?: string) {
    return this.patch<{ match: any }>(`/api/admin/matches/${matchId}`, {
      scoreHome,
      scoreAway,
      status,
    });
  }

  async recalcMatch(matchId: string) {
    return this.post<{ updated: number }>(`/api/admin/recalc/${matchId}`, {});
  }
}

export const api = new ApiClient();
