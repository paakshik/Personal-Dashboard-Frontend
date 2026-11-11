import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import HomeView from '../views/HomeView.jsx';
import {fetchBriefing} from '../api.jsx';

vi.mock('../api.jsx', () => ({
    fetchBriefing: vi.fn(),
    API_BASE_URL: 'http://localhost:8000',
}));

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
        expect(screen.getByRole('button', {name: /Tasks: 0/})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Events: 0/})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Unread: 0/})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Projects: 0/})).toBeInTheDocument();
        expect(screen.getAllByRole('button', {name: /Refresh/})).toHaveLength(1);
        expect(screen.getByRole('button', {name: 'Add task'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Open AI Assistant'})).toBeInTheDocument();
    });

    it('renders data passed through events, tasks, emails and projects props', () => {
        const events = [{date: '2026-11-10', events: [{title: 'Team Meeting', time: '10:00'}]}];
        const tasks = [{id: '1', content: 'Write tasks', priority: 3}];
        const emails = [{id: '1', subject: 'Hello', sender: 'a@example.com', labels: ['UNREAD']}];
        const projects = [{id: '1', name: 'Dashboard Redesign', progress: 50}];

        render(<HomeView events={events} tasks={tasks} emails={emails} projects={projects}/>);

        fireEvent.click(screen.getByRole('button', {name: /Events: 1/}));
        expect(screen.getByText('Team Meeting')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: /Tasks: 1/}));
        expect(screen.getByText('Write tasks')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: /Unread: 1/}));
        expect(screen.getByText('Hello')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: /Projects: 1/}));
        expect(screen.getByText('Dashboard Redesign')).toBeInTheDocument();
    });

    it('shows empty states when there is no data', () => {
        render(<HomeView/>);
        fireEvent.click(screen.getByRole('button', {name: /Events: 0/}));
        expect(screen.getByText('No events scheduled.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: /Tasks: 0/}));
        expect(screen.getByText('No tasks found.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: /Unread: 0/}));
        expect(screen.getByText('No unread emails.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: /Projects: 0/}));
        expect(screen.getByText('No projects found.')).toBeInTheDocument();
    });

    it('calls the briefing endpoint and renders the generated briefing', async () => {
        fetchBriefing.mockResolvedValue({
            briefing: 'You have a productive day ahead.',
            timestamp: '2026-11-11T00:00:00Z'
        });
        render(<HomeView/>);
        expect(fetchBriefing).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: /AI daily briefing/i}));
        await waitFor(() => expect(fetchBriefing).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByText('You have a productive day ahead.')).toBeInTheDocument());
    });

    it('shows an error and Retry when the briefing endpoint fails', async () => {
        fetchBriefing.mockRejectedValue({response: {data: {detail: 'Gemini is temporarily unavailable. Please retry in a moment.'}}});
        render(<HomeView/>);
        fireEvent.click(screen.getByRole('button', {name: /AI daily briefing/i}));
        await waitFor(() => expect(fetchBriefing).toHaveBeenCalledTimes(1));
        await waitFor(() =>
            expect(screen.getByText('Gemini is temporarily unavailable. Please retry in a moment.')).toBeInTheDocument()
        );
        expect(screen.getByRole('button', {name: /generate briefing/i})).toBeInTheDocument();
    });
});
