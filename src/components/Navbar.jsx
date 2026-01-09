import { 
  Calendar, 
  CheckSquare, 
  Mail, 
  Home, 
  RefreshCw, 
  ChevronLeft, 
  Sparkles,
  ChevronRight,
  Folder, 
  Terminal 
} from 'lucide-react'

// --- Dynamic Styles ---
const navbarStyle = (isCollapsed) => ({
    display: 'flex',
    flexDirection: 'column',
    width: isCollapsed ? '80px' : '250px', // Matches App.jsx
    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
    backdropFilter: 'blur(10px)',
    padding: '20px 0',
    height: '100vh', 
    position: 'fixed',
    top: 0,
    left: 0,
    boxShadow: '2px 0 10px rgba(0, 0, 0, 0.05)', 
    zIndex: 10,
    borderRight: '1px solid #e0e0e0', 
    transition: 'width 0.3s ease', // Matches App.jsx transition
    alignItems: isCollapsed ? 'center' : 'flex-start',
    overflowX: 'hidden' 
})

const logoStyle = (isCollapsed) => ({
    fontSize: isCollapsed ? '0' : '1.5rem',
    fontWeight: '700', 
    color: 'var(--text-main)', 
    padding: isCollapsed ? '0' : '0 25px 20px',
    textAlign: 'left',
    borderBottom: isCollapsed ? 'none' : '1px solid #e0e0e0',
    marginBottom: '10px',
    height: '50px', // Fixed height prevents jumping
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    opacity: isCollapsed ? 0 : 1,
    transition: 'all 0.3s ease'
})

const navItemStyle = (isActive, isCollapsed) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: isCollapsed ? 'center' : 'flex-start',
    padding: isCollapsed ? '15px 0' : '12px 25px',
    cursor: 'pointer',
    color: isActive ? '#15803d' : 'var(--text-muted)',
    background: isActive ? 'rgba(0, 122, 255, 0.08)' : 'transparent',
    borderRight: isActive ? '3px solid #15803d' : '3px solid transparent',
    transition: 'all 0.2s ease',
    fontSize: '1rem',
    fontWeight: isActive ? '600' : '500',
    textDecoration: 'none',
    width: '100%',
    marginBottom: '4px',
    height: '50px' 
})

const navFooterStyle = {
    marginTop: 'auto',
    padding: '20px',
    borderTop: '1px solid #e0e0e0',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    overflow: 'hidden'
}

const toggleBtnStyle = {
    position: 'absolute',
    right: '12px',
    top: '28px',
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    zIndex: 20
}

export default function Navbar({ activeView, setActiveView, refreshData, loading, isCollapsed, setIsCollapsed }) {

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare },
        { id: 'emails', label: 'Emails', icon: Mail },
        { id: 'projects', label: 'Projects', icon: Folder }, // Fixed: Added icon
        { id: 'commands', label: 'Commands', icon: Terminal }, // Fixed: Added icon
        { id: 'AI', label: 'AI', icon: Sparkles }
    ];

    return (
        <nav style={navbarStyle(isCollapsed)}>
            
            {/* Collapse Toggle Button */}
            <button 
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={toggleBtnStyle}
                title={isCollapsed ? "Expand" : "Collapse"}
            >
                {isCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
            </button>

            {/* Logo */}
            <div style={logoStyle(isCollapsed)}>
                Dashboard
            </div>

            {/* Navigation Links */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                {navItems.map(item => (
                    <div 
                        key={item.id}
                        style={navItemStyle(activeView === item.id, isCollapsed)}
                        onClick={() => setActiveView(item.id)}
                        title={isCollapsed ? item.label : ""}
                    >
                        <item.icon size={20} style={{ marginRight: isCollapsed ? 0 : '12px', minWidth: '20px' }} />
                        
                        <span style={{ 
                            opacity: isCollapsed ? 0 : 1, 
                            width: isCollapsed ? 0 : 'auto',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            transition: 'opacity 0.2s ease',
                        }}>
                            {item.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Footer / Refresh */}
            <div style={navFooterStyle}>
                <button 
                    onClick={refreshData} 
                    disabled={loading}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: 500,
                        width: '100%',
                        justifyContent: isCollapsed ? 'center' : 'flex-start'
                    }}
                    title={isCollapsed ? "Refresh Data" : ""}
                >
                    <RefreshCw 
                        size={18} 
                        style={{ 
                            animation: loading ? "spin 1s linear infinite" : 'none',
                            minWidth: '18px'
                        }} 
                    />
                    {!isCollapsed && (loading ? 'Updating...' : 'Refresh')}
                </button>
            </div>
            
            <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </nav>
    )
}