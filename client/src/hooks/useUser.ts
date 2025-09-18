import { useState, useEffect } from 'react';
import { api } from '../api';
import type { User } from '../types';

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await api.getMe();
        setUser(response.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch user');
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  const claimAdmin = async (password: string) => {
    try {
      const response = await api.claimAdmin(password);
      setUser(response.user);
      return response.user;
    } catch (err) {
      throw err;
    }
  };

  return { user, loading, error, claimAdmin };
}
