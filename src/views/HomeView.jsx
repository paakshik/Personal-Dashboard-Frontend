import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
    Bot,
    BrainCircuit,
    Calendar,
    CheckCircle,
    ChevronDown,
    Folder,
    Globe,
    Mail,
    MessageSquare,
    Plus,
    RefreshCw,
    Sparkles
} from 'lucide-react';
import {fetchBriefing} from '../api.jsx';

const timeOfDayGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
};

const formatEventTime = (event) => event.time || event.start_time?.slice(11, 16) || event.start_raw?.slice(11, 16) || '';
const taskPriorityLabel = (priority) => ({4: 'Urgent', 3: 'High', 2: 'Medium', 1: 'Low'}[priority] || 'Normal');

const AI_ASSISTANTS = [
    {name: 'Gemini', url: 'https://gemini.google.com', icon: Sparkles, color: '#2563eb'},
    {name: 'ChatGPT', url: 'https://chatgpt.com', icon: MessageSquare, color: '#059669'},
    {name: 'Claude', url: 'https://claude.ai', icon: BrainCircuit, color: '#ea580c'},
    {name: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: Bot, color: '#123b70'},
    {name: 'Perplexity', url: 'https://www.perplexity.ai', icon: Globe, color: '#0d9488'},
];

function SummaryCard({icon: Icon, label, value, color, onClick}) {
    return (
        <button className="home-summary" onClick={onClick} type="button"
                aria-label={`${label}: ${value}. Expand section`}>
            <span className="home-summary-icon" style={{color}}><Icon size={18}/></span>
            <span className="home-summary-label">{label}</span>
            <strong className="home-summary-value">{value}</strong>
            <ChevronDown size={16} className="home-summary-chevron"/>
        </button>
    );
}

function AccordionSection({id, title, icon: Icon, count, expanded, onToggle, onViewAll, children}) {
    return (
        <section className="home-section">
            <button className="home-section-trigger" type="button" aria-expanded={expanded}
                    aria-controls={`home-panel-${id}`} onClick={onToggle}>
                <span className="home-section-heading"><Icon size={18}/><span>{title}</span></span>
                <span className="home-section-meta">{count}</span>
                {onViewAll && <span className="home-section-view" onClick={(event) => {
                    event.stopPropagation();
                    onViewAll();
                }}>View all</span>}
                <ChevronDown size={17} className={`home-section-chevron${expanded ? ' is-open' : ''}`}/>
            </button>
            {expanded && <div className="home-section-content" id={`home-panel-${id}`}>{children}</div>}
        </section>
    );
}

export default function HomeView({events = [], tasks = [], emails = [], projects, setActiveView, refreshData}) {
    const [userName] = useState(() => {
        try {
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            return storedUser.name || storedUser.email || '';
        } catch {
            return '';
        }
    });
    const safeEvents = Array.isArray(events) ? events : [];
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const safeEmails = Array.isArray(emails) ? emails : [];
    const safeProjects = Array.isArray(projects) ? projects : (Array.isArray(projects?.projects) ? projects.projects : []);
    const unreadEmails = safeEmails.filter((email) => email.labels?.includes('UNREAD'));
    const schedule = safeEvents.flatMap((group) => Array.isArray(group.events) ? group.events : []).slice(0, 8);
    const [expandedSection, setExpandedSection] = useState(null);
    const [briefing, setBriefing] = useState('');
    const [briefingLoading, setBriefingLoading] = useState(false);
    const [briefingError, setBriefingError] = useState('');

    const generateBriefing = useCallback(async () => {
        setBriefingLoading(true);
        setBriefingError('');
        try {
            const result = await fetchBriefing();
            setBriefing(result?.briefing || 'No briefing was returned.');
        } catch (error) {
            setBriefingError(error?.response?.data?.detail || error?.message || 'The AI assistant could not be reached.');
        } finally {
            setBriefingLoading(false);
        }
    }, []);

    useEffect(() => {
        if (expandedSection === 'briefing' && !briefing && !briefingError && !briefingLoading) void generateBriefing();
    }, [expandedSection, briefing, briefingError, briefingLoading, generateBriefing]);

    const sections = useMemo(() => [
        {id: 'schedule', title: "Today's schedule", icon: Calendar, count: schedule.length, view: 'calendar'},
        {id: 'tasks', title: 'Tasks', icon: CheckCircle, count: safeTasks.length, view: 'tasks'},
        {id: 'emails', title: 'Unread email', icon: Mail, count: unreadEmails.length, view: 'emails'},
        {id: 'projects', title: 'Projects', icon: Folder, count: safeProjects.length, view: 'projects'},
        {id: 'briefing', title: 'AI daily briefing', icon: Sparkles, count: briefing ? 'Ready' : 'On demand'},
    ], [schedule.length, safeTasks.length, unreadEmails.length, safeProjects.length, briefing]);

    const openView = (view) => setActiveView?.(view);
    const toggleSection = (id) => setExpandedSection((current) => current === id ? null : id);

    return (
        <div className="home-dashboard">
            <style>{`
                .home-dashboard{--home-border:#e8ebef;--home-muted:#697586;--home-ink:#172033;color:var(--home-ink);padding:clamp(12px,2vw,28px);max-width:1500px;margin:0 auto}
                .home-dashboard *{box-sizing:border-box}
                .home-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}
                .home-greeting{font-size:clamp(1.45rem,2.4vw,2rem);letter-spacing:-.04em;margin:0 0 5px;font-weight:750}
                .home-date{color:var(--home-muted);margin:0;font-size:.95rem}
                .home-refresh{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--home-border);background:#fff;border-radius:10px;padding:9px 13px;font-weight:600;cursor:pointer;color:inherit}
                .home-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px}
                .home-summary{display:grid;grid-template-columns:30px 1fr auto 16px;align-items:center;gap:10px;text-align:left;width:100%;border:1px solid var(--home-border);background:#fff;border-radius:12px;padding:14px;cursor:pointer;min-width:0;transition:border-color .15s,box-shadow .15s}
                .home-summary:hover,.home-section-trigger:hover{border-color:#c7d2e1;box-shadow:0 2px 8px #1822300b}
                .home-summary-icon{display:grid;place-items:center;width:30px;height:30px;background:#f5f7fa;border-radius:9px}
                .home-summary-label{font-size:.83rem;color:var(--home-muted);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                .home-summary-value{font-size:1.2rem;font-variant-numeric:tabular-nums}
                .home-summary-chevron,.home-section-chevron{color:#98a2b3;transition:transform .15s}
                .home-compact-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(270px,.62fr);gap:16px;align-items:start}
                .home-section-list{display:grid;gap:8px}
                .home-section{background:#fff;border:1px solid var(--home-border);border-radius:12px;overflow:hidden}
                .home-section-trigger{display:flex;align-items:center;gap:12px;width:100%;min-height:54px;border:0;background:#fff;padding:12px 15px;text-align:left;cursor:pointer;color:inherit}
                .home-section-heading{display:flex;align-items:center;gap:10px;min-width:0;flex:1;font-size:.91rem;font-weight:650}
                .home-section-heading svg{color:#24834c;flex-shrink:0}
                .home-section-meta{font-size:.78rem;color:var(--home-muted);background:#f4f6f8;padding:3px 8px;border-radius:20px;white-space:nowrap}
                .home-section-view{color:#168045;font-size:.8rem;font-weight:600;white-space:nowrap}
                .home-section-chevron.is-open{transform:rotate(180deg)}
                .home-section-content{padding:2px 15px 14px;border-top:1px solid #f0f2f5}
                .home-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 2px;border-bottom:1px solid #f0f2f5}
                .home-row:last-child{border-bottom:0}
                .home-row-main{min-width:0;flex:1}
                .home-row-title{font-size:.88rem;font-weight:600;overflow-wrap:anywhere}
                .home-row-meta{font-size:.77rem;color:var(--home-muted);margin-top:3px}
                .home-empty{padding:15px 2px;color:var(--home-muted);font-size:.85rem}
                .home-chip{font-size:.72rem;background:#f2f5f8;color:#465468;border-radius:99px;padding:3px 8px;white-space:nowrap}
                .home-assistant-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding-top:12px}
                .home-assistant{display:flex;align-items:center;gap:8px;min-height:42px;padding:9px 10px;border:1px solid var(--home-border);border-radius:9px;text-decoration:none;color:inherit;font-size:.82rem;font-weight:600;background:#fff;transition:background .15s,border-color .15s}
                .home-assistant:hover{background:#f8fafb;border-color:#cbd5e1}
                .home-assistant svg{color:var(--assistant-color);flex-shrink:0}
                .home-briefing{font-size:.88rem;line-height:1.6;white-space:pre-wrap;padding:12px 0 2px}
                .home-briefing-error{color:#b42318;font-size:.84rem;padding:12px 0 2px}
                .home-mini-button{border:1px solid var(--home-border);background:#fff;border-radius:8px;padding:7px 10px;cursor:pointer;font-size:.8rem;font-weight:600}
                .home-quick{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
                .home-quick button{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--home-border);background:#fff;padding:9px 12px;border-radius:9px;cursor:pointer;color:inherit;font-size:.82rem;font-weight:600}
                .home-quick button:hover{background:#f8fafb}
                @media(max-width:900px){.home-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.home-compact-grid{grid-template-columns:1fr}}
                @media(max-width:520px){.home-dashboard{padding:12px}.home-top{align-items:flex-start}.home-summary{grid-template-columns:28px minmax(0,1fr) auto 14px;gap:7px;padding:11px 9px}.home-summary-label{font-size:.73rem}.home-summary-value{font-size:1.05rem}.home-section-trigger{gap:8px;padding:11px}.home-section-view{font-size:.73rem}}
            `}</style>

            <header className="home-top">
                <div>
                    <h1 className="home-greeting">{timeOfDayGreeting()}, {userName || 'there'}!</h1>
                    <p className="home-date">{new Date().toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                    })}</p>
                </div>
                <button className="home-refresh" type="button" onClick={refreshData}><RefreshCw size={15}/> Refresh
                </button>
            </header>

            <div className="home-summary-grid" aria-label="Daily summary">
                <SummaryCard icon={CheckCircle} label="Tasks" value={safeTasks.length} color="#16834a"
                             onClick={() => toggleSection('tasks')}/>
                <SummaryCard icon={Calendar} label="Events" value={schedule.length} color="#16834a"
                             onClick={() => toggleSection('schedule')}/>
                <SummaryCard icon={Mail} label="Unread" value={unreadEmails.length} color="#2563eb"
                             onClick={() => toggleSection('emails')}/>
                <SummaryCard icon={Folder} label="Projects" value={safeProjects.length} color="#7c3aed"
                             onClick={() => toggleSection('projects')}/>
            </div>

            <div className="home-compact-grid">
                <div className="home-section-list">
                    {sections.map(({id, title, icon, count, view}) => (
                        <AccordionSection key={id} id={id} title={title} icon={icon} count={count}
                                          expanded={expandedSection === id}
                                          onToggle={() => toggleSection(id)}
                                          onViewAll={view ? () => openView(view) : null}>
                            {id === 'schedule' && (schedule.length ? schedule.map((event, index) => (
                                <div className="home-row" key={`${event.id || event.title || 'event'}-${index}`}><span
                                    className="home-row-meta">{formatEventTime(event)}</span><span
                                    className="home-row-title">{event.title || event.summary || 'Untitled event'}</span>
                                </div>
                            )) : <div className="home-empty">No events scheduled.</div>)}
                            {id === 'tasks' && (safeTasks.length ? safeTasks.slice(0, 12).map((task) => (
                                <div className="home-row" key={task.id || task.content}>
                                    <div className="home-row-main">
                                        <div className="home-row-title">{task.content || 'Untitled task'}</div>
                                        {task.due?.date && <div className="home-row-meta">Due {task.due.date}</div>}
                                    </div>
                                    <span className="home-chip">{taskPriorityLabel(task.priority)}</span></div>
                            )) : <div className="home-empty">No tasks found.</div>)}
                            {id === 'emails' && (unreadEmails.length ? unreadEmails.slice(0, 10).map((email) => (
                                <div className="home-row" key={email.id || email.subject}>
                                    <div className="home-row-main">
                                        <div className="home-row-title">{email.subject || '(No subject)'}</div>
                                        <div className="home-row-meta">{email.sender || 'Unknown sender'}</div>
                                    </div>
                                </div>
                            )) : <div className="home-empty">No unread emails.</div>)}
                            {id === 'projects' && (safeProjects.length ? safeProjects.slice(0, 10).map((project) => (
                                <div className="home-row" key={project.id || project.name}>
                                    <div className="home-row-main">
                                        <div className="home-row-title">{project.name || 'Untitled project'}</div>
                                        <div className="home-row-meta">{project.progress || 0}% complete</div>
                                    </div>
                                    <span className="home-chip">{project.status || 'Active'}</span></div>
                            )) : <div className="home-empty">No projects found.</div>)}
                            {id === 'briefing' && <>
                                {briefingLoading &&
                                    <div className="home-empty" role="status">Preparing your briefing…</div>}
                                {briefingError &&
                                    <div className="home-briefing-error" role="alert">{briefingError}</div>}
                                {briefing && <div className="home-briefing">{briefing}</div>}
                                <button className="home-mini-button" type="button"
                                        onClick={() => void generateBriefing()}
                                        disabled={briefingLoading}>{briefing ? 'Refresh briefing' : 'Generate briefing'}</button>
                            </>}
                        </AccordionSection>
                    ))}
                </div>

                <section className="home-section" aria-label="AI Assistants">
                    <div className="home-section-trigger" style={{cursor: 'default'}}><span
                        className="home-section-heading"><Bot size={18}/><span>AI Assistants</span></span><span
                        className="home-section-meta">{AI_ASSISTANTS.length}</span></div>
                    <div className="home-section-content">
                        <div className="home-assistant-grid">
                            {AI_ASSISTANTS.map(({name, url, icon: Icon, color}) => (
                                <a className="home-assistant" href={url} target="_blank" rel="noopener noreferrer"
                                   key={name} style={{'--assistant-color': color}}
                                   aria-label={`Open ${name} in a new tab`}><Icon size={17}/>{name}</a>
                            ))}
                        </div>
                    </div>
                </section>
            </div>

            <div className="home-quick" aria-label="Quick actions">
                <button type="button" onClick={() => openView('tasks')}><Plus size={15}/> Add task</button>
                <button type="button" onClick={() => openView('calendar')}><Calendar size={15}/> Add event</button>
                <button type="button" onClick={() => openView('emails')}><Mail size={15}/> View email</button>
                <button type="button" onClick={() => openView('AI')}><Sparkles size={15}/> Open AI Assistant</button>
            </div>
        </div>
    );
}
