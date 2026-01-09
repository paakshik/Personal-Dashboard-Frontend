
import React, { useState, useEffect } from 'react';
import { 
  Copy, 
  Search, 
  Plus, 
  Check, 
  Terminal, 
  X, 
  FileText, 
  Code, 
  Database, 
  Globe, 
  Lock, 
  Cloud, 
  Wifi,
  Server,
  Trash2,
  Edit,
  Loader,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import axios from 'axios';
import { TrophySpin } from 'react-loading-indicators';  
const API_BASE_URL = 'http://localhost:8000'; 


const CommandNexus = () => {
  const [currentTime, setCurrentTime] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCommand, setCopiedCommand] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [commands, setCommands] = useState([]);
  const [notification, setNotification] = useState(null);
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    command: '',
    description: '',
    category: 'general',
    tags: []
  });

  // Authentication headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found');
      showNotification('Authentication required. Please login again.', 'error');
      // Optionally redirect to login
      // window.location.href = '/login';
      return {};
    }
    
    return {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  };

  // Notification system
  const showNotification = (message, type = 'success', duration = 5000) => {
    setNotification({ message, type });
    
    // Auto-hide notification
    if (duration > 0) {
      setTimeout(() => {
        setNotification(null);
      }, duration);
    }
  };

  // Fetch commands from backend
  const fetchCommands = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE_URL}/dashboard/commands`,
        getAuthHeaders()
      );
      setCommands(response.data);
    } catch (error) {
      console.error("Failed to fetch commands:", error.response?.data || error.message);
      showNotification('Failed to fetch commands. Please check authentication.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Initialize
  useEffect(() => {
    updateTime();
    const interval = setInterval(updateTime, 60000);
    fetchCommands();
    
    return () => clearInterval(interval);
  }, []);

  // Auto-focus form when opened
  useEffect(() => {
    if (showAddForm && !isEditing) {
      const timeout = setTimeout(() => {
        const nameInput = document.querySelector('input[name="command-name"]');
        if (nameInput) {
          nameInput.focus();
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [showAddForm, isEditing]);

  const updateTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    setCurrentTime(`${displayHours}:${minutes} ${period}`);
  };

  const copyToClipboard = (command, id) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(id);
    showNotification('Command copied to clipboard!', 'success', 2000);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name.trim()) {
      showNotification('Command name is required', 'error');
      return;
    }
    
    if (!formData.command.trim()) {
      showNotification('Command content is required', 'error');
      return;
    }

    try {
      setSaving(true);
      const headers = getAuthHeaders();
      
      let response;
      if (isEditing && formData.id) {
        // Update existing command
        response = await axios.put(
          `${API_BASE_URL}/dashboard/commands/${formData.id}`,
          formData,
          headers
        );
        showNotification('Command updated successfully!', 'success');
      } else {
        // Create new command
        response = await axios.post(
          `${API_BASE_URL}/dashboard/commands`,
          formData,
          headers
        );
        showNotification('Command created successfully!', 'success');
      }
      
      // Refresh commands list
      await fetchCommands();
      
      // Reset form
      resetForm();
      
    } catch (error) {
      console.error('Error saving command:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to save command';
      showNotification(`Error: ${errorMsg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (command) => {
    setFormData({
      id: command.id,
      name: command.name,
      command: command.command,
      description: command.description || '',
      category: command.category || 'general',
      tags: command.tags || []
    });
    setIsEditing(true);
    setShowAddForm(true);
  };


  const handleDelete = async (commandId) => {
    const commandToDelete = commands.find(c => c.id === commandId);
    if (!commandToDelete) return;
    
    if (!window.confirm(`Are you sure you want to delete command "${commandToDelete.name}"?\n\nThis action cannot be undone.`)) {
      return;
    }
    
    try {
      await axios.delete(
        `${API_BASE_URL}/dashboard/commands/${commandId}`,
        getAuthHeaders()
      );
      
      // Update local state
      setCommands(prev => prev.filter(c => c.id !== commandId));
      
      showNotification(`Command "${commandToDelete.name}" deleted successfully!`, 'success');
    } catch (error) {
      console.error('Delete error:', error);
      showNotification(`Failed to delete command: ${error.response?.data?.detail || error.message}`, 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      id: null,
      name: '',
      command: '',
      description: '',
      category: 'general',
      tags: []
    });
    setIsEditing(false);
    setShowAddForm(false);
  };

  const filteredCommands = commands.filter(cmd =>
    cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cmd.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cmd.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cmd.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cmd.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const categories = [
    { id: 'general', name: 'General', color: '#6B7280', icon: <Terminal size={16} /> },
    { id: 'development', name: 'Development', color: '#3B82F6', icon: <Code size={16} /> },
    { id: 'git', name: 'Git', color: '#F97316', icon: <FileText size={16} /> },
    { id: 'database', name: 'Database', color: '#10B981', icon: <Database size={16} /> },
    { id: 'deployment', name: 'Deployment', color: '#8B5CF6', icon: <Cloud size={16} /> },
    { id: 'server', name: 'Server', color: '#EC4899', icon: <Server size={16} /> },
    { id: 'network', name: 'Network', color: '#14B8A6', icon: <Wifi size={16} /> },
    { id: 'security', name: 'Security', color: '#EF4444', icon: <Lock size={16} /> },
    { id: 'system', name: 'System', color: '#F59E0B', icon: <Terminal size={16} /> },
  ];

  const getIconForCategory = (category) => {
    const cat = categories.find(c => c.id === category);
    return cat ? cat.icon : <Terminal size={18} />;
  };

  return (
    <div style={{ 
      padding: '25px',
      minHeight: '100vh',
      background: 'var(--bg-main)',
      fontFamily: 'inherit'
    }}>
      
      {/* Notification System */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: notification.type === 'success' ? '#10B981' : '#EF4444',
          color: 'white',
          padding: '15px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'slideIn 0.3s ease',
          minWidth: '300px',
          maxWidth: '500px'
        }}>
          {notification.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span style={{ flex: 1 }}>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              marginLeft: '10px',
              fontSize: '1.2rem',
              lineHeight: '1'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '2.2rem', 
            fontWeight: '700', 
            color: 'var(--text-main)', 
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Terminal size={32} color="#3B82F6" />
            Command Nexus
          </h1>
      
        </div>
        
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <div style={{ 
            background: 'rgba(59, 130, 246, 0.1)', 
            padding: '10px 20px', 
            borderRadius: '10px',
            color: '#15803d ',
            fontWeight: '600',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.3s ease'
          }}>
            <Terminal size={16} />
            {loading ? 'Loading...' : `${commands.length} commands`}
          </div>
          
          <div style={{ 
            background: 'rgba(16, 185, 129, 0.1)', 
            padding: '10px 20px', 
            borderRadius: '10px',
            color: '#10B981',
            fontWeight: '600',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {currentTime}
          </div>
          
          <button
            onClick={fetchCommands}
            disabled={loading}
            style={{
              background: loading ? '#94A3B8' : '#10B981',
              color: 'white',
              border: 'none',
              padding: '10px 15px',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '600',
              fontSize: '0.95rem',
              transition: 'background 0.2s',
              opacity: loading ? 0.7 : 1
            }}
            title="Refresh commands"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          
          <button
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            style={{
              background: '#15803d ',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '600',
              fontSize: '0.95rem',
              transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Plus size={18} />
            Add Command
          </button>
        </div>
      </div>

      {/* Search Bar - FIXED */}
      <div style={{
        position: 'relative',
        marginBottom: '30px'
      }}>
        <Search 
          size={20} 
          style={{
            position: 'absolute',
            left: '15px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }}
        />
        <input
          type="text"
          placeholder="Search commands by name, description, or content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 20px 14px 45px',
            fontSize: '1rem',
            borderRadius: '10px',
            border: '2px solid #E5E7EB',
            background: 'white',
            color: 'var(--text-main)',
            outline: 'none',
            transition: 'border 0.2s'
          }}
          onFocus={e => e.currentTarget.style.borderColor = '#3B82F6'}
          onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
        />
        {searchQuery && (
          <div style={{
            position: 'absolute',
            right: '15px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
            background: 'rgba(0,0,0,0.05)',
            padding: '2px 8px',
            borderRadius: '4px'
          }}>
            {filteredCommands.length} {filteredCommands.length === 1 ? 'command' : 'commands'} found
          </div>
        )}
      </div>

      {/* Add/Edit Command Form */}
      {showAddForm && (
        <div className="card" style={{ 
          marginBottom: '30px', 
          animation: 'fadeIn 0.3s ease',
          border: '2px solid #E5E7EB',
          borderRadius: '12px',
          padding: '25px',
          background: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '600', color: 'var(--text-main)' }}>
              {isEditing ? 'Edit Command' : 'Add New Command'}
            </h3>
            <button
              onClick={resetForm}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'var(--text-muted)', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                transition: 'background 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
              onMouseOut={e => e.currentTarget.style.background = 'none'}
            >
              <X size={20} />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontWeight: '500' }}>
                  Command Name *
                </label>
                <input
                  type="text"
                  name="command-name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Start Dev Server"
                  required
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    borderRadius: '8px',
                    border: '2px solid #D1D5DB',
                    background: 'white',
                    color: 'var(--text-main)',
                    fontSize: '1rem',
                    transition: 'border 0.2s',
                    outline: 'none'
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#3B82F6'}
                  onBlur={e => e.currentTarget.style.borderColor = '#D1D5DB'}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontWeight: '500' }}>
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    borderRadius: '8px',
                    border: '2px solid #D1D5DB',
                    background: 'white',
                    color: 'var(--text-main)',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    transition: 'border 0.2s',
                    outline: 'none'
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#3B82F6'}
                  onBlur={e => e.currentTarget.style.borderColor = '#D1D5DB'}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontWeight: '500' }}>
                Command *
              </label>
              <textarea
                value={formData.command}
                onChange={(e) => setFormData({...formData, command: e.target.value})}
                placeholder="Enter your command here..."
                required
                rows="4"
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '12px 15px',
                  borderRadius: '8px',
                  border: '2px solid #D1D5DB',
                  background: 'white',
                  color: 'var(--text-main)',
                  fontFamily: "'Courier New', 'Monaco', monospace",
                  fontSize: '0.95rem',
                  resize: 'vertical',
                  transition: 'border 0.2s',
                  outline: 'none',
                  lineHeight: '1.5'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#3B82F6'}
                onBlur={e => e.currentTarget.style.borderColor = '#D1D5DB'}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontWeight: '500' }}>
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="What does this command do?"
                rows="3"
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '12px 15px',
                  borderRadius: '8px',
                  border: '2px solid #D1D5DB',
                  background: 'white',
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  resize: 'vertical',
                  transition: 'border 0.2s',
                  outline: 'none',
                  lineHeight: '1.5'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#3B82F6'}
                onBlur={e => e.currentTarget.style.borderColor = '#D1D5DB'}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: '2px solid #D1D5DB',
                  background: 'white',
                  color: 'var(--text-main)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  fontSize: '0.95rem',
                  transition: 'all 0.2s',
                  opacity: saving ? 0.7 : 1
                }}
                onMouseOver={e => !saving && (e.currentTarget.style.background = '#F9FAFB')}
                onMouseOut={e => !saving && (e.currentTarget.style.background = 'white')}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: saving ? '#94A3B8' : '#3B82F6',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  opacity: saving ? 0.7 : 1
                }}
                onMouseOver={e => !saving && (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseOut={e => !saving && (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {saving ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    {isEditing ? 'Updating...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    {isEditing ? 'Update Command' : 'Save Command'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading State */}
      {loading && !showAddForm && (

      <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',     // Full viewport height
      width: '100%',
      backgroundColor: '#fefefeff' // Optional: Match your background
    }}>
      <TrophySpin color={["#ff0000", "#ffa500", "#ffff00", "#008000", "#0000ff", "#4b0082", "#ee82ee"]} size="small" text="LOADING" textColor={["#ff0000", "#ffa500", "#ffff00", "#008000", "#0000ff", "#4b0082", "#ee82ee"]}/>
    </div>
      )}

      {/* Commands Grid */}
      {!loading && filteredCommands.length === 0 ? (
        <div className="card" style={{ 
          textAlign: 'center', 
          padding: '60px',
          border: '2px dashed #E5E7EB',
          borderRadius: '12px',
          background: 'white'
        }}>
          <Terminal size={64} color="#9CA3AF" style={{ marginBottom: '20px', opacity: '0.5' }} />
          <h3 style={{ color: 'var(--text-main)', marginBottom: '10px', fontSize: '1.5rem' }}>
            {searchQuery ? 'No matching commands found' : 'No commands yet'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '30px', maxWidth: '500px', margin: '0 auto 30px' }}>
            {searchQuery ? 'Try a different search term' : 'Add your first command to get started!'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              style={{
                background: '#3B82F6',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Plus size={20} />
              Add Your First Command
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '25px' }}>
          {filteredCommands.map(cmd => {
            const category = categories.find(c => c.id === cmd.category);
            return (
              <div 
                key={cmd.id} 
                className="card"
                style={{ 
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  padding: '25px',
                  background: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
                onClick={() => copyToClipboard(cmd.command, cmd.id)}
                onMouseOver={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                }}
              >
                {/* Action buttons */}
                <div style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  display: 'flex',
                  gap: '8px',
                  zIndex: 10
                }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleEdit(cmd);
                    }}
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px',
                      cursor: 'pointer',
                      color: '#15803d ',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                    title="Edit command"
                  >
                    <Edit size={18} />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDelete(cmd.id);
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px',
                      cursor: 'pointer',
                      color: '#EF4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                    title="Delete command"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                {/* Category badge */}
                <div style={{
                  position: 'absolute',
                  top: '20px',
                  left: '20px',
                  background: category ? `${category.color}15` : 'rgba(107, 114, 128, 0.1)',
                  color: category ? category.color : '#6B7280',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: `1px solid ${category ? `${category.color}30` : 'rgba(107, 114, 128, 0.2)'}`
                }}>
                  {getIconForCategory(cmd.category)}
                  {category ? category.name : cmd.category}
                </div>
                
                {/* Command content */}
                <div style={{ paddingTop: '50px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ 
                      fontSize: '1.3rem', 
                      fontWeight: '600', 
                      color: 'var(--text-main)', 
                      marginBottom: '12px',
                      lineHeight: '1.4'
                    }}>
                      {cmd.name}
                    </h3>
                    
                    <div style={{ 
                      background: '#F9FAFB',
                      padding: '15px',
                      borderRadius: '8px',
                      border: '1px solid #E5E7EB',
                      fontFamily: "'Courier New', 'Monaco', monospace",
                      fontSize: '0.9rem',
                      color: 'var(--text-main)',
                      wordBreak: 'break-all',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.5'
                    }}>
                      {cmd.command}
                    </div>
                  </div>
                  
                  {cmd.description && (
                    <p style={{ 
                      color: 'var(--text-muted)', 
                      fontSize: '0.95rem',
                      lineHeight: '1.6',
                      marginBottom: '20px'
                    }}>
                      {cmd.description}
                    </p>
                  )}
                  
                  {/* Tags */}
                  {cmd.tags && cmd.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                      {cmd.tags.map((tag, index) => (
                        <span key={index} style={{
                          background: 'rgba(107, 114, 128, 0.1)',
                          color: '#6B7280',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '500'
                        }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginTop: '20px',
                    paddingTop: '20px',
                    borderTop: '1px solid #E5E7EB'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        copyToClipboard(cmd.command, cmd.id);
                      }}
                      style={{
                        background: copiedCommand === cmd.id ? '#10B981' : '#15803d ',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: '600',
                        fontSize: '0.9rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={e => copiedCommand !== cmd.id && (e.currentTarget.style.transform = 'translateY(-2px)')}
                      onMouseOut={e => copiedCommand !== cmd.id && (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      {copiedCommand === cmd.id ? (
                        <>
                          <Check size={16} />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          Copy Command
                        </>
                      )}
                    </button>
                    
                    <div style={{ 
                      fontSize: '0.8rem', 
                      color: 'var(--text-muted)',
                      fontFamily: "'Courier New', monospace",
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add CSS animations */}
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .animate-spin {
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
};

export default CommandNexus;