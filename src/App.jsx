import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import './App.css'
import Navbar from './components/Navbar.jsx' 
import DashboardView from './views/dashboard.jsx'
import ProjectsDashboard from './views/ProjectDashboard.jsx';
import Commandnexus from './views/commandnexus.jsx'
import ScheduleView from './views/ScheduleView.jsx'
import TasksView from './views/TasksView.jsx'
import EmailsView from './views/EmailsView.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import AiView from './views/aiview.jsx'
const axiosInstance = axios.create({
  baseURL: 'http://127.0.0.1:8000',
});


import { TrophySpin } from "react-loading-indicators";

// Request interceptor to add token to all requests
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear localStorage and reload
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

function App() {
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState('dashboard') 
  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false)
  const [isAuthChecking, setIsAuthChecking] = useState(true);
const [projects, setProjects] = useState([]);
const [commands, setCommands] = useState([]);
const [ai, setAi] = useState([]);
const [systemVitals, setSystemVitals] = useState(null);


const refreshData = useCallback(async (forceRefresh = false) => {
  if (!user) return;
  
  // Check if we should skip loading (data already exists and not forcing refresh)
  if (!forceRefresh && events.length > 0 && tasks.length > 0 && emails.length > 0) {
    console.log("Data already loaded, skipping refresh");
    return;
  }
  
  setLoading(true);
  try {
    // Load all data in parallel for better performance
    const [calendarRes, todoistRes, gmailRes, projectsRes, commandsRes, systemRes,AiRes] = await Promise.all([
      axiosInstance.get('/dashboard/calendar').catch(err => {
        console.error("Calendar fetch error:", err);
        return { data: [] };
      }),
      axiosInstance.get('/dashboard/todoist').catch(err => {
        console.error("Todoist fetch error:", err);
        return { data: [] };
      }),
      axiosInstance.get('/dashboard/gmail').catch(err => {
        console.error("Gmail fetch error:", err);
        return { data: [] };
      }),
      axiosInstance.get('/dashboard/projects').catch(err => {
        console.error("Projects fetch error:", err);
        return { data: { projects: [] } };
      }),
      axiosInstance.get('/dashboard/commands').catch(err => {
        console.error("Commands fetch error:", err);
        return { data: [] };
      }),
      axiosInstance.get('/dashboard/system/vitals').catch(err => {
        console.error("System vitals fetch error:", err);
        return { data: null };
      }),
      axiosInstance.get('/dashboard/gemini').catch(err => {
        console.error("AI fetch error:", err);
        return { data: [] };
      })
    ]);

    // Set all data
    setEvents(calendarRes.data);
    setTasks(todoistRes.data);
    setEmails(gmailRes.data);
    setProjects(projectsRes.data.projects || []);
    setCommands(commandsRes.data);
    setAi(AiRes.data)
    setSystemVitals(systemRes.data);

    console.log("✅ All data loaded automatically");
    
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
  } finally {
    setLoading(false);
  }
}, [user]);
// Add a view-specific refresh function
const refreshViewData = useCallback(async (viewName) => {
  if (!user) return;
  
  setLoading(true);
  try {
    switch(viewName) {
      case 'calendar':
        const calendarRes = await axiosInstance.get('/dashboard/calendar');
        setEvents(calendarRes.data);
        break;
      case 'tasks':
        const todoistRes = await axiosInstance.get('/dashboard/todoist');
        setTasks(todoistRes.data);
        break;
      case 'emails':
        const gmailRes = await axiosInstance.get('/dashboard/gmail');
        setEmails(gmailRes.data);
        break;
      case 'projects':  
        const projectsRes = await axiosInstance.get('/dashboard/projects');
        setProjects(projectsRes.data.projects || []);
        break;
      case 'commands':  
        const commandsRes = await axiosInstance.get('/dashboard/commands');
        setCommands(commandsRes.data);
        break;
      case 'AI':  
        const AiRes = await axiosInstance.get('/dashboard/gemini');
        setAi(AiRes.data);
        break;
    }
  } catch (err) {
    console.error(`Error refreshing ${viewName} data:`, err);
  } finally {
    setLoading(false);
  }
}, [user]);
useEffect(() => {
  if (!isAuthenticated) return;
  
  // Refresh data when switching to a view that might need fresh data
  if (activeView === 'calendar' || activeView === 'tasks' || activeView === 'emails') {
    refreshViewData(activeView);
  }
}, [activeView, isAuthenticated, refreshViewData]);

  // Handle Google login - this will be passed to LoginScreen
const handleGoogleLogin = async () => {
  try {
    const res = await axiosInstance.get('/auth/google/login');
    window.location.href = res.data.url; 
  } catch (err) {
    console.error("Login setup failed", err);
    alert("Could not connect to authentication server.");
  }
};

  // Authentication verification function
const verifyToken = async (token) => {
  try {
    const res = await axiosInstance.get('/auth/verify');
    const userData = res.data.user;
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    
    // Load ALL data after successful verification
    await refreshData();
  } catch (err) {
    console.error("Token verification failed", err);
    handleLogout();
  } finally {
    setIsAuthChecking(false);
  }
}
  // Main authentication effect
  useEffect(() => {
    const checkAuth = async () => {
      // Check for token in URL (Callback from Google)
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get('token');

      if (tokenFromUrl) {
        // Clean the URL
        window.history.replaceState({}, document.title, window.location.pathname);
        localStorage.setItem('token', tokenFromUrl);
        await verifyToken(tokenFromUrl);
      } else {
        // Check local storage
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        
        if (savedToken && savedUser) {
          await verifyToken(savedToken);
        } else {
          setIsAuthChecking(false);
        }
      }
    };

    checkAuth();
  }, []);


const handleLogout = () => {
  // Call logout endpoint first
  axiosInstance.post('/auth/logout', {}).finally(() => {
    // Then clear frontend
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setActiveView('dashboard');
    // Clear all data states
    setEvents([]);
    setTasks([]);
    setEmails([]);
    setProjects([]);
    setCommands([]);
    setAi([]);
    setSystemVitals(null);
  });
};
// Add this function to your component
const handleFileUpload = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await axiosInstance.post('/dashboard/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    });
    return response.data;
  } catch (error) {
    console.error("Upload failed:", error);
    throw error;
  }
};

  // Function to render the appropriate view based on activeView state
const renderView = () => {
  switch(activeView) {
    case 'calendar':
      return <ScheduleView events={events} isLoading={loading} refreshData={() => refreshViewData('calendar')} onFileUpload={handleFileUpload}/>;
    case 'tasks':
      return <TasksView tasks={tasks} isLoading={loading} refreshData={() => refreshViewData('tasks')} onFileUpload={handleFileUpload}/>;
    case 'emails':
      return <EmailsView emails={emails} isLoading={loading} refreshData={() => refreshViewData('emails')} />;
    case 'projects':  
      return <ProjectsDashboard projects={projects} refreshData={() => refreshViewData('projects')} />;
    case 'commands':  
      return <Commandnexus commands={commands} isLoading={loading} refreshData={() => refreshViewData('commands')} />;
    case 'AI':  
      return <AiView axiosInstance={axiosInstance} setActiveView={setActiveView} refreshData={() => refreshViewData('ai')} />;
    case 'dashboard':
    default:
      return <DashboardView 
        events={events} 
        tasks={tasks} 
        emails={emails} 
        setActiveView={setActiveView} 
        refreshData={refreshData}
        systemVitals={systemVitals}
      />;
  }
}
  // --- Dynamic Layout Logic ---
  const sidebarWidth = isNavCollapsed ? '80px' : '250px';

  const dynamicMainStyle = {
    marginLeft: sidebarWidth,
    width: `calc(100% - ${sidebarWidth})`,
    padding: '35px',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-main)', 
    transition: 'all 0.3s ease',
    animation: 'fadeIn 0.3s ease'
  }

  // Show loading state while checking authentication
  if (isAuthChecking) {
    return (
      <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',     // Full viewport height
      width: '100%',
      backgroundColor: '#fefefeff' // Optional: Match your background
    }}>
      <TrophySpin color={["#ff0000", "#ffa500", "#ffff00", "#008000", "#0000ff", "#4b0082", "#ee82ee"]} size="medium" text="LOADING" textColor={["#ff0000", "#ffa500", "#ffff00", "#008000", "#0000ff", "#4b0082", "#ee82ee"]}/>
    </div>);
  }

  // Show login screen if not authenticated - USING THE IMPORTED LoginScreen COMPONENT
  if (!isAuthenticated) {
    return <LoginScreen handleGoogleLogin={handleGoogleLogin} />;
  }

  // Main authenticated dashboard
  return (
    <div style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-main)' }}>
      <Navbar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        refreshData={refreshData} 
        loading={loading}
        isCollapsed={isNavCollapsed} 
        setIsCollapsed={setIsNavCollapsed}
        user={user}
        handleLogout={handleLogout}
      />

      <main style={dynamicMainStyle}>
        {renderView()}
      </main>
    </div>
  );
}



export default App;