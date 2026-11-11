import {useCallback, useEffect, useState} from 'react';
import './App.css';
import api, {getTodoistConnectionStatus} from './api.jsx';
import Navbar from './components/Navbar.jsx';
import OperatorConsole from './views/Dashboard.jsx';
import HomeView from './views/HomeView.jsx';
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
    const [activeView, setActiveView] = useState('home');
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
    const [todoistConnected, setTodoistConnected] = useState(false);
    const [todoistStatusLoading, setTodoistStatusLoading] = useState(true);
    const [todoistTaskLoading, setTodoistTaskLoading] = useState(false);
    const [todoistError, setTodoistError] = useState(null);

    const refreshData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setTodoistTaskLoading(true);
        const requests = await Promise.allSettled([
            api.get('/dashboard/calendar/events'),
            api.get('/dashboard/todoist'),
            api.get('/dashboard/gmail'),
            api.get('/dashboard/projects'),
            api.get('/dashboard/commands'),
            api.get('/dashboard/system/current'),
        ]);
        const values = requests.map((result) => result.status === 'fulfilled' ? result.value.data : null);
        if (values[0] !== null) setEvents(values[0]);
        if (values[1] !== null) {
            setTasks(Array.isArray(values[1]) ? values[1] : []);
            setTodoistError(null);
        } else {
            const taskFailure = requests[1].reason;
            const status = taskFailure?.response?.status;
            if (status === 401 || status === 403) {
                setTodoistConnected(false);
                setTasks([]);
                setTodoistError(taskFailure?.response?.data?.detail || 'Todoist is not connected. Connect Todoist to view your tasks.');
            } else {
                setTodoistError(taskFailure?.response?.data?.detail || 'Todoist is temporarily unavailable. Previously loaded tasks are preserved. Retry to try again.');
            }
        }
        setTodoistTaskLoading(false);
        if (values[2] !== null) setEmails(values[2]);
        if (values[3] !== null) setProjects(values[3] || {projects: [], stats: {}});
        if (values[4] !== null) setCommands(values[4]);
        if (values[5] !== null) setSystemVitals(values[5]);
        await fetchTodoistConnectionStatus();
        setLoading(false);
    }, [user]);
    const fetchTodoistConnectionStatus = useCallback(async () => {
        if (!user) return;
        setTodoistStatusLoading(true);
        try {
            const data = await getTodoistConnectionStatus();
            setTodoistConnected(!!data.connected);
            if (!data.connected) setTasks([]);
        } catch {
            setTodoistError('Todoist connection status is temporarily unavailable. Retry to check your connection.');
        } finally {
            setTodoistStatusLoading(false);
        }
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
        if (viewName === 'tasks') setTodoistTaskLoading(true);
        try {
            const response = await api.get(request[0]);
            request[1](response.data);
            if (viewName === 'tasks') {
                setTodoistError(null);
                await fetchTodoistConnectionStatus();
            }
        } catch (error) {
            if (viewName === 'tasks') {
                const status = error.response?.status;
                if (status === 401 || status === 403) {
                    setTodoistConnected(false);
                    setTasks([]);
                    setTodoistError(error.response?.data?.detail || 'Todoist token rejected. Reconnect Todoist to view your tasks.');
                } else {
                    setTodoistError(error.response?.data?.detail || 'Todoist is temporarily unavailable. Previously loaded tasks are preserved. Retry to try again.');
                }
            }
            console.error(`Could not refresh ${viewName}`, error);
        } finally {
            if (viewName === 'tasks') setTodoistTaskLoading(false);
            setLoading(false);
        }
    }, [user, fetchTodoistConnectionStatus]);
    useEffect(() => {
        if (isAuthenticated && user) refreshData();
    }, [isAuthenticated, user, refreshData]);
    useEffect(() => {
        if (['calendar', 'tasks', 'emails', 'projects', 'commands'].includes(activeView)) refreshViewData(activeView);
    }, [activeView, refreshViewData]);

    useEffect(() => {
        if (!isAuthenticated || !user) return;
        const params = new URLSearchParams(window.location.search);
        const callbackStatus = params.get('todoist');
        if (!callbackStatus) return;

        params.delete('todoist');
        params.delete('reason');
        const query = params.toString();
        window.history.replaceState({}, document.title, `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);

        let cancelled = false;
        const refreshTodoistAfterCallback = async () => {
            try {
                const status = await getTodoistConnectionStatus();
                if (cancelled) return;
                setTodoistConnected(!!status.connected);
                if (status.connected) {
                    const response = await api.get('/dashboard/todoist');
                    if (!cancelled && Array.isArray(response.data)) {
                        setTasks(response.data);
                        setTodoistError(null);
                    }
                } else if (callbackStatus === 'connected') {
                    setTodoistError('Todoist approved access, but no saved connection was found. Retry connection or check backend callback logs.');
                } else {
                    setTodoistError('Todoist authorization was not completed. Open the Todoist page to retry.');
                }
            } catch {
                if (!cancelled) setTodoistError('Todoist callback returned, but connection status or tasks could not be refreshed. Open Todoist and retry.');
            }
        };
        void refreshTodoistAfterCallback();
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, user]);
    const handleLogout = useCallback(async () => {
        try {
            await api.post('/dashboard/auth/google/logout', {});
        } catch (error) {
            console.warn('Logout request failed', error);
        }
        setUser(null);
        setIsAuthenticated(false);
        setActiveView('home');
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
        home: <HomeView events={events} tasks={tasks} emails={emails} projects={projects.projects || []}
                        setActiveView={setActiveView} refreshData={refreshData} systemVitals={systemVitals}/>,
        calendar: <ScheduleView events={events} isLoading={loading} refreshData={() => refreshViewData('calendar')}
                                onFileUpload={handleFileUpload}/>,
        tasks: <TasksView tasks={tasks} isLoading={loading} refreshData={() => refreshViewData('tasks')}
                          onFileUpload={handleFileUpload}
                          todoistConnected={todoistConnected}
                          todoistStatusLoading={todoistStatusLoading}
                          todoistTaskLoading={todoistTaskLoading}
                          todoistError={todoistError}
                          onRetryTodoist={() => {
                              void refreshViewData('tasks');
                              void fetchTodoistConnectionStatus();
                          }}/>,

        emails: <EmailsView emails={emails} isLoading={loading} refreshData={() => refreshViewData('emails')}/>,
        projects: <ProjectsDashboard projects={projects.projects || []} stats={projects.stats || {}}
                                     refreshData={() => refreshViewData('projects')}/>,
        commands: <CommandNexus commands={commands} isLoading={loading}
                                refreshData={() => refreshViewData('commands')}/>,
        AI: <AiView axiosInstance={api} setActiveView={setActiveView} refreshData={refreshData}/>,
        'server-information': <OperatorConsole/>,
    };
    return <div style={{minHeight: '100vh', color: 'var(--text-main)', backgroundColor: 'var(--bg-main)'}}>
        <Navbar activeView={activeView} setActiveView={setActiveView} refreshData={refreshData} loading={loading}
                isCollapsed={isNavCollapsed} setIsCollapsed={setIsNavCollapsed} user={user}
                handleLogout={handleLogout}/>
        <main style={{
            marginLeft: isNavCollapsed ? '80px' : '250px',
            width: `calc(100% - ${isNavCollapsed ? '80px' : '250px'})`,
            padding: activeView === 'AI' ? 12 : 28,
            minHeight: activeView === 'AI' ? 0 : '100vh',
            height: activeView === 'AI' ? '100vh' : 'auto',
            overflow: activeView === 'AI' ? 'hidden' : 'visible'
        }}>
            {views[activeView] || views.home}
        </main>
    </div>;
}

export default App;
