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
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [connectError, setConnectError] = useState(null);
    const [callbackStatus] = useState(() => new URLSearchParams(window.location.search).get('todoist'));

    // Read immediate feedback from the OAuth callback redirect (?todoist=connected|error).
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const todoistParam = params.get('todoist');
        if (todoistParam === 'connected' || todoistParam === 'error') {
            if (todoistParam === 'connected') {
                setStatus('connected');
                setConnectError(null);
            } else {
                setStatus('failed');
                const reason = params.get('reason');
                const messages = {
                    token_exchange: 'Todoist approved access, but the backend could not exchange the authorization code. Check Render logs and verify the deployed OAuth credentials and token endpoint.',
                    token_response: 'Todoist approved access, but the backend received an invalid token response. Check Render logs and the deployed OAuth credentials.',
                    credential_save: 'Todoist approved access, but the backend could not save the encrypted connection. Check Render database availability and encryption-key configuration.',
                };
                setConnectError(messages[reason] || 'Todoist authorization failed. Check the application configuration and callback URL, then try again.');
            }
            // Remove only the recognized status parameter; preserve unrelated query/hash state.
            params.delete('todoist');
            params.delete('reason');
            const query = params.toString();
            window.history.replaceState(
                {},
                document.title,
                `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
            );
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const fetchStatus = async () => {
            try {
                const data = await getTodoistConnectionStatus();
                if (!cancelled) {
                    if (data.connected) {
                        setStatus('connected');
                    } else if (callbackStatus === 'connected') {
                        setStatus('failed');
                        setConnectError('Todoist returned successfully, but the backend reports no saved connection. The backend may still be running older code; inspect Render callback logs and redeploy the current backend.');
                    } else {
                        setStatus(callbackStatus === 'error' ? 'failed' : 'disconnected');
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    setStatus(error.response?.status === 401 ? 'reauth' : callbackStatus === 'error' ? 'failed' : 'disconnected');
                    if (error.response?.status === 401) {
                        setConnectError('Your dashboard session has expired. Sign in again to check your Todoist connection.');
                    }
                }
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
        setDisconnecting(true);
        setConnectError(null);
        try {
            await disconnectTodoist();
            setStatus('disconnected');
        } catch (error) {
            setConnectError(error.response?.data?.error || error.message || 'Failed to disconnect Todoist. Please try again.');
        } finally {
            setDisconnecting(false);
        }
    }, []);

    const handleConnect = useCallback(async () => {
        if (connecting || disconnecting) return;
        setConnecting(true);
        setConnectError(null);
        try {
            await connectTodoist();
        } catch (error) {
            setConnectError(error.response?.data?.error || error.message || 'Failed to start Todoist authorization. Please try again.');
            setStatus(error.response?.status === 401 || error.statusCode === 401 ? 'reauth' : 'failed');
        } finally {
            setConnecting(false);
        }
    }, [connecting, disconnecting]);

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

            {connectError ? (
                <span
                    role="alert"
                    style={{
                        fontSize: '0.75rem',
                        color: '#dc2626',
                        textAlign: 'center',
                    }}
                >
                    {connectError}
                </span>
            ) : null}

            {isConnected ? (
                <button
                    onClick={handleDisconnect}
                    disabled={connecting || disconnecting}
                    style={{
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: disconnecting ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        opacity: disconnecting ? 0.6 : 1,
                    }}
                >
                    <LogOut size={16}/>
                    {disconnecting ? 'Disconnecting…' : 'Disconnect Todoist'}
                </button>
            ) : status === 'failed' || status === 'reauth' ? (
                <>
                    <button
                        onClick={handleConnect}
                        disabled={connecting}
                        style={{
                            background: '#16a34a',
                            color: '#fff',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: connecting ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            opacity: connecting ? 0.6 : 1,
                        }}
                    >
                        <Zap size={16}/>
                        {connecting ? 'Connecting…' : status === 'reauth' ? 'Reauthorize Todoist' : 'Connect Todoist'}
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
                    disabled={connecting}
                    style={{
                        background: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: connecting ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        opacity: connecting ? 0.6 : 1,
                    }}
                >
                    <Zap size={16}/>
                    {connecting ? 'Connecting…' : 'Connect Todoist'}
                </button>
            )}
        </div>
    );
}
