import { describe, it, expect, beforeEach } from 'vitest';
import api, { getWebSocketUrl } from '../api.jsx';

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
