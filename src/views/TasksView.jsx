import { CheckSquare, List, Plus, Trash2, CheckCircle, ChevronDown, ChevronUp, Edit2, Upload, FileText, ExternalLink, Paperclip, X , Search} from 'lucide-react'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { TrophySpin } from 'react-loading-indicators';
// --- 💎 COMPONENT: COMPACT ATTACHMENT CARD ---
const AttachmentCard = ({ file, onRemove }) => (
    <div style={styles.fileCard}>
        <a 
            href={file.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{display:'flex', alignItems:'center', gap:'8px', textDecoration:'none', color:'inherit', flex:1, minWidth:0}}
            title={`Open ${file.name}`}
            onClick={(e) => e.stopPropagation()}
        >
            <div style={styles.fileIcon}>
                <FileText size={14} color="#fff"/>
            </div>
            <div style={styles.fileInfo}>
                <span style={styles.fileName}>{file.name}</span>
            </div>
            <ExternalLink size={10} color="#888" style={{marginLeft:'auto', flexShrink:0}}/>
        </a>
        {/* Remove Button (Only visible in Edit Mode) */}
        {onRemove && (
            <button onClick={() => onRemove(file)} style={styles.removeBtn} title="Remove">
                <X size={12} />
            </button>
        )}
    </div>
);

// --- 🛠️ HELPER: SORTING & GROUPING ---
const segregateAndSortTasks = (tasks, groupByLabel) => {
    if (!groupByLabel) {
        const sortedTasks = [...tasks].sort((a, b) => {
            const aProject = a.project_id || 'no_project';
            const bProject = b.project_id || 'no_project';
            if (aProject !== bProject) return aProject.localeCompare(bProject);
            return a.content.localeCompare(b.content);
        });
        return { 'ALL TASKS': sortedTasks };
    }
    
    const groupedByLabel = tasks.reduce((acc, task) => {
        const primaryLabel = task.labels && task.labels.length > 0 ? task.labels[0] : 'UNLABELED';
        if (!acc[primaryLabel]) acc[primaryLabel] = [];
        acc[primaryLabel].push(task);
        return acc;
    }, {});

    Object.keys(groupedByLabel).forEach(key => {
        groupedByLabel[key].sort((a, b) => a.content.localeCompare(b.content));
    });

    return groupedByLabel;
};

export default function TasksView({ tasks = [], refreshData, onFileUpload ,isLoading})  { 
    // State
    const [localTasks, setLocalTasks] = useState(tasks)
    const [loading, setLoading] = useState(false)
    const [groupByLabel, setGroupByLabel] = useState(true)
    const [expandedGroups, setExpandedGroups] = useState(false) 
    const [searchQuery, setSearchQuery] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editMode, setEditMode] = useState(false)
    const [currentTaskId, setCurrentTaskId] = useState(null)
    const [viewTask, setViewTask] = useState(null)
    const [isUploading, setIsUploading] = useState(false)

    // Form Data (Now includes separate 'attachments' array)
    const [formData, setFormData] = useState({
        content: '',
        description: '', 
        labels: [],
        attachments: [] 
    })

    useEffect(() => { setLocalTasks(tasks) }, [tasks])
    
    useEffect(() => {
        const initialGroups = segregateAndSortTasks(localTasks, groupByLabel);
        const keys = Object.keys(initialGroups);
        const expandedState = {};
        keys.forEach(key => expandedState[key] = false);
        setExpandedGroups(expandedState);
    }, [localTasks, groupByLabel]);

    const refreshTasks = async () => {
    try {

        const res = await axios.get('http://127.0.0.1:8000/dashboard/todoist')
        setLocalTasks(res.data)
    } catch(e) { 
        console.error(e) 
    } 
}

    const toggleGroup = (groupName) => {
        setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
    };

    // --- 📎 PARSER: Separate Text from Files ---
    const parseTaskDetails = (rawDesc) => {
        if (!rawDesc) return { cleanDesc: '', attachments: [] };
        const lines = rawDesc.split('\n');
        const cleanLines = [];
        const attachments = [];

        lines.forEach(line => {
            if (line.trim().startsWith('Attachment:')) {
                const splitIndex = line.lastIndexOf(' - http');
                if (splitIndex !== -1) {
                    const name = line.substring(11, splitIndex).trim(); 
                    const url = line.substring(splitIndex + 3).trim(); 
                    attachments.push({ name, url });
                } else {
                    cleanLines.push(line);
                }
            } else {
                cleanLines.push(line);
            }
        });
        return { cleanDesc: cleanLines.join('\n').trim(), attachments };
    };

    // --- ACTIONS ---
    const handleComplete = async (id) => {
        try {
            await axios.post(`http://127.0.0.1:8000/dashboard/todoist/tasks/${id}/complete`)
            refreshTasks()
        } catch(e) { alert("Error completing task") }
    }

    const handleDelete = async (id) => {
        if(!confirm("Delete this task?")) return;
        try {
            await axios.delete(`http://127.0.0.1:8000/dashboard/todoist/tasks/${id}`)
            refreshTasks()
        } catch(e) { alert("Error deleting task") }
    }

    // --- MODALS ---
    const openAddModal = () => {
        setEditMode(false)
        setFormData({ content: '', description: '', labels: [], attachments: [] })
        setIsModalOpen(true)
    }

    const openEditModal = (e, task) => {
    e.stopPropagation()
    setEditMode(true)
    setCurrentTaskId(task.id)
    
    // 🧠 Smart Parse: Separate text and files
    const { cleanDesc, attachments } = parseTaskDetails(task.description || '');

    setFormData({
        content: task.content,
        description: cleanDesc,
        labels: task.labels || [],
        attachments: attachments
    })
    
    // 🔄 Close view modal when opening edit
    setViewTask(null) 
    setIsModalOpen(true)
}

    const openViewModal = (e, task) => {
        e.stopPropagation()
        setViewTask(task)
    }

    // --- FILE UPLOAD ---

const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
        // Use the axios instance passed from App.jsx
        const res = await onFileUpload(file);
        
        // ✅ ADD: Log what we're sending
        console.log('Upload response:', res);
        
        if (res && res.filename && res.link) {
            const newFile = { name: res.filename, url: res.link };
            setFormData(prev => ({ ...prev, attachments: [...prev.attachments, newFile] }));
            alert("File attached successfully!");
        } else {
            console.error('Invalid response format:', res);
            alert("Upload failed: Invalid server response");
        }
    } catch (err) {
        console.error('Upload error:', err);
        let errorMessage = "Upload failed: ";
        
        if (err.response) {
            errorMessage += `${err.response.status}: ${err.response.data?.detail || err.response.data?.message || 'Server error'}`;
        } else if (err.request) {
            errorMessage += "No response from server. Check your connection.";
        } else {
            errorMessage += err.message;
        }
        
        alert(errorMessage);
    } finally {
        setIsUploading(false);
        e.target.value = '';
    }
};
    const handleRemoveFile = (fileToRemove) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.filter(f => f.url !== fileToRemove.url)
        }));
    }

    // --- SUBMIT ---
const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
        // 🧠 Recombine: Merge text and files for storage
        let finalDescription = formData.description;
        if (formData.attachments.length > 0) {
            const attachmentString = formData.attachments
                .map(f => `Attachment: ${f.name} - ${f.url}`)
                .join('\n');
            finalDescription = finalDescription ? `${finalDescription}\n\n${attachmentString}` : attachmentString;
        }

        const payload = { 
            content: formData.content,
            description: finalDescription,
            labels: formData.labels 
        }

        if (editMode) {
            // ✅ IMMEDIATE LOCAL UPDATE
            const updatedTask = {
                id: currentTaskId,
                content: formData.content,
                description: finalDescription,
                labels: formData.labels,
                due: localTasks.find(t => t.id === currentTaskId)?.due,
                project_id: localTasks.find(t => t.id === currentTaskId)?.project_id
            };
            
            // Update local state instantly
            setLocalTasks(prev => prev.map(task => 
                task.id === currentTaskId ? { ...task, ...updatedTask } : task
            ));
            
            // Send to server
            await axios.post(`http://127.0.0.1:8000/dashboard/todoist/tasks/${currentTaskId}`, payload)
        } else {
            await axios.post(`http://127.0.0.1:8000/dashboard/todoist/tasks`, payload)
            // For new tasks, refresh from server
            await refreshTasks();
        }
        
        setIsModalOpen(false)
    } catch(e) {
        alert("Error saving task")
    } finally {
        setLoading(false)
    }
}

    // --- 🔍 SEARCH ALGORITHM ---
    const filteredTasks = localTasks.filter(task => {
        if (!searchQuery) return true; // If empty, show all

        const query = searchQuery.toLowerCase();
        
        // 1. Check Task Content (Name)
        const matchesContent = task.content.toLowerCase().includes(query);

        // 2. Check Due Date (e.g., searching "today" or "Friday")
        const matchesDate = task.due?.string?.toLowerCase().includes(query);

        // 3. Check Priority (Convert numbers to text so user can search "High")
        let priorityText = "";
        if (task.priority === 4) priorityText = "critical urgent";
        if (task.priority === 3) priorityText = "high";
        if (task.priority === 2) priorityText = "medium";
        if (task.priority === 1) priorityText = "low";
        const matchesPriority = priorityText.includes(query);

        return matchesContent || matchesDate || matchesPriority;
    });
    const finalGroupedTasks = segregateAndSortTasks(filteredTasks, groupByLabel);
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
        
        <div style={styles.container}>
            {/* Header / Toolbar */}
            <div style={styles.toolbar}>
                <div style={styles.viewToggle}>
                    <button style={groupByLabel ? styles.toggleBtnActive : styles.toggleBtn} onClick={() => setGroupByLabel(true)}><List size={18} /> Label View</button>
                    <button style={!groupByLabel ? styles.toggleBtnActive : styles.toggleBtn} onClick={() => setGroupByLabel(false)}><CheckSquare size={18} /> Flat View</button>
                </div>
                <button onClick={openAddModal} style={styles.addButton}><Plus size={18} /> Add Task</button>
            </div>
<div style={styles.searchContainer}>
    <Search size={20} color="#94a3b8" />
    <input 
        type="text" 
        placeholder="Search tasks, dates, or priority..." 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={styles.searchInput}
    />
    {searchQuery && (
        <button 
            onClick={() => setSearchQuery('')} 
            style={{border:'none', background:'none', cursor:'pointer'}}
        >
            <X size={16} color="#94a3b8"/>
        </button>
    )}
</div>
            {/* Task Lists */}
            <div style={styles.listContainer}>
                {Object.keys(finalGroupedTasks).map(group => (
                    <div key={group} style={styles.groupContainer}>
                        <div style={styles.groupHeader} onClick={() => toggleGroup(group)}>
                            <span style={styles.groupTitle}>{group} ({finalGroupedTasks[group].length})</span>
                            {expandedGroups[group] ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </div>

                        {expandedGroups[group] && (
                            <div style={styles.groupItems}>
                                {finalGroupedTasks[group].map(task => {
                                    const { attachments } = parseTaskDetails(task.description);
                                    return (
                                        <div key={task.id} style={styles.taskCard} onClick={(e) => openViewModal(e, task)}>
                                            <div style={{flex: 1}}>
                                                <div style={styles.taskContent}>{task.content}</div>
                                                <div style={styles.taskMeta}>
                                                    {task.due && <span style={styles.dueTag}>{task.due.date}</span>}
                                                    {attachments.length > 0 && <span style={styles.attachTag}><Paperclip size={10}/> {attachments.length}</span>}
                                                </div>
                                            </div>
                                            <div style={styles.actions}>
                                                <button onClick={(e) => {e.stopPropagation(); handleComplete(task.id)}} style={styles.iconBtn}><CheckCircle size={18} color="#34A853"/></button>
                                                <button onClick={(e) => openEditModal(e, task)} style={styles.iconBtn}><Edit2 size={18} color="#666"/></button>
                                                <button onClick={(e) => {e.stopPropagation(); handleDelete(task.id)}} style={styles.iconBtn}><Trash2 size={18} color="#EA4335"/></button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* --- ADD / EDIT MODAL --- */}
            {isModalOpen && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalContent}>
                        <div style={styles.modalHeader}>
                            <h3>{editMode ? 'Edit Task' : 'New Task'}</h3>
                            <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn}><X size={20}/></button>
                        </div>
                        <form onSubmit={handleSubmit} style={styles.form}>
                            <label style={styles.label}>
                                Task Name
                                <input style={styles.input} value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} required />
                            </label>
                            
                            <label style={styles.label}>
                                Description
                                <textarea style={{...styles.input, minHeight: '60px', resize:'vertical'}} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Notes..." />
                            </label>

                            {/* --- COMPACT SCROLLABLE FILE LIST --- */}
                            {formData.attachments.length > 0 && (
                                <div>
                                    <div style={styles.sectionTitleSmall}>Attachments</div>
                                    <div style={styles.fileGridScrollable}>
                                        {formData.attachments.map((file, i) => (
                                            <AttachmentCard key={i} file={file} onRemove={handleRemoveFile} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                <label style={styles.fileBtn}>
    {isUploading ? (
        <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
            <span style={{width: '12px', height: '12px', border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></span>
            Uploading...
        </span>
    ) : 'Attach File'}
    <input 
        type="file" 
        style={{display:'none'}} 
        onChange={handleFileUpload} 
        disabled={isUploading}
        accept="*/*" // Allow all file types, or specify: "image/*,.pdf,.doc,.docx,.txt"
    />
    <Upload size={14} />
</label>
                                <span style={{fontSize:'0.75rem', color:'#888'}}>(Uploads to Drive)</span>
                            </div>

                            <button type="submit" style={styles.submitBtn} disabled={loading || isUploading}>
                                {loading ? 'Saving...' : 'Save Task'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- VIEW DETAILS MODAL --- */}
            {viewTask && (
                <div style={styles.modalOverlay} onClick={() => setViewTask(null)}>
                    <div style={styles.viewContent} onClick={e => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={{margin:0, fontSize:'1.4rem'}}>{viewTask.content}</h2>
                            <button onClick={() => setViewTask(null)} style={styles.closeBtn}><X size={24}/></button>
                        </div>

                        <div style={styles.viewBody}>
                            {parseTaskDetails(viewTask.description).cleanDesc ? 
                                <p style={styles.viewText}>{parseTaskDetails(viewTask.description).cleanDesc}</p> : 
                                <p style={{color:'#999', fontStyle:'italic'}}>No description.</p>}

                            {parseTaskDetails(viewTask.description).attachments.length > 0 && (
                                <div style={{marginTop:'20px'}}>
                                    <h4 style={styles.sectionTitle}>Attachments</h4>
                                    <div style={styles.fileGridScrollable}>
                                        {parseTaskDetails(viewTask.description).attachments.map((file, i) => <AttachmentCard key={i} file={file} />)}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={styles.viewFooter}>
                            <button onClick={(e) => openEditModal(e, viewTask)} style={styles.editBtnSimple}>Edit</button>
                            <button onClick={() => {handleDelete(viewTask.id); setViewTask(null)}} style={styles.deleteBtnSimple}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ✨ Styles
const styles = {
    container: { padding: '20px 0', minHeight: '100vh', fontFamily: 'inherit' },
    toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' },
    viewToggle: { display: 'flex', background: '#e0e0e0', padding: '4px', borderRadius: '8px', gap: '4px' },
    toggleBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '6px', fontSize: '0.9rem', color: '#666', fontWeight: 500 },
    toggleBtnActive: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: 'none', background: '#fff', cursor: 'pointer', borderRadius: '6px', fontSize: '0.9rem', color: '#000', fontWeight: 600, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    addButton: { background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(228, 67, 50, 0.3)' },
    
    listContainer: { display: 'flex', flexDirection: 'column', gap: '20px' },
    groupContainer: { background: 'transparent' },
    groupHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 5px', borderBottom: '2px solid #eee', marginBottom: '10px', cursor: 'pointer' },
    groupTitle: { fontSize: '1rem', fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.5px' },
    groupItems: { display: 'grid', gap: '10px' },
    
    taskCard: { background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 2px 5px rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' },
    taskContent: { fontSize: '1rem', fontWeight: 500, color: '#333' },
    taskMeta: { display: 'flex', gap: '8px', marginTop: '6px' },
    dueTag: { fontSize: '0.75rem', color: '#15803d ', background: '#ffebeb', padding: '2px 6px', borderRadius: '4px' },
    attachTag: { fontSize: '0.75rem', color: '#15803d ', display:'flex', alignItems:'center', gap:'3px', background: '#e8f0fe', padding: '2px 6px', borderRadius: '4px' },
    
    actions: { display: 'flex', gap: '4px' },
    iconBtn: { background: 'transparent', border: 'none', padding: '8px', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' },

    // Modal
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modalContent: { background: '#fff', padding: '30px', borderRadius: '16px', width: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' },
    closeBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#888' },
    form: { display: 'flex', flexDirection: 'column', gap: '15px' },
    label: { fontSize: '0.9rem', fontWeight: '600', color: '#444', display: 'flex', flexDirection: 'column', gap: '6px' },
    input: { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', outline: 'none', fontFamily: 'inherit' },
    fileBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: '#f1f3f4', color: '#444', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', border: '1px solid #ddd' },
    submitBtn: { marginTop: '10px', background: '#16a34a', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '600', fontSize: '1rem', cursor: 'pointer' },

    // View Modal
    viewContent: { background: '#fff', padding: '30px', borderRadius: '16px', width: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' },
    viewBody: { marginTop: '10px', marginBottom: '20px' },
    viewText: { lineHeight: '1.6', color: '#333', fontSize: '1rem' },
    sectionTitle: { fontSize: '0.85rem', textTransform: 'uppercase', color: '#888', letterSpacing: '0.5px', marginBottom: '10px', fontWeight: '600' },
    sectionTitleSmall: { fontSize: '0.8rem', fontWeight: '600', color: '#666', marginBottom: '8px' },
    viewFooter: { borderTop: '1px solid #eee', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' },
    editBtnSimple: { background: '#fff', border: '1px solid #ddd', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#555' },
    deleteBtnSimple: { background: '#fff', border: '1px solid #ffccc7', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#d93025' },

    // --- COMPACT & SCROLLABLE GRID ---
    fileGridScrollable: { 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', // Compact Cards
        gap: '8px', 
        maxHeight: '140px', // Forces scroll when too many items
        overflowY: 'auto', 
        padding: '2px' 
    },
    fileCard: { 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        padding: '6px 10px', 
        background: '#f8f9fa', 
        borderRadius: '8px', 
        border: '1px solid #e9ecef', 
        textDecoration: 'none', 
        cursor: 'pointer',
        transition: 'background 0.2s',
        fontSize: '0.85rem',
        position: 'relative'
    },
    fileIcon: { width: '24px', height: '24px', background: '#4285F4', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    fileInfo: { overflow: 'hidden', flex: 1 },
    fileName: { display: 'block', fontWeight: '500', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    removeBtn: { background: '#ff4d4f', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', position: 'absolute', top: '-5px', right: '-5px' },
    // Add these to your existing 'styles' object
    searchContainer: {
        marginBottom: '20px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: '0 15px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
    },
    searchInput: {
        width: '100%',
        padding: '12px 10px',
        border: 'none',
        outline: 'none',
        fontSize: '1rem',
        background: 'transparent',
        color: '#334155'
    }

}