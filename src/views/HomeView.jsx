import React, {useEffect, useRef, useState} from 'react';
import {getWebSocketUrl} from '../api.jsx';
import {Calendar, CheckCircle, Folder, Mail, Plus, RefreshCw, Sparkles,} from 'lucide-react';
import {TrophySpin} from 'react-loading-indicators';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const timeOfDayGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
};

const formatEventTime = (event) => {
    if (event.time) return event.time;
    if (event.start_time) return event.start_time.slice(11, 16);
    if (event.start_raw) return event.start_raw.slice(11, 16);
    return '';
};

const taskPriorityLabel = (priority) => {
    switch (priority) {
        case 4:
            return 'Urgent';
        case 3:
            return 'High';
        case 2:
            return 'Medium';
        case 1:
            return 'Low';
        default:
            return 'Normal';
    }
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatCard = ({icon: IconComponent, label, value, color}) => (
    <div style={styles.statCard}>
        <div style={styles.statHeader}>
            <div style={{...styles.statIcon, background: color + '15'}}>
                {React.createElement(IconComponent, {size: 18, style: {color}})}
            </div>
            <span style={styles.statTrend}>&rarr;</span>
        </div>
        <p style={styles.statLabel}>{label}</p>
        <span style={styles.statValue}>{value}</span>
    </div>
);

const BriefingCard = ({briefing, briefingError, briefingLoading, regenerateBriefing}) => {
    return (
        <div style={styles.card}>
            <div style={styles.cardHeader}>
                <div style={styles.cardTitleRow}>
                    <Sparkles size={18} style={{color: '#15803d', marginRight: 8}}/>
                    <span style={styles.cardTitle}>AI Daily Briefing</span>
                </div>
                <button
                    onClick={regenerateBriefing}
                    disabled={briefingLoading}
                    style={styles.refreshBtn}
                    title="Regenerate briefing"
                >
                    <RefreshCw size={14} style={{animation: briefingLoading ? 'spin 1s linear infinite' : 'none'}}/>
                </button>
            </div>
            {briefingLoading && (
                <div style={styles.loadingCenter}>
                    <TrophySpin size="small" text="Generating briefing..."/>
                </div>
            )}
            {briefingError && !briefing && (
                <div style={styles.emptyState}>
                    <p style={{color: '#dc2626', fontSize: '0.9rem', marginBottom: 10}}>AI briefing unavailable</p>
                    <p style={styles.muted}>The AI assistant could not be reached. Try again later or open the AI
                        Assistant from Quick Actions.</p>
                </div>
            )}
            {briefing && (
                <div style={styles.briefingText}>{briefing}</div>
            )}
            {!briefing && !briefingError && !briefingLoading && (
                <button onClick={regenerateBriefing} style={styles.generateBtn}>
                    <Sparkles size={16} style={{marginRight: 6}}/> Generate daily briefing
                </button>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HomeView({
                                     events = [],
                                     tasks = [],
                                     emails = [],
                                     projects,
                                     setActiveView,
                                     refreshData,
                                     systemVitals,
                                 }) {
    const [userName] = useState(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return '';
        try {
            const parsed = JSON.parse(storedUser);
            return parsed.name || parsed.email || '';
        } catch {
            return '';
        }
    });

    // Aggregated counts
    const safeEvents = Array.isArray(events) ? events : [];
    const totalEvents = safeEvents.reduce((sum, group) => sum + (Array.isArray(group.events) ? group.events.length : 0), 0);

    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const safeEmails = Array.isArray(emails) ? emails : [];
    const unreadEmails = safeEmails.filter((e) => e.labels && e.labels.includes('UNREAD'));

    const safeProjects = Array.isArray(projects) ? projects : (projects && projects.projects ? projects.projects : []);

    // Today's schedule: next 5 events across all date groups
    const todayEvents = safeEvents
        .flatMap((group) => (Array.isArray(group.events) ? group.events : []))
        .slice(0, 5);

    // Recent tasks: 5
    const recentTasks = safeTasks.slice(0, 5);

    // Recent unread emails: 5
    const recentUnreadEmails = unreadEmails.slice(0, 5);

    // Recent projects: 5
    const recentProjects = safeProjects.slice(0, 5);

    // AI briefing state
    const [briefing, setBriefing] = useState(null);
    const [briefingLoading, setBriefingLoading] = useState(false);
    const [briefingError, setBriefingError] = useState(null);
    const wsRef = useRef(null);

    const generateBriefing = () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setBriefingError('Not authenticated');
            return;
        }
        setBriefingLoading(true);
        setBriefingError(null);
        setBriefing(null);

        // Build a summary of the user's day to send to the AI
        const summaryParts = [];
        if (totalEvents > 0) summaryParts.push(`${totalEvents} event(s) on your calendar today`);
        if (safeTasks.length > 0) summaryParts.push(`${safeTasks.length} task(s) in your list`);
        if (unreadEmails.length > 0) summaryParts.push(`${unreadEmails.length} unread email(s)`);
        if (safeProjects.length > 0) summaryParts.push(`${safeProjects.length} active project(s)`);
        const daySummary = summaryParts.length > 0 ? summaryParts.join(', ') : 'a relatively light day';
        const prompt = `Write a short, friendly daily briefing (2-4 sentences) based on my day: ${daySummary}. Include a gentle prioritization suggestion. Keep it encouraging and concise.`;

        try {
            const socket = new WebSocket(getWebSocketUrl('/dashboard/gemini/stream', token));
            wsRef.current = socket;

            let assistantText = '';
            let started = false;

            socket.onopen = () => {
                socket.send(JSON.stringify({prompt}));
            };

            socket.onmessage = (event) => {
                let data;
                try {
                    data = JSON.parse(event.data);
                } catch {
                    return;
                }
                if (data.type === 'start') {
                    started = true;
                    assistantText = '';
                } else if (data.type === 'chunk') {
                    assistantText += data.text || '';
                } else if (data.type === 'done') {
                    setBriefing(assistantText || 'No briefing was returned.');
                    setBriefingLoading(false);
                    socket.close();
                } else if (data.type === 'error') {
                    setBriefingError(data.message || 'The AI assistant failed to respond.');
                    setBriefingLoading(false);
                    socket.close();
                }
            };

            socket.onerror = () => {
                setBriefingError('Could not connect to the AI assistant.');
                setBriefingLoading(false);
            };

            socket.onclose = () => {
                if (wsRef.current === socket) wsRef.current = null;
                if (!started && !briefingError) {
                    setBriefingError('The AI assistant is unavailable right now.');
                    setBriefingLoading(false);
                }
            };

            // Timeout safety net
            setTimeout(() => {
                if (briefingLoading) {
                    socket.close();
                    setBriefingLoading(false);
                    if (!briefing) setBriefingError('The AI assistant took too long to respond.');
                }
            }, 15000);
        } catch {
            setBriefingError('The AI assistant is unavailable.');
            setBriefingLoading(false);
        }
    };

    // Keep the latest generateBriefing in a ref so the effect below only
    // re-runs when the underlying data changes, not on every render.
    const generateBriefingRef = useRef(generateBriefing);
    useEffect(() => {
        generateBriefingRef.current = generateBriefing;
    });

    useEffect(() => {
        // Generate briefing once when data loads
        generateBriefingRef.current();
        return () => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.close();
            }
        };
    }, [totalEvents, safeTasks.length, unreadEmails.length, safeProjects.length]);

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.titleContainer}>
                    <h1 style={styles.h1}>{timeOfDayGreeting()}, {userName || 'there'}!</h1>
                    <p style={styles.sub}>
                        Here is your personal dashboard for {new Date().toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                    })}.
                    </p>
                </div>
                <div style={styles.headerActions}>
                    <button
                        onClick={refreshData}
                        disabled={false}
                        style={styles.refreshBtn}
                    >
                        <RefreshCw size={16}/> Refresh
                    </button>
                </div>
            </div>

            {/* Productivity Cards */}
            <div style={styles.cardsGrid}>
                <StatCard
                    icon={CheckCircle}
                    label="Today's Tasks"
                    value={safeTasks.length}
                    color="#16a34a"
                />
                <StatCard
                    icon={Calendar}
                    label="Upcoming Events"
                    value={totalEvents}
                    color="#15803d"
                />
                <StatCard
                    icon={Mail}
                    label="Unread Emails"
                    value={unreadEmails.length}
                    color="#2563eb"
                />
                <StatCard
                    icon={Folder}
                    label="Active Projects"
                    value={safeProjects.length}
                    color="#8b5cf6"
                />
            </div>

            <div style={styles.bodyGrid}>
                {/* Left column: Schedule + Tasks */}
                <div style={styles.leftCol}>
                    {/* Today's Schedule */}
                    <div style={styles.card}>
                        <div style={styles.cardHeader}>
                            <div style={styles.cardTitleRow}>
                                <Calendar size={18} style={{color: '#15803d', marginRight: 8}}/>
                                <span style={styles.cardTitle}>Today's Schedule</span>
                            </div>
                            <button
                                onClick={() => setActiveView && setActiveView('calendar')}
                                disabled={!setActiveView}
                                style={styles.viewAllBtn}
                            >
                                View all
                            </button>
                        </div>
                        {todayEvents.length > 0 ? (
                            <div style={styles.list}>
                                {todayEvents.map((event, idx) => (
                                    <div key={idx} style={styles.listItem}>
                                        <div style={styles.listTime}>{formatEventTime(event)}</div>
                                        <div
                                            style={styles.listTitle}>{event.title || event.summary || 'Untitled event'}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={styles.emptyState}>
                                <p style={styles.muted}>No events scheduled for today.</p>
                            </div>
                        )}
                    </div>

                    {/* Task Overview */}
                    <div style={{...styles.card, marginTop: '20px'}}>
                        <div style={styles.cardHeader}>
                            <div style={styles.cardTitleRow}>
                                <CheckCircle size={18} style={{color: '#16a34a', marginRight: 8}}/>
                                <span style={styles.cardTitle}>Task Overview</span>
                            </div>
                            <button
                                onClick={() => setActiveView && setActiveView('tasks')}
                                disabled={!setActiveView}
                                style={styles.viewAllBtn}
                            >
                                View all
                            </button>
                        </div>
                        {recentTasks.length > 0 ? (
                            <div style={styles.list}>
                                {recentTasks.map((task) => {
                                    const priority = task.priority;
                                    const isHigh = priority === 3 || priority === 4;
                                    return (
                                        <div key={task.id || task.content} style={styles.taskItem}>
                                            <div style={{flex: 1}}>
                                                <div style={styles.taskTitle}>{task.content}</div>
                                                <div style={styles.taskMeta}>
                                                    {task.due && task.due.date && (
                                                        <span style={styles.dueTag}>{task.due.date}</span>
                                                    )}
                                                    <span
                                                        style={{
                                                            ...styles.priorityTag,
                                                            background: isHigh ? '#fee2e2' : '#eff6ff',
                                                            color: isHigh ? '#dc2626' : '#15803d',
                                                        }}
                                                    >
                                                        {taskPriorityLabel(priority)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={styles.taskDone}>
                                                <CheckCircle size={16} color="#cbd5e1"/>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={styles.emptyState}>
                                <p style={styles.muted}>No tasks found.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right column: Emails + Projects + AI Briefing */}
                <div style={styles.rightCol}>
                    {/* Gmail Overview */}
                    <div style={styles.card}>
                        <div style={styles.cardHeader}>
                            <div style={styles.cardTitleRow}>
                                <Mail size={18} style={{color: '#2563eb', marginRight: 8}}/>
                                <span style={styles.cardTitle}>Gmail Overview</span>
                            </div>
                            <button
                                onClick={() => setActiveView && setActiveView('emails')}
                                disabled={!setActiveView}
                                style={styles.viewAllBtn}
                            >
                                View all
                            </button>
                        </div>
                        {recentUnreadEmails.length > 0 ? (
                            <div style={styles.list}>
                                {recentUnreadEmails.map((email) => (
                                    <div key={email.id || email.subject} style={styles.listItem}>
                                        <div style={{flex: 1}}>
                                            <div style={styles.listTitle}>{email.subject || '(No subject)'}</div>
                                            <div style={styles.listMeta}>{email.sender || 'Unknown sender'}</div>
                                        </div>
                                        <div style={styles.listUnread}>
                                            <span style={{
                                                display: 'inline-block',
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: '#2563eb'
                                            }}/>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={styles.emptyState}>
                                <p style={styles.muted}>No unread emails.</p>
                            </div>
                        )}
                    </div>

                    {/* Project Overview */}
                    <div style={{...styles.card, marginTop: '20px'}}>
                        <div style={styles.cardHeader}>
                            <div style={styles.cardTitleRow}>
                                <Folder size={18} style={{color: '#8b5cf6', marginRight: 8}}/>
                                <span style={styles.cardTitle}>Project Overview</span>
                            </div>
                            <button
                                onClick={() => setActiveView && setActiveView('projects')}
                                disabled={!setActiveView}
                                style={styles.viewAllBtn}
                            >
                                View all
                            </button>
                        </div>
                        {recentProjects.length > 0 ? (
                            <div style={styles.list}>
                                {recentProjects.map((project) => (
                                    <div key={project.id || project.name} style={styles.projectItem}>
                                        <div style={{flex: 1}}>
                                            <div style={styles.projectTitle}>{project.name || 'Untitled project'}</div>
                                            <div style={styles.progressContainer}>
                                                <div
                                                    style={{
                                                        ...styles.progressBar,
                                                        width: `${Math.min(100, Math.max(0, project.progress || 0))}%`,
                                                        backgroundColor: project.progress >= 70 ? '#16a34a' : project.progress >= 30 ? '#eab308' : '#ef4444',
                                                    }}
                                                />
                                            </div>
                                            <div style={styles.projectProgressText}>
                                                {project.progress || 0}% Complete
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={styles.emptyState}>
                                <p style={styles.muted}>No projects found.</p>
                            </div>
                        )}
                    </div>

                    {/* AI Daily Briefing */}
                    <div style={{...styles.card, marginTop: '20px'}}>
                        <BriefingCard
                            briefing={briefing}
                            briefingError={briefingError}
                            briefingLoading={briefingLoading}
                            regenerateBriefing={generateBriefing}
                        />
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{...styles.card, marginTop: '24px'}}>
                <div style={styles.cardHeader}>
                    <div style={styles.cardTitleRow}>
                        <Sparkles size={18} style={{color: '#15803d', marginRight: 8}}/>
                        <span style={styles.cardTitle}>Quick Actions</span>
                    </div>
                </div>
                <div style={styles.actionsGrid}>
                    <button
                        onClick={() => setActiveView && setActiveView('tasks')}
                        disabled={!setActiveView}
                        style={styles.actionBtn}
                    >
                        <Plus size={16} style={{marginRight: 8}}/>
                        Add Task
                    </button>
                    <button
                        onClick={() => setActiveView && setActiveView('calendar')}
                        disabled={!setActiveView}
                        style={styles.actionBtn}
                    >
                        <Calendar size={16} style={{marginRight: 8}}/>
                        Add Event
                    </button>
                    <button
                        onClick={() => setActiveView && setActiveView('emails')}
                        disabled={!setActiveView}
                        style={styles.actionBtn}
                    >
                        <Mail size={16} style={{marginRight: 8}}/>
                        View All Emails
                    </button>
                    <button
                        onClick={() => setActiveView && setActiveView('projects')}
                        disabled={!setActiveView}
                        style={styles.actionBtn}
                    >
                        <Folder size={16} style={{marginRight: 8}}/>
                        View Projects
                    </button>
                    <button
                        onClick={() => setActiveView && setActiveView('AI')}
                        disabled={!setActiveView}
                        style={styles.actionBtn}
                    >
                        <Sparkles size={16} style={{marginRight: 8}}/>
                        Open AI Assistant
                    </button>
                    <button
                        onClick={refreshData}
                        style={styles.actionBtn}
                    >
                        <RefreshCw size={16} style={{marginRight: 8}}/>
                        Refresh
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
    container: {
        minHeight: '100vh',
        background: 'var(--bg-main)',
        color: 'var(--text-main)',
        fontFamily: 'inherit',
        padding: '0 0 40px 0',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '28px',
        padding: '20px 24px 0 24px',
        flexWrap: 'wrap',
        gap: '16px',
    },
    titleContainer: {
        flex: 1,
        minWidth: '280px',
    },
    h1: {
        fontSize: '1.75rem',
        fontWeight: '800',
        margin: '0 0 6px 0',
        color: 'var(--text-main)',
        letterSpacing: '-0.01em',
    },
    sub: {
        color: 'var(--text-muted)',
        fontSize: '1rem',
        margin: 0,
    },
    headerActions: {
        display: 'flex',
        gap: '8px',
        flexShrink: 0,
    },
    refreshBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        border: '1px solid #d1d1d6',
        color: 'var(--text-main)',
        padding: '8px 14px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.9rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    cardsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '16px',
        margin: '0 24px 28px 24px',
    },
    statCard: {
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        boxShadow: 'var(--shadow-subtle)',
        border: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    statHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    statIcon: {
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statTrend: {
        marginLeft: 'auto',
        fontSize: '1.5rem',
        color: '#e0e0e0',
        lineHeight: 1,
    },
    statLabel: {
        fontSize: '0.85rem',
        fontWeight: '600',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        margin: 0,
    },
    statValue: {
        fontSize: '2rem',
        fontWeight: '800',
        color: 'var(--text-main)',
        margin: 0,
    },
    bodyGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: '24px',
        padding: '0 24px',
        alignItems: 'start',
    },
    leftCol: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    rightCol: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    card: {
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        padding: '0',
        boxShadow: 'var(--shadow-subtle)',
        border: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '18px 20px',
        borderBottom: '1px solid #f0f0f0',
    },
    cardTitleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    cardTitle: {
        fontSize: '1.1rem',
        fontWeight: '700',
        color: 'var(--text-main)',
        margin: 0,
    },
    viewAllBtn: {
        background: 'transparent',
        border: 'none',
        color: '#15803d',
        fontSize: '0.85rem',
        fontWeight: '600',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: 'var(--radius-sm)',
        transition: 'background 0.2s ease',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '16px 20px',
    },
    listItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px',
        borderRadius: 'var(--radius-sm)',
        background: '#fcfcfc',
        border: '1px solid #f0f0f0',
    },
    listTime: {
        fontSize: '0.85rem',
        fontWeight: '700',
        color: '#15803d',
        minWidth: '55px',
    },
    listTitle: {
        fontSize: '0.95rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        margin: '0 0 2px 0',
    },
    listMeta: {
        fontSize: '0.85rem',
        color: 'var(--text-muted)',
        margin: 0,
    },
    listUnread: {
        flexShrink: 0,
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px',
        color: 'var(--text-muted)',
        textAlign: 'center',
    },
    muted: {
        color: 'var(--text-muted)',
        fontSize: '0.95rem',
        margin: 0,
    },
    loadingCenter: {
        display: 'flex',
        justifyContent: 'center',
        padding: '24px',
    },
    taskItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderRadius: 'var(--radius-sm)',
        background: '#fcfcfc',
        border: '1px solid #f0f0f0',
    },
    taskTitle: {
        fontSize: '0.95rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        margin: '0 0 4px 0',
    },
    taskMeta: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
    },
    dueTag: {
        fontSize: '0.75rem',
        fontWeight: '600',
        color: '#15803d',
        background: '#f0fdf4',
        padding: '2px 8px',
        borderRadius: '4px',
    },
    priorityTag: {
        fontSize: '0.75rem',
        fontWeight: '600',
        padding: '2px 8px',
        borderRadius: '4px',
    },
    taskDone: {
        flexShrink: 0,
    },
    projectItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px',
        borderRadius: 'var(--radius-sm)',
        background: '#fcfcfc',
        border: '1px solid #f0f0f0',
    },
    projectTitle: {
        fontSize: '0.95rem',
        fontWeight: '600',
        color: 'var(--text-main)',
        margin: '0 0 8px 0',
    },
    progressContainer: {
        width: '100%',
        height: '6px',
        background: '#e0e0e0',
        borderRadius: '3px',
        overflow: 'hidden',
        marginBottom: '4px',
    },
    progressBar: {
        height: '100%',
        borderRadius: '3px',
        transition: 'width 0.3s ease',
    },
    projectProgressText: {
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        fontWeight: '600',
        margin: 0,
    },
    briefingText: {
        fontSize: '0.95rem',
        color: 'var(--text-main)',
        lineHeight: '1.6',
        padding: '16px 20px',
        whiteSpace: 'pre-wrap',
    },
    generateBtn: {
        margin: '0 20px 20px 20px',
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        color: '#15803d',
        padding: '10px 16px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.9rem',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        width: 'fit-content',
        transition: 'all 0.2s ease',
    },
    actionsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px',
        padding: '16px 20px 20px 20px',
    },
    actionBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--bg-card)',
        border: '1px solid #e0e0e0',
        color: 'var(--text-main)',
        padding: '12px 14px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.9rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        width: '100%',
        justifyContent: 'flex-start',
    },
};
