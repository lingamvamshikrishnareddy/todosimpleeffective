import React, { useState, useEffect } from 'react';
import { Link, useParams, useHistory, useLocation } from 'react-router-dom';
import api from '../services/api';

const PasswordResetPage = () => {
  // States for both forgot password and reset password functionality
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(null);
  const [validating, setValidating] = useState(false);
  
  // Get token from URL params if available
  const { token } = useParams();
  const history = useHistory();
  const location = useLocation();
  
  // Determine which view to show based on token presence
  const isResetView = !!token;
  
  // Validate token on component mount if in reset view
  useEffect(() => {
    if (isResetView) {
      const validateToken = async () => {
        try {
          setValidating(true);
          await api.validateResetToken(token);
          setTokenValid(true);
        } catch (err) {
          setTokenValid(false);
          setError('This password reset link is invalid or has expired.');
        } finally {
          setValidating(false);
        }
      };
      
      validateToken();
    }
  }, [token, isResetView]);
  
  // Handle forgot password submit
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError(null);
      setLoading(true);
      
      // Client-side validation
      if (!email.trim()) {
        throw new Error('Email is required');
      }
      
      // Call API to send password reset email
      await api.forgotPassword({ email });
      
      // Show success message
      setSuccess(true);
      setEmail('');
    } catch (err) {
      // Extract error message
      const errorMessage = err.message || 'Failed to process your request. Please try again.';
      setError(errorMessage);
      console.error('Forgot password error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle reset password submit
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError(null);
      setLoading(true);
      
      // Client-side validation
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
      
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      
      // Call API to reset password
      await api.resetPassword({ token, password });
      
      // Show success message
      setSuccess(true);
      
      // Clear form
      setPassword('');
      setConfirmPassword('');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        history.push('/login');
      }, 3000);
    } catch (err) {
      // Extract error message
      const errorMessage = err.message || 'Failed to reset password. Please try again.';
      setError(errorMessage);
      console.error('Reset password error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Show loading state while validating token
  if (isResetView && validating) {
    return (
      <div className="container auth-container">
        <div className="card auth-card">
          <h1 className="auth-title">Reset Password</h1>
          <div className="loading-state">
            <p>Validating your request...</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Show error if token is invalid
  if (isResetView && !tokenValid && !validating) {
    return (
      <div className="container auth-container">
        <div className="card auth-card">
          <h1 className="auth-title">Reset Password</h1>
          <div className="error-message">
            <p>{error}</p>
          </div>
          <div className="auth-footer">
            <p>Need to reset your password? <Link to="/forgot-password">Request a new link</Link></p>
            <p>Or return to <Link to="/login">Login</Link></p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container auth-container">
      <div className="card auth-card">
        <h1 className="auth-title">{isResetView ? 'Reset Password' : 'Forgot Password'}</h1>
        
        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={() => setError(null)} className="dismiss-error">×</button>
          </div>
        )}
        
        {success ? (
          <div className="success-container">
            <div className="success-message">
              {isResetView ? (
                <>
                  <p>Your password has been successfully reset!</p>
                  <p>You will be redirected to the login page in a few seconds...</p>
                </>
              ) : (
                <>
                  <p>Password reset instructions have been sent to your email.</p>
                  <p>Please check your inbox and follow the instructions to reset your password.</p>
                </>
              )}
            </div>
            <div className="auth-footer">
              <p><Link to="/login">Return to Login</Link></p>
            </div>
          </div>
        ) : (
          <>
            {isResetView ? (
              <form className="auth-form" onSubmit={handleResetSubmit}>
                <div className="form-group">
                  <label htmlFor="password">New Password:</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="form-input"
                    placeholder="••••••••••••"
                    required
                    autoFocus
                  />
                  <small className="form-hint">Must be at least 8 characters long</small>
                </div>
                
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password:</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="form-input"
                    placeholder="••••••••••••"
                    required
                  />
                </div>
                
                <button 
                  className="button button-primary button-block" 
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Resetting Password...' : 'Reset Password'}
                </button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={handleForgotSubmit}>
                <p className="form-instructions">
                  Enter your email address below and we'll send you instructions to reset your password.
                </p>
                
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
                
                <button 
                  className="button button-primary button-block" 
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Reset Instructions'}
                </button>
                
                <div className="auth-footer">
                  <p>Remember your password? <Link to="/login">Login</Link></p>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PasswordResetPage;