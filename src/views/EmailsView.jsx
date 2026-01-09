
import { Mail, Star, Trash2, Tag, BookOpen, Calendar, X } from 'lucide-react'
import { useState } from 'react'
import axios from 'axios'
import { TrophySpin } from 'react-loading-indicators'
// --- 🎨 NEW LIGHT THEME STYLES ---

const fullPageStyle = {
    padding: '10px 0',
    minHeight: '100vh',
    background: 'var(--bg-main) ',
    fontFamily: 'inherit',
}

const getAuthConfig = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }
});
const markAsRead = async (messageId) => {
  try {
    await axios.post(
      `http://127.0.0.1:8000/dashboard/email/${messageId}/read`,
      {},
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return true;
  } catch (error) {
    console.error("❌ Error marking email as read:", error);
    return false;
  }
};


const fullPageHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    fontSize: '2rem',
    fontWeight: 700,
    color: 'var(--text-main)',
}

const sectionHeaderStyle = (color) => ({
    color: color, 
    paddingBottom: '5px', 
    marginBottom: '15px', 
    fontSize: '1.3rem', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px'
});

const itemStyle = {
    // Re-defined for light theme
    display: 'flex',
    alignItems: 'center',
    padding: '12px 10px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.95rem',
    transition: 'background-color 0.1s',
}

const emptyStyle = {
    color: 'var(--text-muted)',
    padding: '20px 0',
    textAlign: 'center',
    fontSize: '1.1rem',
}

const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Lighter overlay
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
}

const modalContentStyle = {
    // Light theme modal
    background: 'var(--bg-card)', 
    borderRadius: 'var(--radius-lg)',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    width: '85%',
    maxWidth: '1000px',
    height: '85%',
    maxHeight: '900px',
    overflowY: 'auto',
    position: 'relative',
    padding: '30px',
    border: '1px solid #ededed'
}

// --- 🛠️ HELPER FUNCTIONS (No change) ---

const formatDateKey = (timestamp) => {
    const date = new Date(parseInt(timestamp));
    return date.toISOString().split('T')[0];
}

const formatDateDisplay = (timestamp) => {
    const date = new Date(parseInt(timestamp));
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (date.toDateString() === now.toDateString()) return 'Today';
    
    const yesterday = new Date(now.getTime() - oneDay);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

const categorizeEmail = (e) => {
    if (!e.labels) return 'OTHER';
    if (e.labels.includes('SPAM') || e.labels.includes('TRASH')) return 'SPAM_OR_TRASH';
    if (e.labels.includes('STARRED')) return 'IMPORTANT';
    if (e.labels.includes('CATEGORY_SOCIAL')) return 'SOCIAL';
    if (e.labels.includes('CATEGORY_PROMOTIONS')) return 'PROMOTIONS';
    if (e.labels.includes('CATEGORY_UPDATES')) return 'UPDATES';
    if (e.labels.includes('CATEGORY_FORUMS')) return 'FORUMS';
    if (e.labels.includes('INBOX')) return 'PRIMARY';
    return 'OTHER';
}

const CATEGORY_MAP = {
    PRIMARY: { name: 'Primary (Inbox)', color: '#15803d', icon: <Mail size={20} /> },
    IMPORTANT: { name: 'Important (Starred)', color: '#FFD700', icon: <Star size={20} /> },
    SOCIAL: { name: 'Social', color: '#1E90FF', icon: <Tag size={20} /> },
    PROMOTIONS: { name: 'Promotions', color: '#8A2BE2', icon: <Tag size={20} /> },
    UPDATES: { name: 'Updates', color: '#20B2AA', icon: <Tag size={20} /> },
    FORUMS: { name: 'Forums', color: '#FFA500', icon: <Tag size={20} /> },
    SPAM_OR_TRASH: { name: 'Spam/Trash', color: '#FF4500', icon: <Trash2 size={20} /> },
    OTHER: { name: 'Other/Unclassified', color: '#808080', icon: <Tag size={20} /> },
};


// --- EMAIL READING MODAL COMPONENT (IMPROVED for Light Theme) ---

const EmailModal = ({ email, closeModal}) => {
    if (!email) return null;

    // This converts the body HTML string into an object React can render.
    const bodyHtml = { __html: email.body };

    const emailBodyCleanStyle = {
        padding: '20px', 
        backgroundColor: '#f9f9f9', // Light, subtle background for body
        borderRadius: '8px', 
        border: '1px solid #e0e0e0', 
        minHeight: '100px',
        color: 'var(--text-main)#15803d',
        lineHeight: '1.6', // Increased line height for better vertical flow
        fontSize: '1rem',
        overflow: 'auto', 
        // 🚀 CRITICAL IMPROVEMENT: Ensures long strings (like tracking codes) wrap
        wordBreak: 'break-word', 
        wordWrap: 'break-word', // Fallback for older browsers
        whiteSpace: 'pre-wrap', // Preserves formatting within the body content
        // 🚀 Added margins/padding reset for embedded content to breathe
        '& p, & div': {
            marginBottom: '10px', 
            marginTop: '10px',
        }
    };
    
    // Updated modalContentStyle to handle button hover
    const closeButtonStyle = { 
        position: 'absolute', 
        top: '15px', 
        right: '15px', 
        background: 'none', 
        border: 'none', 
        color: 'var(--text-muted)', 
        cursor: 'pointer', 
        zIndex: 10,
        transition: 'color 0.2s',
    };

    return (
        <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
                <button 
                    onClick={closeModal} 
                    style={closeButtonStyle}
                    onMouseOver={e => e.currentTarget.style.color = 'var(--text-main)'}
                    onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                    <X size={24} />
                </button>
                
                <h3 style={{ 
                    borderBottom: '1px solid #e0e0e0', 
                    paddingBottom: '10px', 
                    marginBottom: '15px', 
                    color: 'var(--text-main)', 
                    fontSize: '1.8rem',
                    fontWeight: 600, // Explicitly bold for the subject
                }}>
                    {email.subject}
                </h3>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                    <p style={{margin: 0}}><strong>From:</strong> {email.sender}</p>
                    <p style={{margin: 0}}><strong>Date:</strong> {email.date}</p>
                </div>
                
                <div 
                    dangerouslySetInnerHTML={bodyHtml} 
                    style={emailBodyCleanStyle} 
                />
            </div>
        </div>
    );
};

// --- EMAIL LIST COMPONENTS (Minimal changes for consistency) ---

const CategoryGroup = ({ emails, categoryKey, fetchEmailContent }) => {
    const { name, color, icon } = CATEGORY_MAP[categoryKey];
    
    return (
        <div style={{ 
            marginBottom: '10px', 
            paddingLeft: '15px', 
            backgroundColor: '#fcfcfc', // Very light background
            borderRadius: 'var(--radius-sm)',
            border: '1px solid #f0f0f0',
        }}>
            <h4 style={{ 
                ...sectionHeaderStyle(color), 
                fontSize: '1.1rem', 
                marginBottom: '5px', 
                paddingTop: '8px'
            }}>
                {icon} {name} ({emails.length})
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px', paddingBottom: '8px' }}>
                {emails.map(e => (
                    <div 
                        key={e.id} 
                        style={{
                            ...itemStyle,
                            // Unread is brighter white/light yellow
                            background: e.labels.includes('UNREAD') ? '#fffbe6' : 'transparent',
                            cursor: 'pointer',
                            borderLeft: `3px solid ${color}`, 
                            paddingLeft: '10px',
                            boxShadow: e.labels.includes('UNREAD') ? '0 1px 4px rgba(0,0,0,0.05)' : 'none',
                        }}
                        onClick={() => fetchEmailContent(e.id)}
                    >
                        <span style={{ 
                            fontWeight: e.labels.includes('UNREAD') ? '600' : '400',
                            color: 'var(--text-main)'
                        }}>
                            {e.subject}
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '10px' }}>
                                ({formatDateDisplay(e.internalDate)})
                            </span>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}


const EmailSection = ({ statusType, emails, fetchEmailContent }) => {
    
    const datedEmails = emails.reduce((acc, email) => {
        const dateKey = formatDateKey(email.internalDate);
        if (!acc[dateKey]) {
            acc[dateKey] = {
                display: formatDateDisplay(email.internalDate),
                emails: []
            };
        }
        acc[dateKey].emails.push(email);
        return acc;
    }, {});
    
    const sortedDateKeys = Object.keys(datedEmails).sort().reverse();

    return (
        <div style={{ 
            marginBottom: '40px', 
            padding: '20px', 
            background: 'var(--bg-card)', 
            borderRadius: 'var(--radius-lg)', 
            boxShadow: 'var(--shadow-subtle)',
            border: '1px solid #ededed',
        }}>
            
            <h3 style={{ 
                ...sectionHeaderStyle('var(--text-main)'), 
                marginBottom: '20px', 
                fontSize: '1.5rem',
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: '10px',
            }}>
                <BookOpen size={24} color={statusType === 'Unread' ? '#15803d' : 'var(--text-muted)'} style={{marginRight: '10px'}} />
                <span style={{color: statusType === 'Unread' ? '' : 'var(--text-main)'}}>
                    **{statusType} Mail** ({emails.length})
                </span>
            </h3>

            {emails.length === 0 ? (
                 <p style={emptyStyle}>No {statusType.toLowerCase()} mail found.</p>
            ) : (
                sortedDateKeys.map(dateKey => {
                    const dateGroup = datedEmails[dateKey];
                    const sortOrder = ['IMPORTANT', 'PRIMARY', 'SOCIAL', 'PROMOTIONS', 'UPDATES', 'FORUMS', 'OTHER', 'SPAM_OR_TRASH'];
                    
                    const categorized = dateGroup.emails.reduce((acc, email) => {
                        const category = categorizeEmail(email);
                        if (!acc[category]) {
                            acc[category] = [];
                        }
                        acc[category].push(email);
                        return acc;
                    }, {});
                    
                    return (
                        <div key={dateKey} style={{ 
                            marginBottom: '20px', 
                            padding: '10px', 
                            background: 'var(--bg-main)', // Group background
                            borderRadius: 'var(--radius-sm)', 
                            border: '1px solid #e0e0e0',
                        }}>
                            
                            <h4 style={{ 
                                ...sectionHeaderStyle('var(--text-main)'), 
                                paddingBottom: '5px', 
                                marginBottom: '10px',
                                fontSize: '1.2rem',
                                color: 'var(--text-main)' 
                            }}>
                                <Calendar size={18} color="var(--text-muted)" />
                                {dateGroup.display}
                            </h4>
                            
                            {sortOrder.map(categoryKey => {
                                const group = categorized[categoryKey];
                                if (!group || group.length === 0) return null;
                                
                                return (
                                    <CategoryGroup
                                        key={categoryKey}
                                        emails={group}
                                        categoryKey={categoryKey}
                                        fetchEmailContent={fetchEmailContent}
                                    />
                                );
                            })}
                        </div>
                    );
                })
            )}
        </div>
    );
}


// --- MAIN EMAILS VIEW COMPONENT (No change) ---

export default function EmailsView({ emails ,isLoading}) {
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [loadingContent, setLoadingContent] = useState(false);
const [localEmails, setLocalEmails] = useState(emails)
const fetchEmailContent = async (messageId) => {
  setLoadingContent(true);
  try {
    const res = await axios.get(
      `http://127.0.0.1:8000/dashboard/email/${messageId}`,
      getAuthConfig()
    );

    setSelectedEmail(res.data);

    const success = await markAsRead(messageId);

    if (success) {
      setLocalEmails(prev =>
        prev.map(email =>
          email.id === messageId
            ? {
                ...email,
                labels: email.labels.filter(label => label !== 'UNREAD')
              }
            : email
        )
      );
    }
  } catch (error) {
    console.error("Error fetching email content:", error);
  } finally {
    setLoadingContent(false);
  }
};

    const unreadEmails = localEmails.filter(e => e.labels && e.labels.includes('UNREAD'));
    const readEmails = localEmails.filter(e => 
        e.labels && 
        !e.labels.includes('UNREAD') && 
        !e.labels.includes('SPAM') && 
        !e.labels.includes('TRASH')
    );
    if (isLoading) {

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
        <>
            <div style={fullPageStyle}>
                <h2 style={fullPageHeaderStyle}>
                    <Mail size={30} color="#15803d " style={{ marginRight: '10px' }} />
                    Email View and Classification (Top {localEmails.length})
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '25px', fontSize: '1.1rem' }}>
                    Messages are classified by **Read Status**, then grouped by **Date**, and finally by **Gmail Category**. Click any email to read its content.
                </p>

                {loadingContent && <p style={{color: '#15803d', fontSize: '1.2rem', padding: '10px 0'}}>Loading email content...</p>}
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
                    
                    <EmailSection 
                        emails={unreadEmails} 
                        statusType="Unread"
                        fetchEmailContent={fetchEmailContent}
                    />

                    <EmailSection 
                        emails={readEmails} 
                        statusType="Read"
                        fetchEmailContent={fetchEmailContent}
                    />
                </div>
            </div>
            
            <EmailModal email={selectedEmail} closeModal={() => setSelectedEmail(null)} />
        </>
    )
}