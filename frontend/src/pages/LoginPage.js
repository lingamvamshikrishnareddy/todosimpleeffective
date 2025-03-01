import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import api from '../services/api';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  
  // Redirect if already logged in
  React.useEffect(() => {
    if (api.isAuthenticated()) {
      history.replace('/tasks');
    }
  }, [history]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError(null);
      setLoading(true);
      
      // Client-side validation
      if (!email.trim()) {
        throw new Error('Email is required');
      }
      
      if (!password.trim()) {
        throw new Error('Password is required');
      }
      
      // Attempt login with rate limiting built into API service
      await api.login({ email, password });
      
      // Clear form fields
      setEmail('');
      setPassword('');
      
      // Redirect to tasks page
      history.push('/tasks');
    } catch (err) {
      // Extract error message
      const errorMessage = err.message || 'Login failed. Please check your credentials and try again.';
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container auth-container">
      <div className="card auth-card">
        <h1 className="auth-title">Login to TaskFlow</h1>
        
        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={() => setError(null)} className="dismiss-error">×</button>
          </div>
        )}
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="form-input"
              placeholder="your@email.com"
              required
              autoFocus
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="form-input"
              placeholder="••••••••••••"
              required
            />
          </div>
          
          <div className="forgot-password">
            <a href="/forgot-password">Forgot password?</a>
          </div>
          
          <button 
            className="button button-primary button-block" 
            type="submit"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>Don't have an account? <a href="/register">Register</a></p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;