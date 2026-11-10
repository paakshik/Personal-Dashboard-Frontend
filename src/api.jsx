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

/**
 * Build a WebSocket URL for the given path.
 *
 * NOTE: the owner-gated system vitals stream does NOT use this helper. It uses
 * getWebSocketTicketUrl(), which issues a short-lived single-use ticket so no
 * bearer token appears in the WebSocket URL. This helper remains for user-gated
 * streams (e.g. /dashboard/gemini/stream) that still authenticate via a bearer
 * token in the query string (the browser WebSocket API cannot send custom
 * headers before the handshake, and there is no ticket endpoint for gemini).
 */
export function getWebSocketUrl(path, token, baseUrl = API_BASE_URL) {
    const url = new URL(path, baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    if (token) url.searchParams.set('token', token);
    return url.toString();
}

/**
 * Build a WebSocket URL for a user-gated stream using a short-lived,
 * single-use ticket instead of a long-lived bearer token in the URL.
 *
 * Fetches a ticket from POST <ticketEndpoint> (user-gated), then returns
 * the WSS/WS URL with the ticket as a query parameter.
 *
 * @param path        WebSocket path (e.g. '/dashboard/gemini/stream')
 * @param ticketEndpoint  ticket-issuing endpoint path (e.g. '/dashboard/gemini/ws-ticket')
 * @param baseUrl     API base URL
 */
export async function getWebSocketTicketUrl(path, ticketEndpoint = '/dashboard/system/ws-ticket', baseUrl = API_BASE_URL) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${baseUrl}${ticketEndpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    if (!res.ok) {
        throw new Error(`Failed to obtain WebSocket ticket: ${res.status}`);
    }
    const data = await res.json();
    const ticket = data.ticket;
    if (!ticket) {
        throw new Error('WebSocket ticket missing from response');
    }

    const url = new URL(path, baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('ticket', ticket);
    return url.toString();
}

/**
 * Check whether the authenticated user is the dashboard owner.
 * Calls the owner-gated /dashboard/system/current endpoint; a 403 means not owner.
 */
export async function isServerOwner() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_BASE_URL}/dashboard/system/current`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        return res.ok;
    } catch {
        return false;
    }
}

export default api;
