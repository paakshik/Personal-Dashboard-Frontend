import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import HomeView from '../views/HomeView.jsx';

vi.mock('../api.jsx', () => ({
    fetchBriefing: vi.fn(),
    API_BASE_URL: 'http://localhost:8000',
}));

const {fetchBriefing} = require('../api.jsx');

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'test-token');
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
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
        const tasks = [{id: '1', content: 'Write tasks', priority: 3}];
        const emails = [{id: '1', subject: 'Hello', sender: 'a@example.com', labels: ['UNREAD']}];
        const projects = [{id: '1', name: 'Dashboard Redesign', progress: 50}];

        render(<HomeView events={events} tasks={tasks} emails={emails} projects={projects}/>);

        expect(screen.getByText('Team Meeting')).toBeInTheDocument();
        expect(screen.getByText('Write tasks')).toBeInTheDocument();
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

    it('calls the briefing endpoint and renders the generated briefing', async () => {
        fetchBriefing.mockResolvedValue({
            briefing: 'You have a productive day ahead.',
            timestamp: '2026-11-11T00:00:00Z'
        });
        render(<HomeView/>);
        await waitFor(() => expect(fetchBriefing).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByText('You have a productive day ahead.')).toBeInTheDocument());
    });

    it('shows an error and Retry when the briefing endpoint fails', async () => {
        fetchBriefing.mockRejectedValue({response: {data: {detail: 'Gemini is temporarily unavailable. Please retry in a moment.'}}});
        render(<HomeView/>);
        await waitFor(() =>
            expect(screen.getByText('Gemini is temporarily unavailable. Please retry in a moment.')).toBeInTheDocument()
        );
        expect(screen.getByRole('button', {name: /regenerate briefing/i})).toBeInTheDocument();
    });
});
