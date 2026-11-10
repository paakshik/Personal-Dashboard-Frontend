import axios from 'axios';

const PRODUCTION_API_URL = 'https://personal-dashboard-backend-1.onrender.com';
const configuredApiUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const configuredIsLoopback = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredApiUrl);
export const API_BASE_URL = import.meta.env.PROD
  ? (configuredApiUrl && !configuredIsLoopback ? configuredApiUrl : PRODUCTION_API_URL)
  : (configuredApiUrl || 'http://127.0.0.1:8000');
const api = axios.create({baseURL: API_BASE_URL});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function getWebSocketUrl(path, token, baseUrl = API_BASE_URL) {
    const url = new URL(path, baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('token', token);
    return url.toString();
}

export default api;
