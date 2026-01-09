import React, { useState } from 'react'
import { Calendar, Plus, Trash2, X, Edit2, Video, FileText, Upload, Link as LinkIcon, Eye, ExternalLink, Paperclip } from 'lucide-react'
import { TrophySpin } from "react-loading-indicators";

// --- 💎 COMPONENT: ATTACHMENT CARD (Unified UI) ---
const AttachmentCard = ({ file, onRemove }) => (
    <div style={styles.fileCard}>
        <a 
            href={file.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{display:'flex', alignItems:'center', gap:'12px', textDecoration:'none', color:'inherit', flex:1}}
            title={`Open ${file.name}`}
            onClick={(e) => e.stopPropagation()} 
        >
            <div style={styles.fileIcon}>
                <FileText size={20} color="#fff"/>
            </div>
            <div style={styles.fileInfo}>
                <span style={styles.fileName}>{file.name}</span>
                <span style={styles.fileMeta}>
                    Click to open <ExternalLink size={10} style={{ marginLeft: 3 }}/>
                </span>
            </div>
        </a>
        {/* Optional: Remove button if in Edit Mode */}
        {onRemove && (
            <button onClick={() => onRemove(file)} style={styles.removeBtn} title="Remove file">
                <X size={14} />
            </button>
        )}
    </div>
);

export default function ScheduleView({ events = [], refreshData, onFileUpload,isLoading }) {
    const safeEvents = Array.isArray(events) ? events : [];
    const totalEvents = safeEvents.reduce((count, group) => count + group.events.length, 0)
    
    // State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [viewEvent, setViewEvent] = useState(null) 
    
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isUploading, setIsUploading] = useState(false) 
    const [editMode, setEditMode] = useState(false)
    const [currentEventId, setCurrentEventId] = useState(null)

    // Form Data (Now includes 'attachments' array)
    const [formData, setFormData] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        description: '',
        meetingLink: '',
        attachments: [] // 👈 SEPARATE ARRAY FOR FILES
    })

    const triggerRefresh = () => {
        if (typeof refreshData === 'function') refreshData();
        else window.location.reload();
    }

    // --- 📎 PARSER: ROBUST ATTACHMENT EXTRACTION ---
    // Reads the description string and separates "Real Text" from "File Links"
    const parseEventDetails = (rawDesc) => {
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

        return { 
            cleanDesc: cleanLines.join('\n').trim(), 
            attachments 
        };
    };

    // --- OPEN MODAL (ADD) ---
    const openAddModal = () => {
        setEditMode(false)
        setViewEvent(null)
        setFormData({
            title: '',
            date: new Date().toISOString().split('T')[0],
            startTime: '09:00',
            endTime: '10:00',
            description: '',
            meetingLink: '',
            attachments: [] 
        })
        setIsModalOpen(true)
    }

    // --- OPEN MODAL (EDIT) ---
    const openEditModal = (e, event) => {
        e.stopPropagation();
        setEditMode(true)
        setViewEvent(null)
        setCurrentEventId(event.id)
        
        const startIso = event.start_raw;
        const endIso = event.end_raw;
        let dateVal = startIso.includes('T') ? startIso.split('T')[0] : startIso;
        let startVal = startIso.includes('T') ? startIso.split('T')[1].substring(0, 5) : '09:00';
        let endVal = endIso.includes('T') ? endIso.split('T')[1].substring(0, 5) : '10:00';

        // 🧠 SMART PARSE: Separate text from files so the box is clean
        const { cleanDesc, attachments } = parseEventDetails(event.description || '');

        setFormData({
            title: event.title,
            date: dateVal,
            startTime: startVal,
            endTime: endVal,
            description: cleanDesc, // Only text goes here
            meetingLink: event.location || '',
            attachments: attachments // Files go here
        })
        setIsModalOpen(true)
    }

    // --- OPEN VIEW DETAILS ---
    const openViewModal = (e, event) => {
        e.stopPropagation();
        setViewEvent(event); 
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        
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

    // --- ADD THIS MISSING FUNCTION ---
    const handleRemoveFile = (fileToRemove) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.filter(f => f.url !== fileToRemove.url)
        }));
    }

    // --- SUBMIT ---
    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsSubmitting(true)

        const startDateTime = `${formData.date}T${formData.startTime}:00`
        const endDateTime = `${formData.date}T${formData.endTime}:00`

        // 🧠 RECOMBINE: Merge text + files before sending to backend
        let finalDescription = formData.description;
        if (formData.attachments.length > 0) {
            const attachmentString = formData.attachments
                .map(f => `Attachment: ${f.name} - ${f.url}`)
                .join('\n');
            finalDescription = finalDescription ? `${finalDescription}\n\n${attachmentString}` : attachmentString;
        }

        const payload = {
            summary: formData.title,
            description: finalDescription, 
            location: formData.meetingLink, 
            start_time: startDateTime,
            end_time: endDateTime
        }

        try {
            let url = 'http://127.0.0.1:8000/dashboard/calendar/events';
            let method = 'POST';
            if (editMode) {
                url = `http://127.0.0.1:8000/dashboard/calendar/events/${currentEventId}`;
                method = 'PUT';
            }
            const token = localStorage.getItem('token');
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Failed to save event")
            setIsModalOpen(false)
            triggerRefresh() 
        } catch (err) {
            alert("Error saving event: " + err.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteEvent = async (eventId) => {
        if (!window.confirm("Are you sure?")) return;
        try {
            const token = localStorage.getItem('token');
            await fetch(`http://127.0.0.1:8000/dashboard/calendar/events/${eventId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            setViewEvent(null); 
            triggerRefresh() 
        } catch (err) { alert(err.message) }
    }
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
            {/* Header */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px'}}>
                <div>
                    <h2 style={styles.header}>
                        <Calendar size={28} style={styles.headerIcon} />
                        Upcoming Schedule
                    </h2>
                    <p style={styles.subtitle}>{totalEvents} upcoming event{totalEvents !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={openAddModal} style={styles.addButton}>
                    <Plus size={20} /> Add Event
                </button>
            </div>

            {/* Events List */}
            {safeEvents.length ? (
                safeEvents.map((group, idx) => (
                    <div key={idx} style={styles.dateContainer}>
                        <h3 style={styles.dateLabel}>{group.date_display}</h3>
                        <div style={styles.cardGrid}>
                            {group.events.map((e, eIdx) => {
                                const { cleanDesc, attachments } = parseEventDetails(e.description);
                                return (
                                    <div key={eIdx} className="card" style={styles.card}>
                                        <div style={{flex: 1}}>
                                            <div style={styles.cardHeader}>
                                                <span style={styles.eventTime}>{e.time}</span>
                                                {e.location && (
                                                    <a href={e.location} target="_blank" rel="noopener noreferrer" style={styles.meetBadge} onClick={ev => ev.stopPropagation()}>
                                                        <Video size={14} /> Join
                                                    </a>
                                                )}
                                            </div>
                                            <span style={styles.eventTitle}>{e.title}</span>
                                            
                                            {/* Preview Description */}
                                            {cleanDesc && (
                                                <div style={styles.descPreview}>
                                                    {cleanDesc.substring(0, 50)}{cleanDesc.length > 50 ? '...' : ''}
                                                </div>
                                            )}

                                            {/* Attachment Indicator */}
                                            {attachments.length > 0 && (
                                                <div style={styles.attachmentBadge}>
                                                    <Paperclip size={12}/> {attachments.length} File{attachments.length > 1 ? 's' : ''}
                                                </div>
                                            )}
                                        </div>
                                        <div style={styles.actions}>
                                            <button onClick={(ev) => openViewModal(ev, e)} style={{...styles.iconBtn, color: '#34A853'}} title="View Details">
                                                <Eye size={18} />
                                            </button>
                                            <button onClick={(ev) => openEditModal(ev, e)} style={styles.iconBtn} title="Edit">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteEvent(e.id)} style={{...styles.iconBtn, color: '#ff4d4f'}} title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))
            ) : (<p style={styles.empty}>No events scheduled.</p>)}

            {/* --- MODAL: ADD / EDIT --- */}
            {isModalOpen && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalContent}>
                        <div style={styles.modalHeader}>
                            <h3>{editMode ? 'Edit Event' : 'New Event'}</h3>
                            <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn}><X size={20}/></button>
                        </div>
                        
                        <form onSubmit={handleSubmit} style={styles.form}>
                            <label style={styles.label}>
                                Title
                                <input style={styles.input} value={formData.title} onChange={ev => setFormData({...formData, title: ev.target.value})} required />
                            </label>

                            <label style={styles.label}>
                                <div style={{display:'flex', justifyContent:'space-between'}}>
                                    <span>Meeting Link</span>
                                    <LinkIcon size={14} color="#666"/>
                                </div>
                                <input 
                                    style={styles.input} 
                                    value={formData.meetingLink} 
                                    onChange={ev => setFormData({...formData, meetingLink: ev.target.value})}
                                    placeholder="https://zoom.us/..." 
                                />
                            </label>

                            <label style={styles.label}>
                                Description
                                <textarea 
                                    style={{...styles.input, minHeight: '80px', resize:'vertical'}} 
                                    value={formData.description} 
                                    onChange={ev => setFormData({...formData, description: ev.target.value})}
                                    placeholder="Notes..."
                                />
                            </label>

                            {/* --- FILE PREVIEW AREA (Clean Icons, no text clutter) --- */}
                            {formData.attachments.length > 0 && (
                                <div style={{marginBottom: '5px'}}>
                                    <div style={styles.sectionTitleSmall}>Attachments</div>
                                    <div style={styles.fileGrid}>
                                        {formData.attachments.map((file, i) => (
                                            <AttachmentCard 
                                                key={i} 
                                                file={file} 
                                                onRemove={handleRemoveFile} // Allow removing in Edit mode
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* FILE UPLOAD BUTTON */}
                            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                <label style={styles.fileBtn}>
                                    {isUploading ? 'Uploading...' : 'Upload File'}
                                    <input type="file" style={{display:'none'}} onChange={handleFileUpload} disabled={isUploading} />
                                    <Upload size={16} />
                                </label>
                                <span style={{fontSize:'0.75rem', color:'#888'}}>
                                    (Uploads to Google Drive)
                                </span>
                            </div>

                            <div style={{display: 'flex', gap: '15px'}}>
                                <label style={{...styles.label, flex: 1}}>
                                    Date
                                    <input type="date" style={styles.input} value={formData.date} onChange={ev => setFormData({...formData, date: ev.target.value})} required />
                                </label>
                                <label style={{...styles.label, flex: 1}}>
                                    Start
                                    <input type="time" style={styles.input} value={formData.startTime} onChange={ev => setFormData({...formData, startTime: ev.target.value})} required />
                                </label>
                                <label style={{...styles.label, flex: 1}}>
                                    End
                                    <input type="time" style={styles.input} value={formData.endTime} onChange={ev => setFormData({...formData, endTime: ev.target.value})} required />
                                </label>
                            </div>

                            <button type="submit" style={styles.submitBtn} disabled={isSubmitting || isUploading}>
                                {isSubmitting ? 'Saving...' : (editMode ? 'Update Event' : 'Create Event')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL: VIEW DETAILS --- */}
            {viewEvent && (
                <div style={styles.modalOverlay} onClick={() => setViewEvent(null)}>
                    <div style={styles.viewContent} onClick={e => e.stopPropagation()}>
                        <div style={styles.viewHeader}>
                            <h2 style={{margin:0, fontSize:'1.5rem'}}>{viewEvent.title}</h2>
                            <button onClick={() => setViewEvent(null)} style={styles.closeBtn}><X size={24}/></button>
                        </div>
                        
                        <div style={{marginBottom:'20px'}}>
                            <p style={styles.viewTime}>{viewEvent.time} • {viewEvent.date_display}</p>
                            {viewEvent.location && (
                                <a href={viewEvent.location} target="_blank" rel="noopener noreferrer" style={styles.viewMeetingBtn}>
                                    <Video size={18}/> Join Meeting
                                </a>
                            )}
                        </div>

                        <div style={styles.viewSection}>
                            <h4 style={styles.viewLabel}>Description</h4>
                            {parseEventDetails(viewEvent.description).cleanDesc ? (
                                <p style={styles.viewText}>{parseEventDetails(viewEvent.description).cleanDesc}</p>
                            ) : <p style={{color:'#999', fontStyle:'italic'}}>No description provided.</p>}
                        </div>

                        {/* ATTACHMENTS (Read Only) */}
                        {parseEventDetails(viewEvent.description).attachments.length > 0 && (
                            <div style={styles.viewSection}>
                                <h4 style={styles.viewLabel}>Attachments</h4>
                                <div style={styles.fileGrid}>
                                    {parseEventDetails(viewEvent.description).attachments.map((file, i) => (
                                        <AttachmentCard key={i} file={file} />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={styles.viewFooter}>
                            <button onClick={(e) => { setViewEvent(null); openEditModal(e, viewEvent); }} style={styles.editBtnSimple}>
                                Edit Event
                            </button>
                            <button onClick={() => handleDeleteEvent(viewEvent.id)} style={styles.deleteBtnSimple}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ... (styles remain the same)
const styles = {
    container: { padding: "10px 0", minHeight: "100vh", background: "var(--bg-main)", fontFamily: 'inherit' },
    header: { fontSize: "2rem", fontWeight: 700, display: "flex", alignItems: "center", color: "var(--text-main)", marginBottom: "6px" },
    headerIcon: { color: "#34A853", marginRight: "10px" },
    subtitle: { color: "var(--text-muted)", fontSize: "1rem" },
    addButton: { background: '#34A853', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(52, 168, 83, 0.3)' },
    dateContainer: { marginBottom: "35px" },
    dateLabel: { fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", padding: "10px 0", borderBottom: "1px solid #e0e0e0", marginBottom: "18px" },
    cardGrid: { display: "grid", gap: "18px", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))" },
    card: { background: "var(--bg-card)", padding: "18px", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-subtle)", border: "1px solid #ededed", display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    cardHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' },
    eventTitle: { display: 'block', fontWeight: 600, fontSize: "1.05rem", color: "var(--text-main)", marginBottom: '6px' },
    eventTime: { fontSize: "0.9rem", color: "#34A853", fontWeight: 500 },
    meetBadge: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', background: '#E6F4EA', color: '#137333', padding: '2px 8px', borderRadius: '12px', textDecoration: 'none', fontWeight: '600', border: '1px solid #CEEAD6' },
    descPreview: { fontSize: '0.85rem', color: '#888', marginTop: '4px' },
    attachmentBadge: { fontSize: '0.75rem', color: '#1a73e8', display:'flex', alignItems:'center', gap:'4px', marginTop:'6px', fontWeight:'500'},
    actions: { display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: '10px' },
    iconBtn: { background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', padding: '6px', borderRadius: '6px' },
    empty: { textAlign: "center", marginTop: "60px", fontSize: "1.1rem", color: "var(--text-muted)" },
    
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modalContent: { background: '#fff', padding: '30px', borderRadius: '16px', width: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' },
    closeBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#888' },
    form: { display: 'flex', flexDirection: 'column', gap: '15px' },
    label: { fontSize: '0.9rem', fontWeight: '600', color: '#444', display: 'flex', flexDirection: 'column', gap: '6px' },
    input: { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', outline: 'none', fontFamily: 'inherit' },
    fileBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: '#f1f3f4', color: '#444', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', border: '1px solid #ddd' },
    submitBtn: { marginTop: '10px', background: '#34A853', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '600', fontSize: '1rem', cursor: 'pointer' },
    
    viewContent: { background: '#fff', padding: '30px', borderRadius: '16px', width: '520px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' },
    viewBody: { marginTop: '10px', marginBottom: '20px' },
    viewText: { lineHeight: '1.6', color: '#333', fontSize: '1rem' },
    sectionTitle: { fontSize: '0.85rem', textTransform: 'uppercase', color: '#888', letterSpacing: '0.5px', marginBottom: '10px', fontWeight: '600' },
    sectionTitleSmall: { fontSize: '0.8rem', fontWeight: '600', color: '#666', marginBottom: '8px' },
    viewMeetingBtn: { display: 'inline-flex', alignItems:'center', gap:'8px', background: '#34A853', color: '#fff', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem' },
    viewFooter: { borderTop: '1px solid #eee', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' },
    editBtnSimple: { background: '#fff', border: '1px solid #ddd', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#555' },
    deleteBtnSimple: { background: '#fff', border: '1px solid #ffccc7', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#d93025' },

    // --- COMPACT SCROLLABLE GRID ---
    fileGridScrollable: { 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
        gap: '8px', 
        maxHeight: '140px', 
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
        position: 'relative'
    },
    fileIcon: { width: '24px', height: '24px', background: '#4285F4', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    fileInfo: { overflow: 'hidden', flex: 1 },
    fileName: { display: 'block', fontSize: '0.85rem', fontWeight: '500', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    removeBtn: { background: '#ff4d4f', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', position: 'absolute', top: '-5px', right: '-5px' }
}