import {useCallback, useEffect, useRef, useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {ArrowDown, ArrowUp, Check, Clock, Paperclip, RefreshCw, Sparkles, Trash2, X} from 'lucide-react';
import {fetchConversationMessages, fetchConversations, getWebSocketTicketUrl} from '../api';

const SUGGESTIONS = [
    'What is on my calendar this week?',
    'Which tasks should I do first today?',
    'Summarize my latest emails',
];

const STATUS_LABEL = {
    connecting: 'Connecting',
    connected: 'Connected',
    disconnected: 'Disconnected',
    reconnecting: 'Reconnecting',
    error: 'Connection failed',
};

const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
};

export default function AiView({axiosInstance, refreshData}) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [socketStatus, setSocketStatus] = useState(() => (localStorage.getItem('token') ? 'connecting' : 'error'));
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [connectKey, setConnectKey] = useState(0);
    const [wsCloseInfo, setWsCloseInfo] = useState(null); // {code, reason, wasClean}
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);

    // History panel state
    const [historyOpen, setHistoryOpen] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [conversationsLoading, setConversationsLoading] = useState(false);
    const [conversationsError, setConversationsError] = useState(null);
    const [activeConversationId, setActiveConversationId] = useState(null);

    const ws = useRef(null);
    const fileRef = useRef(null);
    const endRef = useRef(null);
    const scrollRef = useRef(null);
    const keepScrolledRef = useRef(true);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const textareaRef = useRef(null);
    const loadingRef = useRef(false);
    const axiosRef = useRef(axiosInstance);

    useEffect(() => {
        axiosRef.current = axiosInstance;
    }, [axiosInstance]);

    const setBusy = useCallback((value) => {
        loadingRef.current = value;
        setLoading(value);
    }, []);

    const pushMessage = useCallback((role, text) => {
        setMessages((previous) => [...previous, {role, text, timestamp: new Date().toISOString()}]);
    }, []);

    // Load the current conversation once.
    useEffect(() => {
        let cancelled = false;
        axiosRef.current
            .get('/dashboard/gemini/history')
            .then((response) => {
                if (!cancelled) setMessages(Array.isArray(response.data) ? response.data : []);
            })
            .catch((error) => console.error('Unable to load chat history', error));
        return () => {
            cancelled = true;
        };
    }, []);

    // Load the saved conversation list when the history panel is opened.
    useEffect(() => {
        if (!historyOpen) return;
        let cancelled = false;
        (async () => {
            setConversationsLoading(true);
            setConversationsError(null);
            try {
                const data = await fetchConversations();
                if (!cancelled) setConversations(Array.isArray(data) ? data : []);
            } catch (error) {
                if (!cancelled) {
                    setConversationsError('Could not load your conversation history.');
                    console.error('Failed to load conversations', error);
                }
            } finally {
                if (!cancelled) setConversationsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [historyOpen]);

    const selectConversation = async (conversation) => {
        setActiveConversationId(conversation.id);
        try {
            const data = await fetchConversationMessages(conversation.id);
            const restored = Array.isArray(data) ? data : [];
            keepScrolledRef.current = true;
            setShowScrollToBottom(false);
            setMessages(
                restored.map((m) => ({
                    id: m.id,
                    role: m.role,
                    text: m.text,
                    timestamp: m.timestamp,
                })),
            );
            setHistoryOpen(false);
        } catch (error) {
            setConversationsError('Could not restore that conversation. Try again.');
            console.error('Failed to restore conversation', error);
        }
    };

    // One WebSocket per connectKey. Only the Reconnect button changes connectKey.
    useEffect(() => {
        let mounted = true;

        (async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setSocketStatus('error');
                return;
            }

            try {
                const wsUrl = await getWebSocketTicketUrl(
                    '/dashboard/gemini/stream',
                    '/dashboard/gemini/ws-ticket'
                );
                if (!mounted) return;

                const socket = new WebSocket(wsUrl);
                ws.current = socket;

                socket.onopen = () => {
                    if (!mounted) return;
                    setSocketStatus('connected');
                };

                socket.onmessage = ({data}) => {
                    let event;
                    try {
                        event = JSON.parse(data);
                    } catch {
                        return;
                    }
                    if (event.type === 'start') {
                        setMessages((previous) => [
                            ...previous,
                            {role: 'assistant', text: '', timestamp: new Date().toISOString(), streaming: true},
                        ]);
                    } else if (event.type === 'chunk') {
                        setMessages((previous) => {
                            const next = [...previous];
                            const last = next[next.length - 1];
                            if (last?.role === 'assistant' && last.streaming) {
                                next[next.length - 1] = {...last, text: last.text + event.text};
                            } else {
                                next.push({
                                    role: 'assistant',
                                    text: event.text,
                                    timestamp: new Date().toISOString(),
                                    streaming: true,
                                });
                            }
                            return next;
                        });
                    } else if (event.type === 'confirm') {
                        setPendingApprovals((pending) => [...pending, event]);
                    } else if (event.type === 'data_changed') {
                        if (typeof refreshData === 'function') void refreshData();
                    } else if (event.type === 'done') {
                        setBusy(false);
                        setMessages((previous) => previous.map((message) => ({...message, streaming: false})));
                    } else if (event.type === 'error') {
                        setBusy(false);
                        setMessages((previous) => [
                            ...previous.map((message) => ({...message, streaming: false})),
                            {
                                role: 'assistant',
                                text: event.message || 'The AI response failed. Try again.',
                                timestamp: new Date().toISOString(),
                            },
                        ]);
                    }
                };

                socket.onerror = (event) => {
                    if (!mounted) return;
                    setSocketStatus('error');
                };

                socket.onclose = (event) => {
                    if (!mounted) return;
                    setWsCloseInfo({code: event.code, reason: event.reason || 'Unknown', wasClean: event.wasClean});
                    if (ws.current === socket) ws.current = null;
                    setSocketStatus((current) => (current === 'error' ? 'error' : 'disconnected'));
                    if (loadingRef.current) {
                        setBusy(false);
                        pushMessage('assistant', 'The connection closed before a reply arrived. Select Reconnect, then send your message again.');
                    }
                    // Auto-reconnect with backoff only for unexpected closures (not user-initiated reloads)
                    if (!loadingRef.current && event.code !== 1001) {
                        scheduleReconnect();
                    }
                };
            } catch (error) {
                if (!mounted) return;
                console.error('Failed to create WebSocket:', error);
                setSocketStatus('error');
            }
        })();

        return () => {
            mounted = false;
            cancelScheduledReconnect();
            if (ws.current?.readyState === WebSocket.OPEN) {
                ws.current.close();
            }
        };
    }, [connectKey, setBusy, pushMessage, refreshData, cancelScheduledReconnect]);

    useEffect(() => {
        if (keepScrolledRef.current) {
            endRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'});
            setShowScrollToBottom(false);
        } else {
            setShowScrollToBottom(true);
        }
    }, [messages, loading]);

    const handleConversationScroll = () => {
        const element = scrollRef.current;
        if (!element) return;
        const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
        keepScrolledRef.current = nearBottom;
        if (nearBottom) setShowScrollToBottom(false);
    };

    const scrollToLatest = () => {
        keepScrolledRef.current = true;
        setShowScrollToBottom(false);
        endRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'});
    };

    useEffect(() => {
        const element = textareaRef.current;
        if (!element) return;
        element.style.height = 'auto';
        element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
    }, [input]);

    const reconnect = () => {
        setSocketStatus('reconnecting');
        setConnectKey((key) => key + 1);
    };

    const scheduleReconnect = () => {
        // Exponential backoff: 1s, 2s, 4s, 8s... capped at 30s
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            reconnect();
        }, delay);
    };

    const cancelScheduledReconnect = () => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        reconnectAttemptsRef.current = 0;
    };

    const send = async (override) => {
        const socket = ws.current;
        const text = (override ?? input).trim();
        const file = override ? null : selectedFile;
        if ((!text && !file) || loadingRef.current) return;

        if (!socket || socket.readyState !== WebSocket.OPEN) {
            pushMessage('assistant', 'Chat is not connected. Wait for "Connected" or select Reconnect, then send again.');
            return;
        }

        const prompt = text || `Analyze this file: ${file.name}`;
        setInput('');
        setSelectedFile(null);
        setBusy(true);
        pushMessage('user', prompt);

        try {
            let attachmentId;
            if (file) {
                setUploadingAttachment(true);
                const form = new FormData();
                form.append('file', file);
                const result = await axiosRef.current.post('/dashboard/gemini/upload', form);
                attachmentId = result.data.file_id;
                setUploadingAttachment(false);
            }
            socket.send(JSON.stringify({
                prompt,
                attachment_id: attachmentId,
                conversation_id: activeConversationId || undefined
            }));
        } catch (error) {
            setUploadingAttachment(false);
            setBusy(false);
            pushMessage('assistant', 'Could not send your message. Check your connection and try again.');
            console.error('AI message failed', error);
        }
    };

    const respondToApproval = (approval, approved) => {
        const socket = ws.current;
        setPendingApprovals((pending) => pending.filter((item) => item.id !== approval.id));
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            pushMessage('assistant', 'Chat disconnected, so no change was made. Reconnect and ask again.');
            return;
        }
        socket.send(JSON.stringify({type: 'confirm_response', id: approval.id, approved}));
        if (!approved) pushMessage('assistant', 'Action cancelled; no change was made.');
    };

    const clearHistory = async () => {
        if (!window.confirm('Clear all chat history? This cannot be undone.')) return;
        try {
            await axiosRef.current.delete('/dashboard/gemini/history');
            setMessages([]);
            setActiveConversationId(null);
            setConversations([]);
            setConversationsError(null);
        } catch (error) {
            console.error('Could not clear history', error);
            pushMessage('assistant', 'Could not clear the history. Try again.');
        }
    };

    const last = messages[messages.length - 1];
    const showTyping = loading && !(last?.role === 'assistant' && last.streaming);
    const canSend = socketStatus === 'connected' && !loading && (input.trim() || selectedFile);

    return (
        <section className="nx-ai">
            <header className="nx-toolbar">
                <div className="nx-toolbar-left">
                    <button
                        type="button"
                        className="nx-history-btn"
                        aria-label={historyOpen ? 'Hide conversation history' : 'Show conversation history'}
                        aria-expanded={historyOpen}
                        aria-controls="nx-history-panel"
                        onClick={() => setHistoryOpen((prev) => !prev)}
                    >
                        <Clock size={16}/>
                        <span className="nx-history-label">{historyOpen ? 'Hide History' : 'History'}</span>
                    </button>
                </div>

                <div className="nx-toolbar-right">
                    <div className="nx-status" role="status" aria-live="polite">
                        <span className={`nx-dot nx-dot-${socketStatus}`} aria-hidden="true"/>
                        <span className="nx-status-label">{STATUS_LABEL[socketStatus] || socketStatus}</span>
                        {(socketStatus === 'disconnected' || socketStatus === 'error' || socketStatus === 'reconnecting') && (
                            <button type="button" className="nx-reconnect" onClick={reconnect}
                                    disabled={socketStatus === 'reconnecting'}>
                                {socketStatus === 'reconnecting' ? <RefreshCw size={14} className="nx-spin"/> :
                                    <RefreshCw size={14}/>}
                                {socketStatus === 'reconnecting' ? 'Reconnecting…' : 'Reconnect'}
                            </button>
                        )}
                        {wsCloseInfo && (
                            <span className="nx-muted" style={{fontSize: '0.75rem', marginLeft: 8}}>
                                Closed: {wsCloseInfo.code} {wsCloseInfo.reason}
                            </span>
                        )}
                    </div>
                </div>
            </header>

            <aside
                id="nx-history-panel"
                className={`nx-history-drawer ${historyOpen ? 'nx-open' : 'nx-closed'}`}
                aria-label="Conversation history"
                aria-hidden={!historyOpen}
            >
                <div className="nx-drawer-head">
                    <h2><Clock size={16}/> History</h2>
                    <button type="button" className="nx-ghost" onClick={clearHistory} disabled={!messages.length}>
                        <Trash2 size={14}/> Clear history
                    </button>
                </div>
                {conversationsError && <p className="nx-muted" role="alert">{conversationsError}</p>}
                {conversationsLoading ? (
                    <p className="nx-muted">Loading history…</p>
                ) : conversations.length ? (
                    <ul className="nx-history" role="list" aria-label="Saved conversations">
                        {conversations.map((conv) => {
                            const selected = activeConversationId === conv.id;
                            return (
                                <li
                                    key={conv.id}
                                    className={`nx-history-item ${selected ? 'nx-selected' : ''}`}
                                    onClick={() => selectConversation(conv)}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`${conv.title || 'Untitled conversation'}. ${conv.preview || ''}. ${formatDate(conv.updated_at || conv.created_at)}`}
                                    aria-pressed={selected}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            selectConversation(conv);
                                        }
                                    }}
                                >
                                    <div className="nx-entry-main">
                                        <div className="nx-entry-title">{conv.title || 'Untitled conversation'}</div>
                                        {conv.preview && <div className="nx-entry-preview">{conv.preview}</div>}
                                        <div className="nx-entry-meta">
                                            <span>{formatDate(conv.updated_at || conv.created_at)}</span>
                                            {conv.message_count != null && (
                                                <span>
                                                    {conv.message_count} message{conv.message_count === 1 ? '' : 's'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {selected && <span className="nx-selected-mark">&check;</span>}
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="nx-muted">No saved conversations yet.</p>
                )}
            </aside>

            {historyOpen && (
                <div className="nx-drawer-backdrop" onClick={() => setHistoryOpen(false)} aria-hidden="true"/>
            )}

            <div className="nx-wrap nx-main">
                <div className="nx-scroll" ref={scrollRef} onScroll={handleConversationScroll}>
                    <div className="nx-messages">
                        {!messages.length && !loading ? (
                            <div className="nx-empty">
                                <span className="nx-avatar nx-avatar-lg"><Sparkles size={22}/></span>
                                <h2>Ask about your day</h2>
                                <p className="nx-muted">Nexus can read your calendar, tasks and recent email to
                                    answer.</p>
                                <div className="nx-suggestions">
                                    {SUGGESTIONS.map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            type="button"
                                            onClick={() => send(suggestion)}
                                            disabled={socketStatus !== 'connected'}
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            messages.map((message, index) => (
                                <div
                                    key={message.id || `${message.timestamp}-${index}`}
                                    className={`nx-msg nx-msg-${message.role === 'user' ? 'user' : 'assistant'}`}
                                >
                                    {message.role !== 'user' && (
                                        <span className="nx-avatar"><Sparkles size={16}/></span>
                                    )}
                                    <div className="nx-bubble">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text || ''}</ReactMarkdown>
                                    </div>
                                </div>
                            ))
                        )}
                        {pendingApprovals.map((approval) => (
                            <div className="nx-approval" key={approval.id} role="group"
                                 aria-label="Confirm requested change">
                                <strong>Confirm before changing data</strong>
                                <p>{approval.summary}</p>
                                <div className="nx-approval-actions">
                                    <button type="button" className="nx-approve"
                                            onClick={() => respondToApproval(approval, true)}><Check size={15}/> Approve
                                    </button>
                                    <button type="button" className="nx-ghost-btn"
                                            onClick={() => respondToApproval(approval, false)}>Cancel
                                    </button>
                                </div>
                            </div>
                        ))}
                        {showTyping && (
                            <div className="nx-msg nx-msg-assistant" aria-label="Nexus is thinking">
                                <span className="nx-avatar"><Sparkles size={16}/></span>
                                <div className="nx-typing"><i/><i/><i/></div>
                            </div>
                        )}
                        <div ref={endRef}/>
                    </div>
                    {showScrollToBottom && (
                        <button type="button" className="nx-scroll-bottom" onClick={scrollToLatest}
                                aria-label="Scroll to latest message">
                            <ArrowDown size={16}/> New messages
                        </button>
                    )}
                </div>

                <div className="nx-composer-wrap">
                    {selectedFile && (
                        <div className="nx-file">
                            <Paperclip size={14}/>
                            <span>{selectedFile.name}</span>
                            <button type="button" onClick={() => setSelectedFile(null)} aria-label="Remove attachment">
                                <X size={14}/>
                            </button>
                        </div>
                    )}
                    {uploadingAttachment && <div className="nx-upload-status" role="status"><RefreshCw size={13}
                                                                                                       className="nx-spin"/> Uploading
                        attachment…</div>}
                    <div className="nx-composer">
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*,application/pdf,text/*"
                            hidden
                            onChange={(event) => {
                                setSelectedFile(event.target.files?.[0] || null);
                                event.target.value = '';
                            }}
                        />
                        <button
                            type="button"
                            className="nx-attach"
                            onClick={() => fileRef.current?.click()}
                            aria-label="Attach file"
                            disabled={loading}
                        >
                            <Paperclip size={18}/>
                        </button>
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={input}
                            disabled={loading}
                            placeholder="Message Nexus AI"
                            aria-label="Message Nexus AI"
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                    event.preventDefault();
                                    send();
                                }
                            }}
                        />
                        <button
                            type="button"
                            className="nx-send"
                            onClick={() => send()}
                            disabled={!canSend}
                            aria-label={loading ? 'Sending message' : 'Send message'}
                            title={loading ? 'Sending…' : 'Send message'}
                        >
                            {loading ? <RefreshCw size={17} className="nx-spin"/> : <ArrowUp size={18}/>}
                        </button>
                    </div>
                    <p className="nx-hint">Enter to send, Shift+Enter for a new line</p>
                </div>
            </div>
        </section>
    );
}
