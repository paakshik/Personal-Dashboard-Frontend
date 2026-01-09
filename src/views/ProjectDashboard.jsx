// ProjectsDashboard.jsx - Updated with real API integration
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FaGithub, 
  FaDatabase, 
  FaExternalLinkAlt, 
  FaServer, 
  FaTrash,
  FaPlus,
  FaFolder,
  FaChartLine,
  FaCog,
  FaHome,
  FaTimes,
  FaCheckCircle,
  FaEdit,
  FaGlobe,
  FaCode,
  FaLaptopCode,
  FaMobileAlt,
  FaRobot
} from 'react-icons/fa';
import { BiEdit } from 'react-icons/bi';
import { MdDashboard } from 'react-icons/md';
import { TrophySpin } from 'react-loading-indicators';
// API configuration
const API_BASE_URL = 'http://localhost:8000';

const getAuthConfig = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }
});

// Main Projects Dashboard Component
const ProjectDashboard = () => {
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    completed: 0,
    planning: 0,
    avgProgress: 0
  });

  // Fetch projects from API
  const fetchProjects = async () => {
    try {
      setIsLoading(true);
    const response = await axios.get(
  `${API_BASE_URL}/dashboard/projects`,
  getAuthConfig()
);

      setProjects(response.data.projects);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
      setStats({
        total: 0,
        inProgress: 0,
        completed: 0,
        planning: 0,
        avgProgress: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize projects
  useEffect(() => {
    fetchProjects();
  }, []);

  // Filter projects based on search and status
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.technologies.some(tech => tech.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Project Card Component
  const ProjectCard = ({ project, onEdit, onDelete }) => {
    const getProgressColor = (progress) => {
      if (progress < 30) return 'var(--progress-red)';
      if (progress < 70) return 'var(--progress-yellow)';
      return 'var(--progress-green)';
    };

    const getStatusColor = (status) => {
      switch (status) {
        case 'completed': return 'var(--status-completed)';
        case 'in-progress': return 'var(--status-in-progress)';
        case 'testing': return 'var(--status-testing)';
        default: return 'var(--status-planning)';
      }
    };

    const getPriorityIcon = (priority) => {
      switch (priority) {
        case 'high': return '🔥';
        case 'medium': return '⚡';
        case 'low': return '🌱';
        default: return '📋';
      }
    };

    const getCategoryIcon = (category) => {
      switch (category) {
        case 'web': return <FaGlobe />;
        case 'mobile': return <FaMobileAlt />;
        case 'ai': return <FaRobot />;
        case 'api': return <FaCode />;
        default: return <FaLaptopCode />;
      }
    };

    return (
      <div className="project-card" style={styles.projectCard}>
        <div style={styles.projectCardHeader}>
          <div style={styles.projectTitleSection}>
            <div style={styles.projectTitleRow}>
              <h3 style={styles.projectTitle}>{project.name}</h3>
              <span style={styles.priorityBadge}>
                {getPriorityIcon(project.priority)} {project.priority}
              </span>
            </div>
            <div style={styles.projectMetaRow}>
              <span style={{...styles.projectStatus, backgroundColor: getStatusColor(project.status)}}>
                {project.status}
              </span>
              <span style={styles.projectCategory}>
                {getCategoryIcon(project.category)} {project.category}
              </span>
            </div>
          </div>
          <div style={styles.projectActions}>
            <button style={styles.btnIcon} onClick={() => onEdit(project)}>
              <FaEdit />
            </button>
            <button style={{...styles.btnIcon, ...styles.btnDanger}} onClick={() => onDelete(project.id)}>
              <FaTrash />
            </button>
          </div>
        </div>
        
        <p style={styles.projectDescription}>{project.description}</p>
        
        <div style={styles.projectProgress}>
          <div style={styles.progressBar}>
            <div 
              style={{
                ...styles.progressFill,
                width: `${project.progress}%`,
                backgroundColor: getProgressColor(project.progress)
              }}
            ></div>
          </div>
          <span style={styles.progressText}>{project.progress}% Complete</span>
        </div>
        
        <div style={styles.projectLinks}>
          {project.links.github && (
            <a href={project.links.github} target="_blank" rel="noopener noreferrer" style={styles.projectLink}>
              <FaGithub /> GitHub
            </a>
          )}
          {project.links.database && (
            <a href={project.links.database} target="_blank" rel="noopener noreferrer" style={styles.projectLink}>
              <FaDatabase /> Database
            </a>
          )}
          {project.links.live && (
            <a href={project.links.live} target="_blank" rel="noopener noreferrer" style={styles.projectLink}>
              <FaExternalLinkAlt /> Live Demo
            </a>
          )}
          {project.links.api && (
            <a href={project.links.api} target="_blank" rel="noopener noreferrer" style={styles.projectLink}>
              <FaServer /> API
            </a>
          )}
        </div>
        
        <div style={styles.projectMeta}>
          <div style={styles.projectTech}>
            {project.technologies.map((tech, index) => (
              <span key={index} style={styles.techTag}>{tech}</span>
            ))}
          </div>
          <div style={styles.projectDate}>
            Updated: {project.lastUpdated}
          </div>
        </div>
      </div>
    );
  };

  // Project Form Component
  const ProjectForm = ({ projectToEdit, onCancel }) => {
    const [project, setProject] = useState(projectToEdit || {
      name: '',
      description: '',
      progress: 0,
      status: 'planning',
      priority: 'medium',
      category: 'web',
      technologies: [],
      lastUpdated: new Date().toISOString().split('T')[0],
      links: {
        github: '',
        database: '',
        live: '',
        api: ''
      }
    });

    const [techInput, setTechInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
      const { name, value } = e.target;
      setProject(prev => ({ ...prev, [name]: value }));
    };

    const handleLinkChange = (e) => {
      const { name, value } = e.target;
      setProject(prev => ({
        ...prev,
        links: { ...prev.links, [name]: value }
      }));
    };

    const handleAddTech = () => {
      if (techInput.trim() && !project.technologies.includes(techInput.trim())) {
        setProject(prev => ({
          ...prev,
          technologies: [...prev.technologies, techInput.trim()]
        }));
        setTechInput('');
      }
    };

    const handleRemoveTech = (techToRemove) => {
      setProject(prev => ({
        ...prev,
        technologies: prev.technologies.filter(tech => tech !== techToRemove)
      }));
    };

    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTech();
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      try {
        setIsSubmitting(true);
        const projectData = {
          ...project,
          lastUpdated: new Date().toISOString().split('T')[0]
        };

        if (projectToEdit) {
          // Update existing project
await axios.put(
  `${API_BASE_URL}/dashboard/projects/${project.id}`,
  projectData,
  getAuthConfig()
);

        } else {
          // Create new project
await axios.post(
  `${API_BASE_URL}/dashboard/projects`,
  projectData,
  getAuthConfig()
);

        }
        
        // Refresh projects list
        fetchProjects();
        setShowForm(false);
        setEditingProject(null);
      } catch (error) {
        console.error('Error saving project:', error);
        alert('Failed to save project. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
          <div style={styles.modalHeader}>
            <h2 style={styles.modalTitle}>{projectToEdit ? 'Edit Project' : 'Create New Project'}</h2>
            <button style={styles.btnIcon} onClick={onCancel} disabled={isSubmitting}>
              <FaTimes />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Project Name *</label>
              <input
                type="text"
                name="name"
                value={project.name}
                onChange={handleChange}
                placeholder="Enter project name"
                required
                style={styles.input}
                disabled={isSubmitting}
              />
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Description *</label>
              <textarea
                name="description"
                value={project.description}
                onChange={handleChange}
                rows="3"
                placeholder="Describe your project"
                required
                style={styles.textarea}
                disabled={isSubmitting}
              />
            </div>
            
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Progress: {project.progress}%</label>
                <input
                  type="range"
                  name="progress"
                  min="0"
                  max="100"
                  value={project.progress}
                  onChange={handleChange}
                  style={styles.rangeInput}
                  disabled={isSubmitting}
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Status</label>
                <select
                  name="status"
                  value={project.status}
                  onChange={handleChange}
                  style={styles.select}
                  disabled={isSubmitting}
                >
                  <option value="planning">Planning</option>
                  <option value="in-progress">In Progress</option>
                  <option value="testing">Testing</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Priority</label>
                <select
                  name="priority"
                  value={project.priority}
                  onChange={handleChange}
                  style={styles.select}
                  disabled={isSubmitting}
                >
                  <option value="high">High 🔥</option>
                  <option value="medium">Medium ⚡</option>
                  <option value="low">Low 🌱</option>
                </select>
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Category</label>
                <select
                  name="category"
                  value={project.category}
                  onChange={handleChange}
                  style={styles.select}
                  disabled={isSubmitting}
                >
                  <option value="web">Web</option>
                  <option value="mobile">Mobile</option>
                  <option value="ai">AI/ML</option>
                  <option value="api">API</option>
                  <option value="desktop">Desktop</option>
                </select>
              </div>
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Technologies</label>
              <div style={styles.techInputGroup}>
                <input
                  type="text"
                  value={techInput}
                  onChange={(e) => setTechInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add technology and press Enter"
                  style={styles.techInput}
                  disabled={isSubmitting}
                />
                <button 
                  type="button" 
                  style={styles.btnAddTech} 
                  onClick={handleAddTech}
                  disabled={isSubmitting}
                >
                  Add
                </button>
              </div>
              <div style={styles.techTagsContainer}>
                {project.technologies.map((tech, index) => (
                  <span key={index} style={styles.techTag}>
                    {tech}
                    <button 
                      type="button" 
                      style={styles.tagRemove}
                      onClick={() => handleRemoveTech(tech)}
                      disabled={isSubmitting}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Important Links</label>
              <div style={styles.linkInputGroup}>
                <FaGithub style={styles.linkIcon} />
                <input
                  type="url"
                  name="github"
                  value={project.links.github}
                  onChange={handleLinkChange}
                  placeholder="GitHub repository URL"
                  style={styles.linkInput}
                  disabled={isSubmitting}
                />
              </div>
              <div style={styles.linkInputGroup}>
                <FaDatabase style={styles.linkIcon} />
                <input
                  type="url"
                  name="database"
                  value={project.links.database}
                  onChange={handleLinkChange}
                  placeholder="Database dashboard URL"
                  style={styles.linkInput}
                  disabled={isSubmitting}
                />
              </div>
              <div style={styles.linkInputGroup}>
                <FaExternalLinkAlt style={styles.linkIcon} />
                <input
                  type="url"
                  name="live"
                  value={project.links.live}
                  onChange={handleLinkChange}
                  placeholder="Live demo URL"
                  style={styles.linkInput}
                  disabled={isSubmitting}
                />
              </div>
              <div style={styles.linkInputGroup}>
                <FaServer style={styles.linkIcon} />
                <input
                  type="url"
                  name="api"
                  value={project.links.api}
                  onChange={handleLinkChange}
                  placeholder="API documentation URL"
                  style={styles.linkInput}
                  disabled={isSubmitting}
                />
              </div>
            </div>
            
            <div style={styles.formActions}>
              <button 
                type="button" 
                style={styles.btnSecondary} 
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                style={styles.btnPrimary}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>Saving...</>
                ) : (
                  <>
                    <FaCheckCircle /> {projectToEdit ? 'Update Project' : 'Create Project'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Handlers
  const handleEditProject = (project) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleDeleteProject = async (id) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
await axios.delete(
  `${API_BASE_URL}/dashboard/projects/${id}`,
  getAuthConfig()
);

        fetchProjects(); // Refresh the list
      } catch (error) {
        console.error('Error deleting project:', error);
        alert('Failed to delete project. Please try again.');
      }
    }
  };

  const handleNewProject = () => {
    setEditingProject(null);
    setShowForm(true);
  };

  // Main Render
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <MdDashboard style={styles.headerIcon} />
          <div>
            <h1 style={styles.pageTitle}>Projects Dashboard</h1>
            <p style={styles.pageSubtitle}>Track and manage all your development projects</p>
          </div>
        </div>
        <button style={styles.btnNewProject} onClick={handleNewProject}>
          <FaPlus /> New Project
        </button>
      </div>

      {/* Stats Overview */}
      <div style={styles.statsOverview}>
        <div style={styles.statCard}>
          <h3 style={styles.statTitle}>Total Projects</h3>
          <div style={styles.statNumber}>{stats.total}</div>
        </div>
        <div style={styles.statCard}>
          <h3 style={styles.statTitle}>In Progress</h3>
          <div style={styles.statNumber}>{stats.inProgress}</div>
        </div>
        <div style={styles.statCard}>
          <h3 style={styles.statTitle}>Completed</h3>
          <div style={styles.statNumber}>{stats.completed}</div>
        </div>
        <div style={styles.statCard}>
          <h3 style={styles.statTitle}>Avg. Progress</h3>
          <div style={styles.statNumber}>{stats.avgProgress}%</div>
        </div>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <div style={styles.searchBox}>
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        
        <div style={styles.filters}>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">All Status</option>
            <option value="planning">Planning</option>
            <option value="in-progress">In Progress</option>
            <option value="testing">Testing</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
      <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',     // Full viewport height
      width: '100%',
      backgroundColor: '#fefefeff' // Optional: Match your background
    }}>
      <TrophySpin color={["#ff0000", "#ffa500", "#ffff00", "#008000", "#0000ff", "#4b0082", "#ee82ee"]} size="small" text="LOADING" textColor="#ffffff"/>
    </div>
      ) : filteredProjects.length === 0 ? (
        <div style={styles.emptyState}>
          <FaFolder style={styles.emptyIcon} />
          <h3>No projects found</h3>
          <p>{searchTerm ? 'Try a different search term' : 'Create your first project to get started'}</p>
          <button style={styles.btnPrimary} onClick={handleNewProject}>
            <FaPlus /> Create Project
          </button>
        </div>
      ) : (
        <div style={styles.projectsGrid}>
          {filteredProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={handleEditProject}
              onDelete={handleDeleteProject}
            />
          ))}
        </div>
      )}

      {/* Project Form Modal */}
      {showForm && (
        <ProjectForm
          projectToEdit={editingProject}
          onCancel={() => {
            setShowForm(false);
            setEditingProject(null);
          }}
        />
      )}
    </div>
  );
};

// CSS-in-JS Styles
const styles = {
  container: {
    padding: '20px',
    backgroundColor: 'var(--bg-main)',
    minHeight: '100vh'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '1px solid #e0e0e0'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  headerIcon: {
    fontSize: '2.5rem',
    color: '#15803d'
  },
  pageTitle: {
    fontSize: '2rem',
    fontWeight: '700',
    color: 'var(--text-main)',
    margin: 0
  },
  pageSubtitle: {
    color: 'var(--text-muted)',
    margin: '5px 0 0 0'
  },
  btnNewProject: {
    backgroundColor: '#15803d ',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.3s ease'
  },
  statsOverview: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  statCard: {
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    boxShadow: 'var(--shadow-subtle)',
    border: '1px solid #e0e0e0'
  },
  statTitle: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    marginBottom: '10px',
    textTransform: 'uppercase'
  },
  statNumber: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#15803d '
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    gap: '20px'
  },
  searchBox: {
    flex: 1
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid #d1d1d6',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-main)',
    fontSize: '1rem'
  },
  filters: {
    minWidth: '200px'
  },
  filterSelect: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid #d1d1d6',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-main)',
    fontSize: '1rem'
  },
  projectsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '25px'
  },
  projectCard: {
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    boxShadow: 'var(--shadow-subtle)',
    border: '1px solid #e0e0e0',
    transition: 'all 0.3s ease'
  },
  projectCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '15px'
  },
  projectTitleSection: {
    flex: 1
  },
  projectTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px'
  },
  projectTitle: {
    fontSize: '1.3rem',
    fontWeight: '600',
    color: 'var(--text-main)',
    margin: 0
  },
  priorityBadge: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    color: '#ff6b6b',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontWeight: '600'
  },
  projectMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  projectStatus: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'white'
  },
  projectCategory: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    color: 'var(--text-muted)',
    fontSize: '0.9rem'
  },
  projectActions: {
    display: 'flex',
    gap: '5px'
  },
  btnIcon: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#15803d',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '8px',
    borderRadius: '4px',
    transition: 'all 0.2s ease'
  },
  btnDanger: {
    color: '#ff6b6b'
  },
  projectDescription: {
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
    lineHeight: '1.5',
    marginBottom: '20px'
  },
  projectProgress: {
    marginBottom: '20px'
  },
  progressBar: {
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px'
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease'
  },
  progressText: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)'
  },
  projectLinks: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '20px'
  },
  projectLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    color: '#15803d ',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '0.85rem',
    textDecoration: 'none',
    transition: 'all 0.2s ease'
  },
  projectMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '15px',
    borderTop: '1px solid #e0e0e0'
  },
  projectTech: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  techTag: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: '#15803d',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.8rem'
  },
  projectDate: {
    color: 'var(--text-muted)',
    fontSize: '0.8rem'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    padding: '30px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px'
  },
  modalTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: 'var(--text-main)',
    margin: 0
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-main)'
  },
  input: {
    padding: '12px 16px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid #d1d1d6',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-main)',
    fontSize: '1rem'
  },
  textarea: {
    padding: '12px 16px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid #d1d1d6',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-main)',
    fontSize: '1rem',
    resize: 'vertical',
    minHeight: '80px'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px'
  },
  rangeInput: {
    width: '100%'
  },
  select: {
    padding: '12px 16px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid #d1d1d6',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-main)',
    fontSize: '1rem',
    width: '100%'
  },
  techInputGroup: {
    display: 'flex',
    gap: '10px'
  },
  techInput: {
    flex: 1,
    padding: '12px 16px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid #d1d1d6',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-main)',
    fontSize: '1rem'
  },
  btnAddTech: {
    backgroundColor: '#15803d',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  techTagsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '10px'
  },
  tagRemove: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ff6b6b',
    cursor: 'pointer',
    fontSize: '1.2rem',
    marginLeft: '5px'
  },
  linkInputGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px'
  },
  linkIcon: {
    color: 'var(--text-muted)',
    fontSize: '1rem'
  },
  linkInput: {
    flex: 1,
    padding: '12px 16px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid #d1d1d6',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-main)',
    fontSize: '1rem'
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '15px',
    marginTop: '20px'
  },
  btnPrimary: {
    backgroundColor: '#15803d',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.3s ease'
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid #d1d1d6',
    padding: '12px 24px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '50px',
    color: 'var(--text-muted)'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '3px solid #f3f3f3',
    borderTop: '3px solid #15803d',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '20px'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '50px',
    textAlign: 'center'
  },
  emptyIcon: {
    fontSize: '4rem',
    color: 'var(--text-muted)',
    marginBottom: '20px'
  }
};

// Add CSS animation for spinner
const spinnerStyle = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  button:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  .project-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  }
  
  .project-link:hover {
    background-color: rgba(59, 130, 246, 0.2);
  }
`;

// Inject styles into head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = spinnerStyle;
  document.head.appendChild(styleElement);
}

export default ProjectDashboard;