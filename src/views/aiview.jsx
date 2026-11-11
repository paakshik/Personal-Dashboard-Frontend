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

    // History panel state
    const [historyOpen, setHistoryOpen] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [conversationsLoading, setConversationsLoading] = useState(false);
    const [conversationsError, setConversationsError] = useState(null);
    // The id of the conversation currently displayed in the main window. New
    // messages are sent with this id so they append to the right conversation.
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

                socket.onerror = () => {
                    if (!mounted) return;
                    setSocketStatus('error');
                };

                socket.onclose = () => {
                    if (!mounted) return;
                    if (ws.current === socket) ws.current = null;
                    setSocketStatus((current) => (current === 'error' ? 'error' : 'disconnected'));
                    if (loadingRef.current) {
                        setBusy(false);
                        pushMessage('assistant', 'The connection closed before a reply arrived. Select Reconnect, then send your message again.');
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
            if (ws.current?.readyState === WebSocket.OPEN) {
                ws.current.close();
            }
        };
    }, [connectKey, setBusy, pushMessage, refreshData]);

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
        setSocketStatus('connecting');
        setConnectKey((key) => key + 1);
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
            <style>{css}</style>

            <main className="nx-main">
                <div className="nx-head">
                    <button
                        type="button"
                        className={`nx-history-toggle ${historyOpen ? 'nx-pressed' : ''}`}
                        aria-label={historyOpen ? 'Hide conversation history' : 'Show conversation history'}
                        aria-expanded={historyOpen}
                        aria-controls="nx-history-panel"
                        onClick={() => setHistoryOpen((prev) => !prev)}
                    >
                        <Clock size={16}/>
                        <span className="nx-toggle-label">{historyOpen ? 'Hide History' : 'History'}</span>
                    </button>
                </div>

                <aside
                    id="nx-history-panel"
                    className={`nx-side ${historyOpen ? 'nx-side-open' : 'nx-side-closed'}`}
                    aria-label="Conversation history"
                    aria-hidden={!historyOpen}
                >
                    <div className="nx-side-head">
                        <h2><Clock size={16}/> History</h2>
                        <button type="button" className="nx-ghost" onClick={clearHistory} disabled={!messages.length}>
                            <Trash2 size={14}/> Clear history
                        </button>
                    </div>
                    {conversationsError && <p className="nx-muted">{conversationsError}</p>}
                    {conversationsLoading ? (
                        <p className="nx-muted">Loading history...</p>
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
                                            <div
                                                className="nx-entry-title">{conv.title || 'Untitled conversation'}</div>
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

                <div className="nx-status" role="status" aria-live="polite">
                    <span className={`nx-dot nx-dot-${socketStatus}`} aria-hidden="true"/>
                    {STATUS_LABEL[socketStatus] || socketStatus}
                    {(socketStatus === 'disconnected' || socketStatus === 'error') && (
                        <button type="button" className="nx-ghost" onClick={reconnect}>
                            <RefreshCw size={14}/> Reconnect
                        </button>
                    )}
                </div>

                <div className="nx-scroll" ref={scrollRef} onScroll={handleConversationScroll}>
                    <div className="nx-column">
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
                                    <div className="nx-bubble nx-md">
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
                                    <button type="button" className="nx-ghost"
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
                            className="nx-icon"
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
            </main>
        </section>
    );
}

const css = `
.nx-ai {
  --nx-green: #15803d;
  --nx-green-dark: #166534;
  --nx-tint: #f0fdf4;
  --nx-line: #e5e7eb;
  --nx-ink: #1f2937;
  --nx-muted: #6b7280;
  --nx-soft: #f3f4f6;
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  width: 100%;
  min-width: 0;
  background: #fff;
  color: var(--nx-ink);
  font-family: inherit;
  border: 1px solid var(--nx-line);
  border-radius: 14px;
  overflow: hidden;
}
.nx-ai *, .nx-ai *::before, .nx-ai *::after { box-sizing: border-box; }
.nx-ai button, .nx-ai textarea { font: inherit; color: inherit; }
.nx-ai :focus-visible { outline: 2px solid var(--nx-green); outline-offset: 2px; }
.nx-muted { color: var(--nx-muted); font-size: 0.9rem; margin: 0; }

/* Main header with the history toggle */
.nx-head {
  display: flex; align-items: center; gap: 10px;
  min-height: 54px; padding: 8px 18px; border-bottom: 1px solid var(--nx-line);
}
.nx-history-toggle {
  display: inline-flex; align-items: center; gap: 8px;
  border: 1px solid var(--nx-line); border-radius: 10px;
  padding: 6px 12px; background: #fff; color: var(--nx-ink);
  font-size: 0.9rem; font-weight: 600; cursor: pointer;
}
.nx-history-toggle:hover { background: var(--nx-soft); border-color: var(--nx-muted); }
.nx-history-toggle.nx-pressed {
  background: var(--nx-tint); border-color: var(--nx-green);
}
.nx-history-toggle[aria-expanded="true"] { background: var(--nx-tint); border-color: var(--nx-green); }
.nx-toggle-label { white-space: nowrap; }

/* Sidebar / history panel */
.nx-side {
  position: absolute; z-index: 40; top: 54px; bottom: 0; left: 0;
  width: min(320px, 84vw); overflow: hidden; display: flex; flex-direction: column;
  background: #fff; border-right: 1px solid var(--nx-line); box-shadow: 8px 0 24px rgba(15, 23, 42, .09);
  transform: translateX(-105%); visibility: hidden; pointer-events: none;
  transition: transform 0.2s ease, visibility 0.2s ease;
}
.nx-side-closed { visibility: hidden; pointer-events: none; }
.nx-side-open { transform: translateX(0); visibility: visible; pointer-events: auto; }
.nx-side-head {
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
  padding: 20px 16px; flex-shrink: 0;
}
.nx-side h2 { margin: 0; font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.nx-history {
  list-style: none; margin: 0; padding: 0;
  overflow-y: auto; display: flex; flex-direction: column;
  flex: 1; min-height: 0;
}
.nx-history-item {
  display: flex; align-items: flex-start;
  padding: 10px 14px; border-radius: 10px;
  cursor: pointer; border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.nx-history-item:hover { background: var(--nx-soft); border-color: var(--nx-line); }
.nx-history-item:focus-visible { outline: 2px solid var(--nx-green); outline-offset: 2px; background: var(--nx-soft); }
.nx-history-item.nx-selected {
  background: var(--nx-tint); border-color: var(--nx-green);
}
.nx-history-item.nx-selected .nx-entry-title { color: var(--nx-green-dark); font-weight: 700; }
.nx-selected-mark {
  margin-left: auto; margin-top: 2px; font-size: 0.75rem; color: var(--nx-green);
  font-weight: 700; flex-shrink: 0;
}
.nx-entry-main { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 4px; }
.nx-entry-title {
  font-size: 0.92rem; font-weight: 600; color: var(--nx-ink);
  overflow-wrap: anywhere; white-space: normal; line-height: 1.25;
  min-width: 0;
}
.nx-entry-preview {
  font-size: 0.8rem; color: var(--nx-muted);
  overflow-wrap: anywhere; white-space: normal; line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; min-width: 0;
}
.nx-entry-meta {
  display: flex; align-items: baseline; gap: 8px;
  font-size: 0.75rem; color: var(--nx-muted); margin-top: 4px;
  flex-wrap: wrap;
}
.nx-ghost {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px;
  border: 1px solid var(--nx-line); border-radius: 8px; background: #fff;
  font-size: 0.82rem; font-weight: 600; color: #4b5563; cursor: pointer;
}
.nx-ghost:hover:not(:disabled) { background: var(--nx-soft); }
.nx-ghost:disabled { opacity: 0.5; cursor: default; }

/* Main column */
.nx-main { position: relative; flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.nx-status {
  display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 18px;
  font-size: 0.85rem; color: var(--nx-muted); border-bottom: 1px solid var(--nx-line);
  flex-shrink: 0;
}
.nx-status .nx-ghost { margin-left: 6px; }
.nx-dot { width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; }
.nx-dot-connected { background: #16a34a; }
.nx-dot-connecting { background: #d97706; }
.nx-dot-disconnected, .nx-dot-error { background: #dc2626; }
.nx-scroll { position: relative; flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: clamp(14px, 2vw, 24px); scroll-behavior: smooth; }
.nx-column { width: 100%; max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }

/* Messages */
.nx-msg { display: flex; gap: 12px; align-items: flex-start; white-space: pre-wrap; }
.nx-approval { margin: 4px 0 4px 42px; padding: 14px; border: 1px solid #fbbf24; border-radius: 12px; background: #fffbeb; }
.nx-approval p { margin: 8px 0 12px; line-height: 1.5; }
.nx-approval-actions { display: flex; gap: 8px; }
.nx-approve { display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 8px; padding: 7px 12px; background: var(--nx-green); color: white !important; font-weight: 700; cursor: pointer; }
.nx-approve:hover { background: var(--nx-green-dark); }
.nx-msg-user { justify-content: flex-end; }
.nx-msg-user .nx-bubble {
  background: var(--nx-green); color: #fff; padding: 10px 14px;
  border-radius: 16px 16px 4px 16px; max-width: 80%;
}
.nx-msg-user .nx-bubble a { color: #fff; }
.nx-msg-assistant .nx-bubble { flex: 1; min-width: 0; padding-top: 4px; }
.nx-avatar {
  width: 30px; height: 30px; flex-shrink: 0; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--nx-tint); color: var(--nx-green); border: 1px solid #bbf7d0;
}
.nx-avatar-lg { width: 48px; height: 48px; }

/* Markdown content */
.nx-md > :first-child { margin-top: 0; }
.nx-md > :last-child { margin-bottom: 0; }
.nx-md p { margin: 0 0 0.75em; line-height: 1.65; overflow-wrap: anywhere; }
.nx-md ul, .nx-md ol { margin: 0 0 0.75em; padding-left: 1.4em; line-height: 1.65; }
.nx-md h1, .nx-md h2, .nx-md h3 { margin: 1em 0 0.4em; line-height: 1.3; }
.nx-md a { color: var(--nx-green-dark); }
.nx-md blockquote { margin: 0 0 0.75em; padding-left: 12px; border-left: 3px solid var(--nx-line); color: var(--nx-muted); }
.nx-md pre { background: var(--nx-soft); padding: 12px 14px; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; margin: 0 0 0.75em; }
.nx-md code { background: var(--nx-soft); padding: 1px 5px; border-radius: 4px; font-size: 0.88em; }
.nx-md pre code { background: none; padding: 0; }
.nx-msg-user .nx-md code { background: rgba(255,255,255,0.2); }
.nx-md table { border-collapse: collapse; display: block; overflow-x: auto; margin: 0 0 0.75em; }
.nx-md th, .nx-md td { border: 1px solid var(--nx-line); padding: 6px 10px; text-align: left; }

/* Typing indicator */
.nx-typing { display: flex; gap: 5px; padding: 14px 4px; }
.nx-typing i { width: 7px; height: 7px; border-radius: 50%; background: #9ca3af; animation: nx-bounce 1.2s infinite ease-in-out; }
.nx-typing i:nth-child(2) { animation-delay: 0.15s; }
.nx-typing i:nth-child(3) { animation-delay: 0.3s; }
@keyframes nx-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .nx-typing i, .nx-spin { animation: none; } }

/* Empty state */
.nx-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 28px 0; min-height: min(52vh, 440px); justify-content: center; }
.nx-empty h2 { margin: 6px 0 0; font-size: 1.5rem; }
.nx-suggestions { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; width: min(420px, 100%); }
.nx-suggestions button {
  padding: 11px 14px; border: 1px solid var(--nx-line); border-radius: 10px;
  background: #fff; text-align: left; cursor: pointer; font-size: 0.95rem;
}
.nx-suggestions button:hover:not(:disabled) { border-color: var(--nx-green); background: var(--nx-tint); }
.nx-suggestions button:disabled { opacity: 0.5; cursor: default; }

/* Composer */
.nx-composer-wrap { position: relative; z-index: 2; flex: 0 0 auto; padding: 8px clamp(12px, 2vw, 22px) 12px; border-top: 1px solid var(--nx-line); background: #fff; box-shadow: 0 -5px 18px rgba(15, 23, 42, .035); }
.nx-composer-wrap > * { width: 100%; max-width: 900px; margin-left: auto; margin-right: auto; }
.nx-composer {
  display: flex; align-items: flex-end; gap: 6px; padding: 8px;
  border: 1px solid #d1d5db; border-radius: 16px; background: #fff;
}
.nx-composer:focus-within { border-color: var(--nx-green); box-shadow: 0 0 0 3px rgba(21, 128, 61, 0.15); }
.nx-composer textarea {
  flex: 1; min-width: 0; border: none; outline: none; resize: none; background: transparent;
  padding: 8px 4px; font-size: 1rem; line-height: 1.5; max-height: 160px;
}
.nx-composer textarea:disabled { opacity: 0.6; }
.nx-icon, .nx-send {
  width: 36px; height: 36px; flex-shrink: 0; border: none; border-radius: 10px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.nx-icon { background: transparent; color: #4b5563; }
.nx-icon:hover:not(:disabled) { background: var(--nx-soft); }
.nx-send { background: var(--nx-green); color: #fff; }
.nx-send:hover:not(:disabled) { background: var(--nx-green-dark); }
.nx-send:disabled, .nx-icon:disabled { opacity: 0.45; cursor: default; }
.nx-spin { animation: nx-spin 1s linear infinite; }
@keyframes nx-spin { to { transform: rotate(360deg); } }
.nx-upload-status { width: 100%; max-width: 900px; margin: 0 auto 7px; display: flex; align-items: center; gap: 7px; color: var(--nx-muted); font-size: .8rem; }
.nx-file {
  display: flex; align-items: center; gap: 8px; width: fit-content; max-width: 100%;
  margin-bottom: 8px; padding: 5px 8px 5px 10px; border-radius: 8px;
  background: var(--nx-soft); font-size: 0.85rem;
}
.nx-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nx-file button { border: none; background: transparent; cursor: pointer; display: inline-flex; padding: 2px; color: #4b5563; }
.nx-hint { margin: 6px 0 0; font-size: 0.76rem; color: var(--nx-muted); text-align: center; }
.nx-scroll-bottom { position: sticky; z-index: 3; left: 50%; bottom: 10px; transform: translateX(-50%); display: flex; align-items: center; gap: 7px; margin: 0 auto; padding: 8px 12px; border: 1px solid var(--nx-line); border-radius: 999px; background: #fff; box-shadow: 0 4px 16px rgba(15, 23, 42, .12); color: var(--nx-ink); font-size: .82rem; font-weight: 600; cursor: pointer; }

/* Drawer backdrop (mobile overlay) */
.nx-drawer-backdrop {
  display: none;
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35);
  z-index: 30; backdrop-filter: blur(2px);
}

@media (max-width: 800px) {
  .nx-drawer-backdrop { display: block; position: absolute; inset: 54px 0 0; background: rgba(15, 23, 42, .22); z-index: 30; }
  .nx-side { top: 54px; bottom: 0; width: min(340px, 88vw); }
  .nx-ai { height: 100%; min-height: 0; }
  .nx-scroll { padding: 14px; }
  .nx-composer-wrap { padding: 8px 12px 10px; }
  .nx-status { padding: 8px 14px; }
}
`;
