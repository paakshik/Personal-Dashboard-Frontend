// src/styles/styles.jsx
// Shared Styles - Refined Dark Theme
export const cardStyle = { 
    backgroundColor: '#252526', // Card background (for Dashboard)
    padding: '30px', 
    borderRadius: '12px', 
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)', // Dark mode shadow
    transition: 'transform 0.2s',
    border: '1px solid #333',
    color: '#dddddd' // Light text
}
export const headerStyle = { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px', 
    marginBottom: '1rem', 
    borderBottom: '1px solid #333', 
    paddingBottom: '0.5rem',
    color: '#00ccff' // Bright accent for headers
}
export const itemStyle = { 
    display: 'flex', 
    alignItems: 'center', 
    marginBottom: '8px', 
    padding: '12px', 
    background: '#333333', // Item background
    borderRadius: '8px', 
    transition: 'background 0.2s, transform 0.1s', 
    justifyContent: 'space-between',
    color: '#cccccc' // Muted text color for items
}
export const emptyStyle = { color: '#888', fontStyle: 'italic', padding: '10px' }
export const moreButtonStyle = {
    background: 'none',
    border: 'none',
    color: '#00ccff', // Accent color
    marginTop: '20px', 
    padding: '8px 0',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '1rem', 
    fontWeight: '500'
}

// Full Page Styles (Used by ScheduleView and EmailsView)
export const fullPageStyle = { 
    padding: '35px', 
    backgroundColor: '#252526', 
    borderRadius: '12px', 
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
    border: '1px solid #333',
    color: '#dddddd'
}
export const fullPageHeaderStyle = { 
    borderBottom: '2px solid #333', 
    paddingBottom: '10px', 
    marginBottom: '15px', 
    display: 'flex', 
    alignItems: 'center',
    color: '#00ccff'
}
export const fullDetailItemStyle = { 
    padding: '20px', 
    background: '#333333', 
    borderRadius: '8px', 
    display: 'flex', 
    flexDirection: 'column', 
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
    borderLeft: '4px solid #00ccff30', // Subtle accent bar
    color: '#dddddd'
}