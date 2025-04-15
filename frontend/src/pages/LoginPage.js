// pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useHistory, useLocation, Link } from 'react-router-dom';
import api from '../services/api';
import './loginpage.css'; // <--- IMPORT THE CSS FILE

// Function to parse query params
function useQuery() {
  // ... (rest of the function remains the same)
  return new URLSearchParams(useLocation().search);
}

const LoginPage = () => {
  // ... (all state and functions remain the same)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null); // For registration success
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const query = useQuery(); // Hook to get query params

  // Check for registration success message on mount
  useEffect(() => {
    if (query.get('registered') === 'true') {
      setSuccessMessage('Registration successful! Please log in.');
      // Optional: Remove the query param from URL without reload
      history.replace('/login');
    }
    if (query.get('sessionExpired') === 'true') {
        setError('Your session has expired. Please log in again.');
        history.replace('/login');
    }
    // Removed dependency array warning suppression, added proper dependencies
  }, [query, history]); // Correct dependencies

  // Redirect if already logged in (runs after checking query params)
  useEffect(() => {
    if (api.auth.isAuthenticated()) {
      history.replace('/tasks'); // Use replace so back button doesn't go to login
    }
    // Removed api.auth from dependency array as isAuthenticated likely doesn't change
    // based on the api.auth instance itself but its internal state.
    // If isAuthenticated *itself* could change reference, add api.auth.
  }, [history]); // Correct dependencies

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null); // Clear success message on new attempt

    // Basic client-side validation
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password.trim()) {
        setError('Password is required');
        return;
    }

    setLoading(true);
    try {
      await api.auth.login({ email, password });
      history.push('/tasks');

    } catch (err) {
      const errorMessage = err.message || 'Login failed. Please check your credentials.';
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

        {/* Success Message (e.g., after registration) */}
        {successMessage && (
          // Added alert-dismissible for styling consistency with error
          <div className="alert alert-success alert-dismissible">
            <span>{successMessage}</span> {/* Wrap text in span for flex alignment */}
             <button onClick={() => setSuccessMessage(null)} className="btn-close" aria-label="Close">
                ×
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="alert alert-danger alert-dismissible">
            <span>{error}</span> {/* Wrap text in span for flex alignment */}
            <button onClick={() => setError(null)} className="btn-close" aria-label="Close">
                ×
            </button>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Email Input */}
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="form-input" // Use consistent class
              placeholder="your.email@example.com"
              required
              autoFocus // Keep autoFocus
            />
          </div>

          {/* Password Input */}
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="form-input" // Use consistent class
              placeholder="Enter your password"
              required
            />
          </div>

          {/* Forgot Password Link */}
          {/* Kept existing classes text-end mb-3 */}
          <div className="forgot-password text-end mb-3">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>

          {/* Submit Button */}
          <button
            // Use consistent button classes
            className="button button-primary button-block"
            type="submit"
            disabled={loading}
          >
            {loading ? (
                 <>
                    {/* Use consistent spinner classes */}
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span> Logging in...</span>
                </>
            ) : 'Login'}
          </button>
        </form>

        {/* Footer Link */}
        {/* Kept existing class mt-4 */}
        <div className="auth-footer mt-4">
          <p>Don't have an account? <Link to="/register">Register</Link></p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;