import {beforeEach, describe, expect, it} from 'vitest';
import api, {getWebSocketUrl} from '../api.jsx';

beforeEach(() => { localStorage.clear(); });

describe('API helpers', () => {
  it('adds bearer tokens on requests', async () => {
    localStorage.setItem('token', 'jwt-test');
    const request = api.interceptors.request.handlers[0].fulfilled;
    expect(request({ headers: {} }).headers.Authorization).toBe('Bearer jwt-test');
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
