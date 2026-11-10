import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import Navbar from '../components/Navbar';

const mockFetch = vi.hoisted(() => vi.fn());
global.fetch = mockFetch;

vi.mock('../api.jsx', () => ({
    default: {get: vi.fn(), post: vi.fn()},
    getWebSocketUrl: vi.fn(),
    API_BASE_URL: 'http://localhost:8000',
}));

beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
});

function renderNavbar(props = {}) {
    const defaultProps = {
        activeView: 'dashboard',
        setActiveView: vi.fn(),
        refreshData: vi.fn(),
        loading: false,
        isCollapsed: false,
        setIsCollapsed: vi.fn(),
        ...props,
    };
    return render(<Navbar {...defaultProps} />);
}

describe('Navbar', () => {
    it('renders the Home nav item', () => {
        renderNavbar();
        expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    });

    it('hides "Server Information" when not the owner', async () => {
        mockFetch.mockResolvedValue({ok: true, json: async () => ({is_owner: false})});
        renderNavbar();
        await waitFor(() => expect(mockFetch).toHaveBeenCalled());
        expect(screen.queryByText('Server Information')).not.toBeInTheDocument();
    });

    it('shows "Server Information" when the owner', async () => {
        mockFetch.mockResolvedValue({ok: true, json: async () => ({is_owner: true})});
        renderNavbar();
        await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/dashboard/owner-access', expect.anything()));
        expect(screen.getByText('Server Information')).toBeInTheDocument();
    });
});
