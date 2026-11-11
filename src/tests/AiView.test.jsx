import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import AiView from '../views/aiview.jsx';

vi.mock('../api', () => ({
    default: {get: vi.fn(), post: vi.fn(), delete: vi.fn()},
    getWebSocketTicketUrl: async () => 'ws://localhost:8000/dashboard/gemini/stream?ticket=test-ticket-123',
    API_BASE_URL: 'http://localhost:8000',
    fetchConversations: vi.fn(),
    fetchConversationMessages: vi.fn(),
}));

class MockWebSocket {
  static OPEN = 1;
    static lastCloseCode = null;
    static lastCloseReason = null;

    constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.OPEN;
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        MockWebSocket.instance = this;
    }

    close(code, reason) {
        MockWebSocket.lastCloseCode = code;
        MockWebSocket.lastCloseReason = reason ?? '';
        if (this.onclose) {
            this.onclose({code, reason: reason ?? '', wasClean: code === 1000});
        }
    }
  send(data) { this.sent = data; }
}

beforeEach(() => {
  localStorage.setItem('token', 'test-jwt');
  globalThis.WebSocket = MockWebSocket;
  Element.prototype.scrollIntoView = vi.fn();
    MockWebSocket.instance = null;
    MockWebSocket.lastCloseCode = null;
    MockWebSocket.lastCloseReason = null;
});

describe('AI chat view', () => {
    it('loads chat history and connects using a ticket-based websocket URL (no bearer token)', async () => {
    const axiosInstance = { get: vi.fn().mockResolvedValue({ data: [{ id: 'm1', role: 'user', text: 'Saved question', timestamp: new Date().toISOString() }] }), post: vi.fn(), delete: vi.fn() };
    const { container } = render(<AiView axiosInstance={axiosInstance} />);
        await waitFor(() => expect(MockWebSocket.instance).toBeDefined());
        expect(await within(container.querySelector('.nx-main')).findByText('Saved question')).toBeTruthy();
        expect(MockWebSocket.instance.url).toContain('/dashboard/gemini/stream?ticket=test-ticket-123');
        expect(MockWebSocket.instance.url).not.toContain('token=');
  });

  it('sends entered text through websocket and renders streamed chunks', async () => {
    const axiosInstance = { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn(), delete: vi.fn() };
    render(<AiView axiosInstance={axiosInstance} />);
      await waitFor(() => expect(MockWebSocket.instance).toBeDefined());
    MockWebSocket.instance.onopen();
      fireEvent.change(screen.getByRole('textbox', {name: 'Message Nexus AI'}), {target: {value: 'Hello AI'}});
      fireEvent.click(screen.getByRole('button', {name: 'Send message'}));
    await waitFor(() => expect(JSON.parse(MockWebSocket.instance.sent).prompt).toBe('Hello AI'));
    MockWebSocket.instance.onmessage({ data: JSON.stringify({ type: 'start' }) });
    MockWebSocket.instance.onmessage({ data: JSON.stringify({ type: 'chunk', text: 'Hello' }) });
    expect(await screen.findByText('Hello')).toBeTruthy();
    MockWebSocket.instance.onmessage({ data: JSON.stringify({ type: 'done' }) });
  });

    it('shows an approval card and sends the chosen approval to the backend', async () => {
        const axiosInstance = {get: vi.fn().mockResolvedValue({data: []}), post: vi.fn(), delete: vi.fn()};
        render(<AiView axiosInstance={axiosInstance}/>);
        await waitFor(() => expect(MockWebSocket.instance).toBeDefined());
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
      await waitFor(() => expect(MockWebSocket.instance).toBeDefined());
      MockWebSocket.instance.onopen();
    MockWebSocket.instance.onmessage({ data: JSON.stringify({ type: 'error', message: 'Gemini API quota or rate limit reached.' }) });
    expect(await screen.findByText('Gemini API quota or rate limit reached.')).toBeTruthy();
  });

    it('renders without ReferenceError', async () => {
        const axiosInstance = {get: vi.fn().mockResolvedValue({data: []}), post: vi.fn(), delete: vi.fn()};
        render(<AiView axiosInstance={axiosInstance}/>);
        await waitFor(() => expect(MockWebSocket.instance).toBeDefined());
    });

    it('ordinary rerender preserves active socket', async () => {
        const axiosInstance = {get: vi.fn().mockResolvedValue({data: []}), post: vi.fn(), delete: vi.fn()};
        const {rerender} = render(<AiView axiosInstance={axiosInstance}/>);
        await waitFor(() => expect(MockWebSocket.instance).toBeDefined());
        const firstInstance = MockWebSocket.instance;
        MockWebSocket.instance.onopen();
        rerender(<AiView axiosInstance={axiosInstance}/>);
        expect(MockWebSocket.instance).toBe(firstInstance);
    });

    it('unexpected close schedules one reconnect with backoff', async () => {
        const axiosInstance = {get: vi.fn().mockResolvedValue({data: []}), post: vi.fn(), delete: vi.fn()};
        render(<AiView axiosInstance={axiosInstance}/>);
        await waitFor(() => expect(MockWebSocket.instance).toBeDefined());
        MockWebSocket.instance.onopen();

        const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
        setTimeoutSpy.mockClear();

        act(() => {
            MockWebSocket.instance.onclose({code: 1006, reason: '', wasClean: false});
        });

        expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    });

    it('unmount cancels pending reconnect', async () => {
        const axiosInstance = {get: vi.fn().mockResolvedValue({data: []}), post: vi.fn(), delete: vi.fn()};
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
        const {unmount} = render(<AiView axiosInstance={axiosInstance}/>);
        await waitFor(() => expect(MockWebSocket.instance).toBeDefined());
        MockWebSocket.instance.onopen();
        act(() => {
            MockWebSocket.instance.onclose({code: 1006, reason: '', wasClean: false});
        });
        unmount();
        expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('successful connection resets reconnect attempts', async () => {
        const axiosInstance = {get: vi.fn().mockResolvedValue({data: []}), post: vi.fn(), delete: vi.fn()};
        const {unmount} = render(<AiView axiosInstance={axiosInstance}/>);
        await waitFor(() => expect(MockWebSocket.instance).toBeDefined());
        act(() => {
            MockWebSocket.instance.onclose({code: 1006, reason: '', wasClean: false});
        });
        expect(await screen.findByText('Disconnected')).toBeTruthy();
        act(() => {
            MockWebSocket.instance.onopen();
        });
        expect(await screen.findByText('Connected')).toBeTruthy();
        unmount();
    });
});
