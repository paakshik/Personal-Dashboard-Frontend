import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import Navbar from '../components/Navbar';

const mockGet = vi.hoisted(() => vi.fn());
vi.mock('../api.jsx', () => ({
    default: {get: mockGet, post: vi.fn()},
    getWebSocketUrl: vi.fn(),
}));

beforeEach(() => {
    localStorage.clear();
    mockGet.mockReset();
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
        mockGet.mockResolvedValue({data: {is_owner: false}});
        renderNavbar();
        // Navbar currently does not fetch /dashboard/owner-access (Frontend dependency),
        // so Server Information is not rendered either way. This test guards the
        // not-owner rendering once the owner-gated item is implemented.
        expect(screen.queryByText('Server Information')).not.toBeInTheDocument();
    });

    it('shows "Server Information" when the owner', async () => {
        mockGet.mockResolvedValue({data: {is_owner: true}});
        renderNavbar();
        await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/dashboard/owner-access'));
        expect(screen.getByText('Server Information')).toBeInTheDocument();
    });
});
