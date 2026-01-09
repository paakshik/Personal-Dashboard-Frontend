// components/LoginScreen.jsx
import React from 'react';
import './LoginScreen.css';

function LoginScreen({ handleGoogleLogin }) {
  return (
    <div className="login-container">
      <div className="login-card">
        <h1>System Dashboard</h1>
        <p>Please log in to access your workspace</p>
        <button onClick={handleGoogleLogin} className="login-btn">
          <img 
            src="https://www.svgrepo.com/show/475656/google-color.svg" 
            alt="Google" 
            className="google-icon" 
          />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

export default LoginScreen;