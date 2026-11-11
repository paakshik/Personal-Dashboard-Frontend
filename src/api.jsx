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
 * List the authenticated user's saved conversations.
 * GET /dashboard/gemini/conversations
 * Returns an array of {id, title, preview, message_count, created_at, updated_at}.
 */
export async function fetchConversations() {
    const res = await api.get('/dashboard/gemini/conversations');
    return res.data;
}

/**
 * Fetch the full message history for a single conversation.
 * GET /dashboard/gemini/conversations/{id}
 * Returns an array of {id, role, text, timestamp, attachment_id?}.
 */
export async function fetchConversationMessages(id) {
    const res = await api.get(`/dashboard/gemini/conversations/${encodeURIComponent(id)}`);
    return res.data;
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

/**
 * Initiate Todoist OAuth by asking the backend for an authorization URL, then
 * navigate the browser to Todoist's authorization page.
 * The backend holds the client secret and issues the OAuth redirect; the frontend
 * never sees any client secret or access token.
 */
export async function connectTodoist() {
    try {
        const res = await api.post('/dashboard/todoist/auth/start');
        const authorizationUrl = res.data?.authorization_url;
        let parsedUrl;
        try {
            parsedUrl = new URL(authorizationUrl);
        } catch {
            throw new Error('The server returned an invalid Todoist authorization URL. Please contact support.');
        }
        if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'app.todoist.com') {
            throw new Error('The server returned an unexpected Todoist authorization URL. Please contact support.');
        }
        window.location.assign(parsedUrl.toString());
    } catch (error) {
        if (error.response) {
            const detail = error.response.data?.error || error.response.data?.detail;
            if (error.response.status === 401) {
                const authError = new Error('Your dashboard session has expired. Sign in again, then reconnect Todoist.');
                authError.statusCode = 401;
                throw authError;
            }
            if (error.response.status === 503) {
                throw new Error(detail || 'Todoist authorization is not configured on the server. Contact the dashboard administrator.');
            }
            throw new Error(detail || `Could not start Todoist authorization (HTTP ${error.response.status}). Please try again.`);
        }
        throw error;
    }
}

/**
 * Get the current user's Todoist connection status.
 * Resolves to { connected: boolean }.
 */
export async function getTodoistConnectionStatus() {
    const res = await api.get('/dashboard/todoist/auth/connection-status');
    return res.data;
}

/**
 * Disconnect the current user's Todoist account (deletes the stored credential).
 * No token/secret value is handled by the frontend.
 */
export async function disconnectTodoist() {
    await api.post('/dashboard/todoist/disconnect');
}

/**
 * Request a one-shot AI daily briefing for the authenticated user.
 * Returns { briefing: string, timestamp: string }.
 */
export async function fetchBriefing() {
    const res = await api.post('/dashboard/gemini/briefing');
    return res.data;
}

export default api;
