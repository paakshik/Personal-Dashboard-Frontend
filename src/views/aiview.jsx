import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Trash2, MessageSquare, Clock, Paperclip, X, FileText, Sparkles } from 'lucide-react';
import { TrophySpin } from 'react-loading-indicators';

const AiView = ({ axiosInstance, setActiveView }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  
  const messagesEndRef = useRef(null);
  const ws = useRef(null); // WebSocket Reference
  
  // Load History & Connect WS on Mount
  // 1. Initialize WebSocket & Handle Streaming
// 🔧 REPLACE LINES 28-50 IN aiview.jsx WITH THIS:

useEffect(() => {
    fetchHistory();

    // 1. Create WebSocket Connection
    ws.current = new WebSocket("ws://localhost:8000/ws/ai/stream");

    ws.current.onopen = () => {
        console.log("✅ WebSocket connected, sending auth...");
        
        // 2. ⭐ SEND TOKEN AS FIRST MESSAGE
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.error("❌ No token found in localStorage!");
            ws.current.close();
            return;
        }
        
        // 3. Send authentication
        ws.current.send(JSON.stringify({ token: token }));
        console.log("🔑 Authentication sent");
    };

    ws.current.onmessage = (event) => {
        const text = event.data;
        
        // 4. Check if it's JSON response (e.g., auth confirmation)
        try {
            const json = JSON.parse(text);
            
            if (json.status === "authenticated") {
                console.log("✅ Authenticated successfully!");
                return; // Don't add to chat
            }
            
            if (json.error) {
                console.error("❌ WebSocket error:", json.error);
                alert(`Authentication failed: ${json.error}`);
                ws.current.close();
                return;
            }
        } catch (e) {
            // Not JSON, it's streaming text
        }

        // 5. Handle streaming text (existing code)
        if (text === "[DONE]") {
            setLoading(false);
            checkForNavigation();
        } else {
            setMessages((prev) => {
                const newHistory = [...prev];
                const lastMsgIndex = newHistory.length - 1;
                const lastMsg = newHistory[lastMsgIndex];
                
                if (lastMsg && lastMsg.role === 'model') {
                    newHistory[lastMsgIndex] = {
                        ...lastMsg,
                        text: lastMsg.text + text
                    };
                    return newHistory;
                } else {
                    setLoading(false); 
                    return [...prev, { 
                        role: 'model', 
                        text: text, 
                        timestamp: new Date().toISOString() 
                    }];
                }
            });
        }
    };

    ws.current.onerror = (err) => {
        console.error("❌ WebSocket Error:", err);
        setLoading(false);
    };

    ws.current.onclose = () => {
        console.log("🔌 WebSocket closed");
    };

    return () => ws.current?.close();
}, []);
  const fetchHistory = async () => {
    try {
      const res = await axiosInstance.get('/dashboard/gemini/history');
      setMessages(Array.isArray(res.data) ? res.data : []);
      scrollToBottom();
    } catch (error) {
      console.error("Failed to load history", error);
      setMessages([]); 
    }
  };

  const clearHistory = async () => {
    if(!confirm("Are you sure you want to clear all chat history?")) return;
    try {
      await axiosInstance.delete('/dashboard/gemini/history');
      setMessages([]);
    } catch (e) {
      console.error(e);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Check the last message for navigation commands (e.g., <<NAVIGATE:dashboard>>)
  const checkForNavigation = () => {
    setMessages(currentMessages => {
        const lastMsg = currentMessages[currentMessages.length - 1];
        if (lastMsg && lastMsg.role === 'model') {
            const navMatch = lastMsg.text.match(/<<NAVIGATE:(\w+)>>/);
            if (navMatch && navMatch[1]) {
                const targetView = navMatch[1].toLowerCase();
                // Remove tag from display
                lastMsg.text = lastMsg.text.replace(navMatch[0], '');
                if (setActiveView) setActiveView(targetView);
            }
        }
        return [...currentMessages];
    });
  };

  // --- FILE HANDLING ---
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- SEND MESSAGE & NAVIGATION LOGIC ---
  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || !ws.current) return;

    const userMsg = input;
    const currentFile = selectedFile; 

    // Reset UI immediately
    setInput('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLoading(true);

    // 1. Optimistic Update (Show user message immediately)
    const tempUserMsg = { 
        role: 'user', 
        text: userMsg + (currentFile ? `\n[📎 Uploading: ${currentFile.name}...]` : ''), 
        timestamp: new Date().toISOString() 
    };
    setMessages(prev => [...(prev || []), tempUserMsg]);

    try {
        let attachmentId = null;

        // 2. Handle File Upload (HTTP first, as WS is for text streaming)
        if (currentFile) {
            const formData = new FormData();
            formData.append('file', currentFile);
            
            try {
                const uploadRes = await axiosInstance.post('/dashboard/gemini/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                attachmentId = uploadRes.data.file_id;
            } catch (err) {
                console.error("Upload failed", err);
                setMessages(prev => [...prev, { role: 'model', text: "❌ Failed to upload file." }]);
                setLoading(false);
                return;
            }
        }

        // 3. Send to WebSocket (Stream response)
        // We include attachment_id so backend knows context
        const payload = {
            prompt: userMsg || (currentFile ? `Analyze this file: ${currentFile.name}` : "Hello"),
            attachment_id: attachmentId
        };
        
        ws.current.send(JSON.stringify(payload));
        // Note: loading stays true until [DONE] is received in onmessage

    } catch (error) {
        setMessages(prev => [...prev, { role: 'model', text: "Error connecting to AI.", timestamp: new Date().toISOString() }]);
        setLoading(false);
    } finally {
        scrollToBottom();
    }
  };

  // --- HISTORY SIDEBAR GROUPING ---
  const groupMessagesByDate = () => {
    if (!messages || !Array.isArray(messages)) return [];

    const groups = {};
    messages.forEach(msg => {
      if (!msg || !msg.timestamp) return;
      try {
        const date = new Date(msg.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const today = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        
        let key = date;
        if (date === today) key = "Today";
        
        if (!groups[key]) groups[key] = [];
        groups[key].push(msg);
      } catch (e) {
        console.warn("Date parse error", e);
      }
    });
    return Object.entries(groups).reverse(); 
  };

  const historyGroups = groupMessagesByDate();

  // --- MODERN PREMIUM STYLES ---
  const styles = {
    wrapper: { 
      display: 'flex', 
      height: 'calc(100vh - 80px)', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SF Pro Display", system-ui, sans-serif', 
      gap: '0', 
      overflow: 'hidden',
      backgroundColor: '#f8fafc'
    },
    
    // Sidebar - Clean minimal design
    sidebar: { 
      width: '280px', 
      backgroundColor: 'white', 
      padding: '24px 16px', 
      display: 'flex', 
      flexDirection: 'column', 
      borderRight: '1px solid #e2e8f0', 
      flexShrink: 0,
      boxShadow: '0 0 0 1px rgba(0,0,0,0.03)'
    },
    sidebarHeader: { 
      fontSize: '1.1rem', 
      fontWeight: '600', 
      color: '#0f172a', 
      marginBottom: '20px', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      padding: '0 8px'
    },
    historyList: { 
      flex: 1, 
      overflowY: 'auto',
      paddingRight: '4px'
    },
    dateGroup: { marginBottom: '24px' },
    dateLabel: { 
      color: '#64748b', 
      fontSize: '0.75rem', 
      fontWeight: '600', 
      marginBottom: '8px', 
      textTransform: 'uppercase', 
      letterSpacing: '0.5px',
      padding: '0 8px'
    },
    historyItem: { 
      padding: '10px 12px', 
      borderRadius: '8px', 
      color: '#475569', 
      fontSize: '0.875rem', 
      marginBottom: '2px', 
      cursor: 'pointer', 
      whiteSpace: 'nowrap', 
      overflow: 'hidden', 
      textOverflow: 'ellipsis', 
      backgroundColor: 'transparent', 
      transition: 'all 0.15s ease',
      fontWeight: '400'
    },
    
    // Main Chat - Modern glass effect
    main: { 
      flex: 1, 
      backgroundColor: 'white', 
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative', 
      overflow: 'hidden'
    },
    chatWindow: { 
      flex: 1, 
      overflowY: 'auto', 
      padding: '32px', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '24px',
      backgroundColor: '#f8fafc'
    },
    
    // Bubbles - Modern pill design
    bubbleContainer: (role) => ({
      display: 'flex',
      flexDirection: 'column',
      alignItems: role === 'user' ? 'flex-end' : 'flex-start',
      maxWidth: '75%',
      alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
      gap: '6px'
    }),
    bubble: (role) => ({
      backgroundColor: role === 'user' ? '#16a34a' : 'white',
      color: role === 'user' ? 'white' : '#0f172a',
      padding: '12px 18px',
      borderRadius: '18px',
      boxShadow: role === 'user' ? '0 2px 8px rgba(22, 163, 74, 0.15)' : '0 2px 8px rgba(0,0,0,0.08)',
      fontSize: '0.95rem',
      lineHeight: '1.6',
      wordBreak: 'break-word',
      border: role === 'user' ? 'none' : '1px solid #e2e8f0'
    }),
    timestamp: { 
      fontSize: '0.7rem', 
      color: '#94a3b8', 
      marginTop: '2px',
      marginLeft: '8px',
      marginRight: '8px',
      fontWeight: '400'
    },

    // Input Area - Floating style
    inputWrapper: { 
      padding: '20px 24px 24px', 
      backgroundColor: 'white', 
      borderTop: '1px solid #e2e8f0', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '12px'
    },
    inputContainer: { 
      display: 'flex', 
      gap: '8px', 
      alignItems: 'center',
      backgroundColor: '#f1f5f9',
      borderRadius: '24px',
      padding: '6px',
      border: '1px solid #e2e8f0',
      transition: 'all 0.2s ease'
    },
    input: { 
      flex: 1, 
      padding: '12px 16px', 
      borderRadius: '18px', 
      border: 'none', 
      backgroundColor: 'transparent', 
      color: '#0f172a', 
      fontSize: '0.95rem', 
      outline: 'none',
      fontWeight: '400'
    },
    iconBtn: { 
      padding: '10px', 
      borderRadius: '50%', 
      backgroundColor: 'transparent', 
      color: '#64748b', 
      border: 'none', 
      cursor: 'pointer', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      transition: 'all 0.2s ease'
    },
    sendBtn: { 
      padding: '0 24px', 
      borderRadius: '18px', 
      backgroundColor: '#16a34a', 
      color: 'white', 
      border: 'none', 
      fontWeight: '600', 
      cursor: 'pointer', 
      height: '42px',
      fontSize: '0.9rem',
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 8px rgba(22, 163, 74, 0.2)'
    },
    filePreview: { 
      display: 'flex', 
      alignItems: 'center', 
      gap: '10px', 
      backgroundColor: '#eff6ff', 
      padding: '10px 16px', 
      borderRadius: '12px', 
      alignSelf: 'flex-start', 
      border: '1px solid #dbeafe'
    }
  };

  // Show loading spinner ONLY if auth/initial check is happening, 
  // NOT for message streaming (which uses the chat bubble loader)
  if (loading && messages.length === 0) {
       return (
      <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',     // Full viewport height
      width: '100%',
      backgroundColor: '#fefefeff' // Optional: Match your background
    }}>
      <TrophySpin color={["#ff0000", "#ffa500", "#ffff00", "#008000", "#0000ff", "#4b0082", "#ee82ee"]} size="small" text="LOADING" textColor={["#ff0000", "#ffa500", "#ffff00", "#008000", "#0000ff", "#4b0082", "#ee82ee"]}/>
    </div>);
    }
  return (
    <div style={styles.wrapper}>
      
      {/* --- SIDEBAR --- */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <Clock size={18} color="#16a34a" />
          <span>History</span>
        </div>
        
        <div style={styles.historyList}>
          {historyGroups.length === 0 && <div style={{color:'#94a3b8', fontSize:'0.85rem', padding: '0 8px'}}>No conversations yet</div>}
          
          {historyGroups.map(([date, msgs]) => (
            <div key={date} style={styles.dateGroup}>
              <div style={styles.dateLabel}>{date}</div>
              {msgs.filter(m => m.role === 'user').map((msg, idx) => (
                <div 
                  key={idx} 
                  style={styles.historyItem} 
                  title={msg.text}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  • {msg.text.substring(0, 35)}{msg.text.length > 35 ? '...' : ''}
                </div>
              ))}
            </div>
          ))}
        </div>

        <button 
          onClick={clearHistory} 
          style={{
            ...styles.historyItem, 
            color: '#ef4444', 
            marginTop: 'auto', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            fontWeight: '500'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Trash2 size={16} /> Clear History
        </button>
      </div>

      {/* --- MAIN CHAT --- */}
      <div style={styles.main}>
        <div style={styles.chatWindow}>
            {(!messages || messages.length === 0) && (
                <div style={{textAlign: 'center', marginTop: '120px'}}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      margin: '0 auto 24px',
                      backgroundColor: '#eff6ff',
                      borderRadius: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Sparkles size={40} color="#16a34a" />
                    </div>
                    <h2 style={{
                      fontSize: '1.5rem',
                      fontWeight: '600',
                      color: '#0f172a',
                      marginBottom: '8px'
                    }}>Nexus AI Assistant</h2>
                    <p style={{
                      color: '#64748b',
                      fontSize: '0.95rem'
                    }}>Connected to your dashboard data</p>
                </div>
            )}

            {Array.isArray(messages) && messages.map((msg, index) => (
                <div key={index} style={styles.bubbleContainer(msg.role)}>
                    <div style={styles.bubble(msg.role)}>
                        <ReactMarkdown 
                            children={msg.text} 
                            remarkPlugins={[remarkGfm]}
                            components={{
                                p: ({node, ...props}) => <p style={{margin: 0}} {...props} />,
                                img: ({node, ...props}) => <img style={{maxWidth: '100%', borderRadius: '8px', marginTop: '8px'}} {...props} />,
                                code: ({node, inline, className, children, ...props}) => (
                                    inline ? 
                                    <code style={{
                                      backgroundColor: msg.role === 'user' ? 'rgba(255,255,255,0.2)' : '#f1f5f9', 
                                      padding: '2px 6px', 
                                      borderRadius: '4px',
                                      fontSize: '0.9em'
                                    }} {...props}>{children}</code> :
                                    <code style={{
                                      display: 'block',
                                      backgroundColor: msg.role === 'user' ? 'rgba(255,255,255,0.15)' : '#f8fafc',
                                      padding: '12px',
                                      borderRadius: '8px',
                                      marginTop: '8px',
                                      overflowX: 'auto'
                                    }} {...props}>{children}</code>
                                )
                            }}
                        />
                    </div>
                    <span style={styles.timestamp}>
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                    </span>
                </div>
            ))}
            
            {loading && (
                <div style={styles.bubbleContainer('model')}>
                    <div style={{...styles.bubble('model'), display: 'flex', gap: '6px', alignItems: 'center'}}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#94a3b8',
                          animation: 'pulse 1.4s ease-in-out infinite'
                        }}/>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#94a3b8',
                          animation: 'pulse 1.4s ease-in-out 0.2s infinite'
                        }}/>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#94a3b8',
                          animation: 'pulse 1.4s ease-in-out 0.4s infinite'
                        }}/>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div style={styles.inputWrapper}>
            {selectedFile && (
                <div style={styles.filePreview}>
                    <FileText size={18} color="#16a34a" />
                    <span style={{color: '#0f172a', fontSize: '0.875rem', fontWeight: '500'}}>{selectedFile.name}</span>
                    <button 
                      type="button" 
                      onClick={clearFile} 
                      style={{
                        background:'none', 
                        border:'none', 
                        color:'#64748b', 
                        cursor:'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <X size={16}/>
                    </button>
                </div>
            )}

            <div 
              style={styles.inputContainer}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
            >
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    style={{display: 'none'}} 
                    accept="image/*,application/pdf,text/*"
                />
                
                <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    style={styles.iconBtn}
                    title="Attach file"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e2e8f0';
                      e.currentTarget.style.color = '#475569';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#64748b';
                    }}
                >
                    <Paperclip size={20} />
                </button>

                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={selectedFile ? "Add a message about this file..." : "Message Nexus AI..."}
                    style={styles.input}
                    disabled={loading}
                />
                <button 
                  type="button" 
                  disabled={loading || (!input.trim() && !selectedFile)} 
                  onClick={handleSend}
                  style={{
                    ...styles.sendBtn,
                    opacity: (loading || (!input.trim() && !selectedFile)) ? 0.5 : 1,
                    cursor: (loading || (!input.trim() && !selectedFile)) ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && (input.trim() || selectedFile)) {
                      e.currentTarget.style.backgroundColor = '#15803d';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#16a34a';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Send
                </button>
            </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AiView;