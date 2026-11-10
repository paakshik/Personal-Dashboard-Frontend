import {useCallback, useEffect, useState} from 'react';
import './App.css';
import api from './api.jsx';
import Navbar from './components/Navbar.jsx';
import DashboardView from './views/dashboard.jsx';
import ProjectsDashboard from './views/ProjectDashboard.jsx';
import CommandNexus from './views/commandnexus.jsx';
import ScheduleView from './views/ScheduleView.jsx';
import TasksView from './views/TasksView.jsx';
import EmailsView from './views/EmailsView.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import AiView from './views/aiview.jsx';
import {TrophySpin} from 'react-loading-indicators';

function App() {
  const [user, setUser] = useState(null);
    const [activeView, setActiveView] = useState('dashboard');
    const [events, setEvents] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [emails, setEmails] = useState([]);
    const [projects, setProjects] = useState({projects: [], stats: {}});
    const [commands, setCommands] = useState([]);
    const [systemVitals, setSystemVitals] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isNavCollapsed, setIsNavCollapsed] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);

    const refreshData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const requests = await Promise.allSettled([
            api.get('/dashboard/calendar/events'), api.get('/dashboard/todoist'),
            api.get('/dashboard/gmail'), api.get('/dashboard/projects'),
            api.get('/dashboard/commands'), api.get('/dashboard/system/current'),
    ]);
        const values = requests.map((result) => result.status === 'fulfilled' ? result.value.data : null);
        setEvents(values[0] || []);
        setTasks(values[1] || []);
        setEmails(values[2] || []);
        setProjects(values[3] || {projects: [], stats: {}});
        setCommands(values[4] || []);
        setSystemVitals(values[5]);
        setLoading(false);
    }, [user]);

    const refreshViewData = useCallback(async (viewName) => {
        if (!user) return;
        const requests = {
            calendar: ['/dashboard/calendar/events', setEvents],
            tasks: ['/dashboard/todoist', setTasks],
            emails: ['/dashboard/gmail', setEmails],
            projects: ['/dashboard/projects', setProjects],
            commands: ['/dashboard/commands', setCommands],
        };
        const request = requests[viewName];
        if (!request) return;
        setLoading(true);
        try {
            const response = await api.get(request[0]);
            request[1](response.data);
        } catch (error) {
            console.error(`Could not refresh ${viewName}`, error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (isAuthenticated && user) refreshData();
    }, [isAuthenticated, user, refreshData]);
    useEffect(() => {
        if (['calendar', 'tasks', 'emails', 'projects', 'commands'].includes(activeView)) refreshViewData(activeView);
    }, [activeView, refreshViewData]);

    const handleLogout = useCallback(async () => {
        try {
            await api.post('/dashboard/auth/google/logout', {});
        } catch (error) {
            console.warn('Logout request failed', error);
        }
        setUser(null);
        setIsAuthenticated(false);
        setActiveView('dashboard');
        ['token', 'user'].forEach((key) => localStorage.removeItem(key));
        setEvents([]);
        setTasks([]);
        setEmails([]);
        setProjects({projects: [], stats: {}});
        setCommands([]);
        setSystemVitals(null);
    }, []);

    const verifyToken = useCallback(async () => {
        try {
            const response = await api.get('/dashboard/auth/google/verify');
            setUser(response.data.user);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            setIsAuthenticated(true);
        } catch {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setIsAuthChecking(false);
        }
    }, []);

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get('token');
      if (tokenFromUrl) {
          window.history.replaceState({}, document.title, window.location.pathname);
          localStorage.setItem('token', tokenFromUrl);
          void verifyToken();
      } else if (localStorage.getItem('token')) {
          void verifyToken();
      } else {
          setIsAuthChecking(false);
      }
  }, [verifyToken]);

    const handleGoogleLogin = async () => {
        try {
            const response = await api.get('/dashboard/auth/google/login');
            window.location.assign(response.data.auth_url);
        } catch (error) {
            console.error('Google login setup failed', error);
            window.alert('Could not connect to authentication server.');
        }
    };

    const handleFileUpload = async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/dashboard/upload', formData);
    return response.data;
    };

    if (isAuthChecking) return <div role="status" style={{display: 'grid', placeItems: 'center', height: '100vh'}}>
        <TrophySpin size="small" text="Loading"/></div>;
    if (!isAuthenticated) return <LoginScreen handleGoogleLogin={handleGoogleLogin}/>;

    const views = {
        calendar: <ScheduleView events={events} isLoading={loading} refreshData={() => refreshViewData('calendar')}
                                onFileUpload={handleFileUpload}/>,
        tasks: <TasksView tasks={tasks} isLoading={loading} refreshData={() => refreshViewData('tasks')}
                          onFileUpload={handleFileUpload}/>,
        emails: <EmailsView emails={emails} isLoading={loading} refreshData={() => refreshViewData('emails')}/>,
        projects: <ProjectsDashboard projects={projects.projects || []} stats={projects.stats || {}}
                                     refreshData={() => refreshViewData('projects')}/>,
        commands: <CommandNexus commands={commands} isLoading={loading}
                                refreshData={() => refreshViewData('commands')}/>,
        AI: <AiView axiosInstance={api} setActiveView={setActiveView}/>,
    };
    return <div style={{minHeight: '100vh', color: 'var(--text-main)', backgroundColor: 'var(--bg-main)'}}>
        <Navbar activeView={activeView} setActiveView={setActiveView} refreshData={refreshData} loading={loading}
                isCollapsed={isNavCollapsed} setIsCollapsed={setIsNavCollapsed} user={user}
                handleLogout={handleLogout}/>
        <main style={{
            marginLeft: isNavCollapsed ? '80px' : '250px',
            width: `calc(100% - ${isNavCollapsed ? '80px' : '250px'})`,
            padding: 35,
            minHeight: '100vh'
        }}>
            {views[activeView] ||
                <DashboardView events={events} tasks={tasks} emails={emails} setActiveView={setActiveView}
                               refreshData={refreshData} systemVitals={systemVitals}/>}
        </main>
    </div>;
}

export default App;
