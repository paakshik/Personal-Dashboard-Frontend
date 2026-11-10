import {useCallback, useEffect, useState} from 'react';
import {LogOut, Zap} from 'lucide-react';
import {connectTodoist, disconnectTodoist, getTodoistConnectionStatus,} from '../api.jsx';

/**
 * Todoist Connect/Disconnect control.
 *
 * Handles all connection lifecycle states required by the assignment:
 * - Connect Todoist (not connected)
 * - Connected (authorized, shows Disconnect)
 * - Reauthorization required (token expired / 401)
 * - Connection failed (OAuth error)
 * - Disconnect Todoist (revoke credential)
 *
 * Security: never stores or displays any Todoist access_token/refresh_token.
 * The OAuth callback is handled entirely by the backend; the frontend only
 * reads the ?todoist=connected|error query param for immediate feedback.
 */
export default function TodoistConnect() {
    const [status, setStatus] = useState('checking'); // 'checking' | 'connected' | 'disconnected' | 'failed' | 'reauth'
    const [loading, setLoading] = useState(true);

    // Read immediate feedback from the OAuth callback redirect (?todoist=connected|error).
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const todoistParam = params.get('todoist');
        if (todoistParam === 'connected') {
            setStatus('connected');
            // Clean the query param from the URL without a page reload.
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (todoistParam === 'error') {
            setStatus('failed');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const fetchStatus = async () => {
            try {
                const data = await getTodoistConnectionStatus();
                if (!cancelled) {
                    setStatus(!!data.connected ? 'connected' : 'disconnected');
                }
            } catch {
                if (!cancelled) setStatus('disconnected');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchStatus();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleDisconnect = useCallback(async () => {
        try {
            await disconnectTodoist();
            setStatus('disconnected');
        } catch {
            setStatus('failed');
            window.alert('Failed to disconnect Todoist. Please try again.');
        }
    }, []);

    const handleConnect = useCallback(() => {
        connectTodoist();
    }, []);

    if (loading) {
        return (
            <div
                style={{
                    padding: '10px',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    textAlign: 'center',
                }}
            >
                Checking Todoist connection…
            </div>
        );
    }

    const isConnected = status === 'connected';

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '8px',
            }}
        >
            {/* Status indicator */}
            <div
                style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    width: 'fit-content',
                    background:
                        status === 'connected'
                            ? 'rgba(22, 163, 74, 0.12)'
                            : status === 'failed' || status === 'reauth'
                                ? 'rgba(220, 38, 38, 0.12)'
                                : 'rgba(100, 116, 139, 0.12)',
                    color:
                        status === 'connected'
                            ? '#15803d'
                            : status === 'failed' || status === 'reauth'
                                ? '#dc2626'
                                : '#64748b',
                    border: '1px solid',
                    borderColor:
                        status === 'connected'
                            ? 'rgba(22, 163, 74, 0.35)'
                            : status === 'failed' || status === 'reauth'
                                ? 'rgba(220, 38, 38, 0.35)'
                                : 'rgba(100, 116, 139, 0.35)',
                }}
            >
                {status === 'connected' ? 'Todoist Connected' : status === 'failed' ? 'Connection Failed' : status === 'reauth' ? 'Reauthorization Required' : 'Todoist Disconnected'}
            </div>

            {isConnected ? (
                <button
                    onClick={handleDisconnect}
                    style={{
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                    }}
                >
                    <LogOut size={16}/>
                    Disconnect Todoist
                </button>
            ) : status === 'failed' || status === 'reauth' ? (
                <>
                    <button
                        onClick={handleConnect}
                        style={{
                            background: '#16a34a',
                            color: '#fff',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                        }}
                    >
                        <Zap size={16}/>
                        {status === 'reauth' ? 'Reauthorize Todoist' : 'Connect Todoist'}
                    </button>
                    <span
                        style={{
                            fontSize: '0.75rem',
                            color: '#dc2626',
                            textAlign: 'center',
                        }}
                    >
                        {status === 'reauth'
                            ? 'Your Todoist session expired. Please reconnect.'
                            : 'Todoist connection failed. Please try again.'}
                    </span>
                </>
            ) : (
                <button
                    onClick={handleConnect}
                    style={{
                        background: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                    }}
                >
                    <Zap size={16}/>
                    Connect Todoist
                </button>
            )}
        </div>
    );
}
