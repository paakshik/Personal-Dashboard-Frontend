import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import HomeView from '../views/HomeView.jsx';

const mockFetch = vi.hoisted(() => vi.fn());
global.fetch = mockFetch;

vi.mock('../api.jsx', () => ({
    getWebSocketTicketUrl: vi.fn().mockResolvedValue('ws://localhost:8000/dashboard/gemini/stream?ticket=test-ticket-123'),
    API_BASE_URL: 'http://localhost:8000',
}));

class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;

    constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.OPEN;
        MockWebSocket.instance = this;
    }

    close() {
        this.readyState = MockWebSocket.CLOSED;
    }

    send(data) {
        this.sent = data;
    }
}

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'test-token');
    globalThis.WebSocket = MockWebSocket;
    MockWebSocket.instance = null;
});

afterEach(() => {
    MockWebSocket.instance = null;
});

describe('HomeView', () => {
    it('renders the greeting header and stat cards with no data', () => {
        render(<HomeView/>);
        expect(screen.getByText(/there!/)).toBeInTheDocument();
        expect(screen.getByText("Today's Tasks")).toBeInTheDocument();
        expect(screen.getByText('Upcoming Events')).toBeInTheDocument();
        expect(screen.getByText('Unread Emails')).toBeInTheDocument();
        expect(screen.getByText('Active Projects')).toBeInTheDocument();
        // Both the header Refresh button and Quick Actions Refresh button render
        expect(screen.getAllByRole('button', {name: 'Refresh'})).toHaveLength(2);
        expect(screen.getByRole('button', {name: 'Add Task'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Open AI Assistant'})).toBeInTheDocument();
    });

    it('renders data passed through events, tasks, emails and projects props', () => {
        const events = [{date: '2026-11-10', events: [{title: 'Team Meeting', time: '10:00'}]}];
        const tasks = [{id: '1', content: 'Write tests', priority: 3}];
        const emails = [{id: '1', subject: 'Hello', sender: 'a@example.com', labels: ['UNREAD']}];
        const projects = [{id: '1', name: 'Dashboard Redesign', progress: 50}];

        render(<HomeView events={events} tasks={tasks} emails={emails} projects={projects}/>);

        expect(screen.getByText('Team Meeting')).toBeInTheDocument();
        expect(screen.getByText('Write tests')).toBeInTheDocument();
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Dashboard Redesign')).toBeInTheDocument();
    });

    it('shows empty states when there is no data', () => {
        render(<HomeView/>);
        expect(screen.getByText('No events scheduled for today.')).toBeInTheDocument();
        expect(screen.getByText('No tasks found.')).toBeInTheDocument();
        expect(screen.getByText('No unread emails.')).toBeInTheDocument();
        expect(screen.getByText('No projects found.')).toBeInTheDocument();
    });

    it('shows the AI unavailable surface when the assistant errors', async () => {
        render(<HomeView/>);
        await waitFor(() => expect(MockWebSocket.instance).toBeTruthy());

        // Simulate the backend/AI assistant being unreachable
        MockWebSocket.instance.onerror();

        // BriefingCard renders its unavailable surface (error message text not rendered by component)
        await waitFor(() =>
            expect(screen.getByText('AI briefing unavailable')).toBeInTheDocument()
        );
        expect(
            screen.getByText('The AI assistant could not be reached. Try again later or open the AI Assistant from Quick Actions.')
        ).toBeInTheDocument();
    });

    it('shows an unavailable message when the socket closes before the briefing starts', async () => {
        render(<HomeView/>);
        await waitFor(() => expect(MockWebSocket.instance).toBeTruthy());

        // Simulate the connection closing without any briefing data
        MockWebSocket.instance.onclose();

        await waitFor(() =>
            expect(screen.getByText('AI briefing unavailable')).toBeInTheDocument()
        );
    });
});
