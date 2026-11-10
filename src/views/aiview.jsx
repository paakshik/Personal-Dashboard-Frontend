import {useCallback, useEffect, useRef, useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {ArrowUp, Check, Clock, Paperclip, RefreshCw, Sparkles, Trash2, X} from 'lucide-react';
import {getWebSocketTicketUrl} from '../api';

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

export default function AiView({axiosInstance, refreshData}) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [socketStatus, setSocketStatus] = useState(() => (localStorage.getItem('token') ? 'connecting' : 'error'));
    const [selectedFile, setSelectedFile] = useState(null);
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [connectKey, setConnectKey] = useState(0);

    const ws = useRef(null);
    const fileRef = useRef(null);
    const endRef = useRef(null);
    const textareaRef = useRef(null);
    const loadingRef = useRef(false);
    // Keep the latest axios instance in a ref so a new instance from the parent
    // never forces the WebSocket effect below to reconnect.
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

    // Load history once.
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

                // onerror only records the state; onclose reports a lost reply once.
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
        endRef.current?.scrollIntoView({behavior: 'smooth'});
    }, [messages, loading]);

    // Grow the text box with its content, up to a limit.
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
                const form = new FormData();
                form.append('file', file);
                const result = await axiosRef.current.post('/dashboard/gemini/upload', form);
                attachmentId = result.data.file_id;
            }
            socket.send(JSON.stringify({prompt, attachment_id: attachmentId}));
        } catch (error) {
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
        if (!window.confirm('Clear all chat history?')) return;
        try {
            await axiosRef.current.delete('/dashboard/gemini/history');
            setMessages([]);
        } catch (error) {
            console.error('Could not clear history', error);
            pushMessage('assistant', 'Could not clear the history. Try again.');
        }
    };

    const userMessages = messages.filter((message) => message.role === 'user').reverse();
    const last = messages[messages.length - 1];
    const showTyping = loading && !(last?.role === 'assistant' && last.streaming);
    const canSend = socketStatus === 'connected' && !loading && (input.trim() || selectedFile);

    return (
        <section className="nx-ai">
            <style>{css}</style>

            <aside className="nx-side" aria-label="Chat history">
                <div className="nx-side-head">
                    <h2><Clock size={16}/> History</h2>
                    <button type="button" className="nx-ghost" onClick={clearHistory} disabled={!messages.length}>
                        <Trash2 size={14}/> Clear history
                    </button>
                </div>
                {userMessages.length ? (
                    <ul className="nx-history">
                        {userMessages.map((message, index) => (
                            <li key={message.id || `${message.timestamp}-${index}`} title={message.text}>
                                {message.text}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="nx-muted">Your questions will appear here.</p>
                )}
            </aside>

            <main className="nx-main">
                <div className="nx-status" role="status" aria-live="polite">
                    <span className={`nx-dot nx-dot-${socketStatus}`} aria-hidden="true"/>
                    {STATUS_LABEL[socketStatus] || socketStatus}
                    {(socketStatus === 'disconnected' || socketStatus === 'error') && (
                        <button type="button" className="nx-ghost" onClick={reconnect}>
                            <RefreshCw size={14}/> Reconnect
                        </button>
                    )}
                </div>

                <div className="nx-scroll">
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
                            aria-label="Send message"
                        >
                            <ArrowUp size={18}/>
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
  display: flex;
  height: calc(100vh - 90px);
  min-height: 0;
  background: #fff;
  color: var(--nx-ink);
  font-family: inherit;
}
.nx-ai *, .nx-ai *::before, .nx-ai *::after { box-sizing: border-box; }
.nx-ai button, .nx-ai textarea { font: inherit; color: inherit; }
.nx-ai :focus-visible { outline: 2px solid var(--nx-green); outline-offset: 2px; }
.nx-muted { color: var(--nx-muted); font-size: 0.9rem; margin: 0; }

/* Sidebar */
.nx-side {
  width: 260px; flex-shrink: 0; padding: 20px 16px;
  border-right: 1px solid var(--nx-line);
  display: flex; flex-direction: column; gap: 14px; overflow: hidden;
}
.nx-side-head { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.nx-side h2 { margin: 0; font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.nx-history { list-style: none; margin: 0; padding: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.nx-history li {
  padding: 8px 10px; border-radius: 8px; font-size: 0.9rem; color: var(--nx-ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.nx-history li:hover { background: var(--nx-soft); }
.nx-ghost {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px;
  border: 1px solid var(--nx-line); border-radius: 8px; background: #fff;
  font-size: 0.82rem; font-weight: 600; color: #4b5563; cursor: pointer;
}
.nx-ghost:hover:not(:disabled) { background: var(--nx-soft); }
.nx-ghost:disabled { opacity: 0.5; cursor: default; }

/* Main column */
.nx-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.nx-status {
  display: flex; align-items: center; gap: 8px; padding: 12px 24px;
  font-size: 0.85rem; color: var(--nx-muted); border-bottom: 1px solid var(--nx-line);
}
.nx-status .nx-ghost { margin-left: 6px; }
.nx-dot { width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; }
.nx-dot-connected { background: #16a34a; }
.nx-dot-connecting { background: #d97706; }
.nx-dot-disconnected, .nx-dot-error { background: #dc2626; }
.nx-scroll { flex: 1; overflow-y: auto; padding: 24px; }
.nx-column { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }

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
@media (prefers-reduced-motion: reduce) { .nx-typing i { animation: none; } }

/* Empty state */
.nx-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 8vh 0 0; }
.nx-empty h2 { margin: 6px 0 0; font-size: 1.5rem; }
.nx-suggestions { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; width: min(420px, 100%); }
.nx-suggestions button {
  padding: 11px 14px; border: 1px solid var(--nx-line); border-radius: 10px;
  background: #fff; text-align: left; cursor: pointer; font-size: 0.95rem;
}
.nx-suggestions button:hover:not(:disabled) { border-color: var(--nx-green); background: var(--nx-tint); }
.nx-suggestions button:disabled { opacity: 0.5; cursor: default; }

/* Composer */
.nx-composer-wrap { padding: 8px 24px 16px; }
.nx-composer-wrap > * { max-width: 720px; margin-left: auto; margin-right: auto; }
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
.nx-file {
  display: flex; align-items: center; gap: 8px; width: fit-content; max-width: 100%;
  margin-bottom: 8px; padding: 5px 8px 5px 10px; border-radius: 8px;
  background: var(--nx-soft); font-size: 0.85rem;
}
.nx-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nx-file button { border: none; background: transparent; cursor: pointer; display: inline-flex; padding: 2px; color: #4b5563; }
.nx-hint { margin: 6px 0 0; font-size: 0.78rem; color: var(--nx-muted); text-align: center; }

@media (max-width: 800px) {
  .nx-side { display: none; }
  .nx-scroll { padding: 16px; }
  .nx-composer-wrap { padding: 8px 12px 12px; }
  .nx-status { padding: 10px 16px; }
}
`;