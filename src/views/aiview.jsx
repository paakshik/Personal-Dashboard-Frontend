import {useCallback, useEffect, useRef, useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Clock, Paperclip, Sparkles, Trash2, X} from 'lucide-react';
import {getWebSocketUrl} from '../api';

export default function AiView({axiosInstance}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
    const ws = useRef(null);
    const fileRef = useRef(null);
  const messagesEndRef = useRef(null);

    const fetchHistory = useCallback(async () => {
        try {
            const response = await axiosInstance.get('/dashboard/gemini/history');
            setMessages(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Unable to load chat history', error);
        }
    }, [axiosInstance]);

    useEffect(() => {
        const historyTimer = setTimeout(() => {
            void fetchHistory();
        }, 0);
        const token = localStorage.getItem('token');
        if (!token) return undefined;
        const socket = new WebSocket(getWebSocketUrl('/dashboard/gemini/stream', token));
        ws.current = socket;
        socket.onmessage = ({data}) => {
            let event;
            try {
                event = JSON.parse(data);
            } catch {
                return;
            }
            if (event.type === 'chunk') {
                setMessages((previous) => {
                    const next = [...previous];
                    const last = next[next.length - 1];
                    if (last?.role === 'assistant' && last.streaming) next[next.length - 1] = {
                        ...last,
                        text: last.text + event.text
                    };
                    else next.push({
                        role: 'assistant',
                        text: event.text,
                        timestamp: new Date().toISOString(),
                        streaming: true
                    });
                    return next;
                });
            } else if (event.type === 'start') {
                setMessages((previous) => [...previous, {
                    role: 'assistant',
                    text: '',
                    timestamp: new Date().toISOString(),
                    streaming: true
                }]);
            } else if (event.type === 'done') {
                setLoading(false);
                setMessages((previous) => previous.map((message) => ({...message, streaming: false})));
            } else if (event.type === 'error') {
                setLoading(false);
                setMessages((previous) => [...previous, {
                    role: 'assistant',
                    text: event.message || 'AI response failed',
                    timestamp: new Date().toISOString()
                }]);
            }
    };
        socket.onerror = () => setLoading(false);
        socket.onclose = () => {
            if (ws.current === socket) ws.current = null;
        };
        return () => {
            clearTimeout(historyTimer);
            socket.close();
            ws.current = null;
        };
    }, [fetchHistory]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
    }, [messages]);

    const send = async () => {
        const socket = ws.current;
        if ((!input.trim() && !selectedFile) || !socket || socket.readyState !== WebSocket.OPEN || loading) return;
        const text = input.trim();
        const file = selectedFile;
        setInput('');
        setSelectedFile(null);
        setLoading(true);
        setMessages((previous) => [...previous, {
            role: 'user',
            text: text || `Analyze this file: ${file.name}`,
            timestamp: new Date().toISOString()
        }]);
    try {
        let attachmentId;
        if (file) {
            const form = new FormData();
            form.append('file', file);
            const result = await axiosInstance.post('/dashboard/gemini/upload', form);
            attachmentId = result.data.file_id;
        }
        socket.send(JSON.stringify({prompt: text || `Analyze this file: ${file.name}`, attachment_id: attachmentId}));
    } catch (error) {
        setLoading(false);
        setMessages((previous) => [...previous, {
            role: 'assistant',
            text: 'Could not send your message. Check the connection and try again.',
            timestamp: new Date().toISOString()
        }]);
        console.error('AI message failed', error);
    }
  };

  const clearHistory = async () => {
      if (!window.confirm('Clear all chat history?')) return;
      await axiosInstance.delete('/dashboard/gemini/history');
      setMessages([]);
  };

    return <section style={{display: 'flex', height: 'calc(100vh - 90px)', background: '#fff'}}>
        <aside style={{width: 240, padding: 20, borderRight: '1px solid #ddd'}}>
            <h2><Clock size={18}/> History</h2>
            <button onClick={clearHistory}><Trash2 size={16}/> Clear History</button>
            {messages.filter((m) => m.role === 'user').map((m) => <p
                key={m.id || `${m.timestamp}-${m.text}`}>{m.text.slice(0, 42)}</p>)}
        </aside>
        <main style={{flex: 1, display: 'flex', flexDirection: 'column', padding: 20}}>
            <div style={{flex: 1, overflowY: 'auto'}}>
                {!messages.length && <h2><Sparkles/> Nexus AI Assistant</h2>}
                {messages.map((message, index) => <div key={message.id || `${message.timestamp}-${index}`} style={{
                    textAlign: message.role === 'user' ? 'right' : 'left',
                    margin: 12
                }}><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text || ''}</ReactMarkdown></div>)}
                <div ref={messagesEndRef}/>
            </div>
            {selectedFile && <p>{selectedFile.name}
                <button onClick={() => setSelectedFile(null)} aria-label="Remove attachment"><X size={16}/></button>
            </p>}
            <div style={{display: 'flex', gap: 8}}>
                <input ref={fileRef} type="file" accept="image/*,application/pdf,text/*" hidden
                       onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}/>
                <button onClick={() => fileRef.current?.click()} aria-label="Attach file"><Paperclip size={18}/>
                </button>
                <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        send();
                    }
                }} placeholder="Message Nexus AI..." disabled={loading}/>
                <button onClick={send} disabled={loading || (!input.trim() && !selectedFile)}>Send</button>
            </div>
        </main>
    </section>;
}

