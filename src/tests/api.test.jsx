import {beforeEach, describe, expect, it, vi} from 'vitest';
import api, {connectTodoist, getWebSocketUrl} from '../api.jsx';

beforeEach(() => { localStorage.clear(); });

describe('API helpers', () => {
  it('adds bearer tokens on requests', async () => {
    localStorage.setItem('token', 'jwt-test');
    const request = api.interceptors.request.handlers[0].fulfilled;
    expect(request({ headers: {} }).headers.Authorization).toBe('Bearer jwt-test');
  });

    it('starts Todoist OAuth with Axios authentication and validates the navigation URL', async () => {
        const authorizationUrl = 'https://app.todoist.com/oauth/authorize?state=state-value';
        const post = api.post;
        const originalLocation = window.location;
        const assign = vi.fn();
        vi.stubGlobal('location', {
            assign,
            href: originalLocation.href,
            pathname: originalLocation.pathname,
            search: originalLocation.search,
            hash: originalLocation.hash
        });
        api.post = async (path) => {
            const config = api.interceptors.request.handlers[0].fulfilled({headers: {}, url: path});
            expect(config.headers.Authorization).toBe('Bearer jwt-test');
            return {data: {authorization_url: authorizationUrl, expires_in_seconds: 600}};
        };
        try {
            localStorage.setItem('token', 'jwt-test');
            await connectTodoist();
            expect(assign).toHaveBeenCalledWith(authorizationUrl);
            expect(assign.mock.calls[0][0]).not.toContain('jwt-test');
        } finally {
            api.post = post;
            vi.unstubAllGlobals();
        }
    });

    it('rejects malformed or untrusted Todoist authorization URLs', async () => {
        const post = api.post;
        api.post = async () => ({data: {authorization_url: 'https://attacker.example/steal'}});
        await expect(connectTodoist()).rejects.toThrow(/unexpected Todoist authorization URL/i);
        api.post = async () => ({data: {authorization_url: 'not-a-url'}});
        await expect(connectTodoist()).rejects.toThrow(/invalid Todoist authorization URL/i);
        api.post = post;
    });

    it('converts backend 401 and 503 responses into actionable errors', async () => {
        const post = api.post;
        api.post = async () => {
            throw {response: {status: 401, data: {error: 'Not authenticated'}}};
        };
        await expect(connectTodoist()).rejects.toMatchObject({statusCode: 401});
        await expect(connectTodoist()).rejects.toThrow(/session has expired/i);
        api.post = async () => {
            throw {response: {status: 503, data: {error: 'Todoist OAuth not configured'}}};
        };
        await expect(connectTodoist()).rejects.toThrow(/not configured/i);
        api.post = post;
    });

  it('creates an authenticated secure websocket URL', () => {
    const url = getWebSocketUrl('/dashboard/gemini/stream', 'jwt with space', 'https://api.example.test');
    expect(url).toMatch(/^wss:\/\//);
    expect(url).toContain('/dashboard/gemini/stream?token=jwt+with+space');
  });
});

describe('getWebSocketUrl security', () => {
    it('upgrades https to wss and appends the token as a query param', () => {
        const url = getWebSocketUrl('/dashboard/system/vitals/stream', 'secret-token', 'https://example.com');
        expect(url).toBe('wss://example.com/dashboard/system/vitals/stream?token=secret-token');
    });

    it('uses ws for an http base URL', () => {
        const url = getWebSocketUrl('/dashboard/system/vitals/stream', 'secret-token', 'http://localhost:8000');
        expect(url).toMatch(/^ws:\/\//);
        expect(url).toContain('token=secret-token');
    });

    it('never places the token in the URL path', () => {
        const url = getWebSocketUrl('/dashboard/system/vitals/stream', 'a b c', 'https://example.com');
        expect(url).not.toMatch(/\/a b c\//);
        expect(url).toContain('token=');
    });

    it('encodes spaces and special characters in the token', () => {
        const url = getWebSocketUrl('/dashboard/system/vitals/stream', 'tok en!@#', 'https://example.com');
        expect(new URL(url).searchParams.get('token')).toBe('tok en!@#');
    });
});
