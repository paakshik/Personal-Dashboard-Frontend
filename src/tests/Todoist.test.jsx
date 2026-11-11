import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import TodoistConnect from '../components/TodoistConnect';
import TasksView from '../views/TasksView';

// --- Mock api.jsx so no real network or navigation occurs ---
const mockGetTodoistConnectionStatus = vi.hoisted(() => vi.fn());
const mockConnectTodoist = vi.hoisted(() => vi.fn());
const mockDisconnectTodoist = vi.hoisted(() => vi.fn());

vi.mock('../api.jsx', () => ({
    default: {get: vi.fn(), post: vi.fn(), delete: vi.fn()},
    connectTodoist: mockConnectTodoist,
    disconnectTodoist: mockDisconnectTodoist,
    getTodoistConnectionStatus: mockGetTodoistConnectionStatus,
    API_BASE_URL: 'http://localhost:8000',
}));

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

describe('api.jsx Todoist exports', () => {
    it('exports connectTodoist, getTodoistConnectionStatus and disconnectTodoist', async () => {
        const api = await import('../api.jsx');
        expect(typeof api.connectTodoist).toBe('function');
        expect(typeof api.getTodoistConnectionStatus).toBe('function');
        expect(typeof api.disconnectTodoist).toBe('function');
    });
});

describe('TodoistConnect', () => {
    it('shows callback failure without hiding the status check result', async () => {
        const originalUrl = window.location.href;
        window.history.replaceState({}, '', '/?todoist=error&keep=1#section');
        mockGetTodoistConnectionStatus.mockResolvedValue({connected: false});
        render(<TodoistConnect/>);
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/callback URL/i));
        expect(screen.getByText('Connection Failed')).toBeInTheDocument();
        expect(window.location.search).toBe('?keep=1');
        expect(window.location.hash).toBe('#section');
        window.history.replaceState({}, '', new URL(originalUrl).pathname);
    });

    it('renders a Connect button when not connected', async () => {
        mockGetTodoistConnectionStatus.mockResolvedValue({connected: false});
        render(<TodoistConnect/>);
        await waitFor(() => expect(screen.getByText('Connect Todoist')).toBeInTheDocument());
        expect(screen.queryByText('Disconnect Todoist')).not.toBeInTheDocument();
    });

    it('renders a Disconnect button when connected', async () => {
        mockGetTodoistConnectionStatus.mockResolvedValue({connected: true});
        render(<TodoistConnect/>);
        await waitFor(() => expect(screen.getByText('Disconnect Todoist')).toBeInTheDocument());
        expect(screen.queryByText('Connect Todoist')).not.toBeInTheDocument();
    });

    it('disables Connect while OAuth initiation is pending and shows an actionable error', async () => {
        mockGetTodoistConnectionStatus.mockResolvedValue({connected: false});
        let rejectConnect;
        mockConnectTodoist.mockImplementation(() => new Promise((_, reject) => {
            rejectConnect = reject;
        }));
        render(<TodoistConnect/>);
        const button = await screen.findByRole('button', {name: 'Connect Todoist'});
        fireEvent.click(button);
        expect(await screen.findByRole('button', {name: 'Connecting…'})).toBeDisabled();
        fireEvent.click(screen.getByRole('button', {name: 'Connecting…'}));
        expect(mockConnectTodoist).toHaveBeenCalledTimes(1);
        rejectConnect(new Error('Dashboard session expired. Sign in again.'));
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/sign in again/i));
    });

    it('calls connectTodoist when the Connect button is clicked', async () => {
        mockGetTodoistConnectionStatus.mockResolvedValue({connected: false});
        render(<TodoistConnect/>);
        await waitFor(() => expect(screen.getByText('Connect Todoist')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Connect Todoist'));
        expect(mockConnectTodoist).toHaveBeenCalledTimes(1);
    });

    it('calls disconnectTodoist when the Disconnect button is clicked', async () => {
        mockGetTodoistConnectionStatus.mockResolvedValue({connected: true});
        render(<TodoistConnect/>);
        await waitFor(() => expect(screen.getByText('Disconnect Todoist')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Disconnect Todoist'));
        expect(mockDisconnectTodoist).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByText('Checking Todoist connection…')).not.toBeInTheDocument());
    });
});

describe('TasksView connection gate', () => {
    it('shows connection-gated UI when Todoist is not connected', () => {
        render(<TasksView tasks={[]} todoistConnected={false} onConnectTodoist={vi.fn()} isLoading={false}/>);
        expect(screen.getByRole('heading', {name: 'Connect your Todoist account'})).toBeInTheDocument();
        expect(screen.getByText('Checking Todoist connection…')).toBeInTheDocument();
    });

    it('does not show the connection-gated UI when Todoist is connected', () => {
        render(<TasksView todoistConnected={true} tasks={[]} onConnectTodoist={vi.fn()} isLoading={false}/>);
        expect(screen.queryByText(/Connect your Todoist account/)).not.toBeInTheDocument();
    });
});
