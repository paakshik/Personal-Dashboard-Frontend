import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import TasksView from '../views/TasksView';

vi.mock('../api.jsx', () => ({
    default: {get: vi.fn(), post: vi.fn(), delete: vi.fn()},
    connectTodoist: vi.fn(),
    disconnectTodoist: vi.fn(),
    getTodoistConnectionStatus: vi.fn(),
    API_BASE_URL: 'http://localhost:8000',
}));

describe('TasksView render long-wait', () => {
    it('renders gated UI connected=false (long wait)', () => {
        render(<TasksView todoistConnected={false} onConnectTodoist={vi.fn()}/>);
        expect(screen.getByText(/Connect your Todoist account/)).toBeInTheDocument();
    });
});
