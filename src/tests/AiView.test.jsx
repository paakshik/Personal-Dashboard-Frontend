import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import AiView from '../views/aiview.jsx';

class MockWebSocket {
  static OPEN = 1;
  constructor(url) { this.url = url; this.readyState = MockWebSocket.OPEN; MockWebSocket.instance = this; }
  close() {}
  send(data) { this.sent = data; }
}

beforeEach(() => {
  localStorage.setItem('token', 'test-jwt');
  globalThis.WebSocket = MockWebSocket;
  Element.prototype.scrollIntoView = vi.fn();
});

describe('AI chat view', () => {
  it('loads chat history and connects using the authenticated dashboard websocket URL', async () => {
    const axiosInstance = { get: vi.fn().mockResolvedValue({ data: [{ id: 'm1', role: 'user', text: 'Saved question', timestamp: new Date().toISOString() }] }), post: vi.fn(), delete: vi.fn() };
    const { container } = render(<AiView axiosInstance={axiosInstance} />);
    expect(await within(container.querySelector('main')).findByText('Saved question')).toBeTruthy();
    expect(MockWebSocket.instance.url).toContain('/dashboard/gemini/stream?token=test-jwt');
  });

  it('sends entered text through websocket and renders streamed chunks', async () => {
    const axiosInstance = { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn(), delete: vi.fn() };
    render(<AiView axiosInstance={axiosInstance} />);
    MockWebSocket.instance.onopen();
    fireEvent.change(screen.getAllByPlaceholderText('Message Nexus AI...')[0], { target: { value: 'Hello AI' } });
    fireEvent.click(screen.getByText('Send'));
    await waitFor(() => expect(JSON.parse(MockWebSocket.instance.sent).prompt).toBe('Hello AI'));
    MockWebSocket.instance.onmessage({ data: JSON.stringify({ type: 'start' }) });
    MockWebSocket.instance.onmessage({ data: JSON.stringify({ type: 'chunk', text: 'Hello' }) });
    expect(await screen.findByText('Hello')).toBeTruthy();
    MockWebSocket.instance.onmessage({ data: JSON.stringify({ type: 'done' }) });
  });

    it('shows an approval card and sends the chosen approval to the backend', async () => {
        const axiosInstance = {get: vi.fn().mockResolvedValue({data: []}), post: vi.fn(), delete: vi.fn()};
        render(<AiView axiosInstance={axiosInstance}/>);
        MockWebSocket.instance.onmessage({
            data: JSON.stringify({
                type: 'confirm',
                id: 'approval-1',
                action: 'delete_task',
                summary: 'Delete task: Write tests'
            })
        });
        expect(await screen.findByText('Delete task: Write tests')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', {name: /approve/i}));
        expect(JSON.parse(MockWebSocket.instance.sent)).toEqual({
            type: 'confirm_response',
            id: 'approval-1',
            approved: true
        });
    });

  it('shows a useful message when the backend reports a Gemini error', async () => {
    const axiosInstance = { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn(), delete: vi.fn() };
    render(<AiView axiosInstance={axiosInstance} />);
    MockWebSocket.instance.onmessage({ data: JSON.stringify({ type: 'error', message: 'Gemini API quota or rate limit reached.' }) });
    expect(await screen.findByText('Gemini API quota or rate limit reached.')).toBeTruthy();
  });
});
