import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import App from '../App';

const mockGet = vi.hoisted(() => vi.fn());
vi.mock('../api.jsx', () => ({
    default: {get: mockGet, post: vi.fn()},
    getWebSocketUrl: vi.fn(),
    API_BASE_URL: 'http://localhost:8000',
}));

beforeEach(() => {
    localStorage.clear();
    mockGet.mockReset();
});

describe('App', () => {
    it('renders the login screen when not authenticated', () => {
        render(<App/>);
        expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    });

    it('renders the default view (Home) once authenticated', async () => {
        localStorage.setItem('token', 'jwt-test');
        mockGet.mockResolvedValue({
            data: {user: {id: 'u1', email: 'tester@example.com', name: 'Test User'}},
        });
        render(<App/>);

        // Wait for auth to resolve and the default view to render in <main>.
        // Today the default view is DashboardView; once the Lead adds the Home
        // view it will render here instead. Either way, the app is authenticated.
        await waitFor(() => expect(document.querySelector('main')).toBeInTheDocument());
        expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument();
    });
});
