import { defineStore } from 'pinia';
import { api } from '../api/client';

interface User { id: number; email: string; name: string; role: string; }

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null') as User | null,
    token: localStorage.getItem('token') as string | null,
  }),
  getters: { isAuthenticated: (s) => !!s.token },
  actions: {
    async login(email: string, password: string) {
      const { token, user } = await api.post('/auth/login', { email, password });
      this.setSession(token, user);
    },
    async register(payload: { email: string; password: string; name: string; role: string }) {
      const { token, user } = await api.post('/auth/register', payload);
      this.setSession(token, user);
    },
    setSession(token: string, user: User) {
      this.token = token; this.user = user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    logout() {
      this.token = null; this.user = null;
      localStorage.removeItem('token'); localStorage.removeItem('user');
    },
  },
});
