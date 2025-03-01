import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import api from '../services/api';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    message: ''
  });
  const history = useHistory();
  
  // Redirect if already logged in
  useEffect(() => {
    if (api.isAuthenticated()) {
      history.replace('/tasks');
    }
  }, [history]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Check password strength when password field changes
    if (name === 'password') {
      checkPasswordStrength(value);
    }
  };
  
  const checkPasswordStrength = (password) => {
    // Basic password strength criteria
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    let score = 0;
    let message = '';
    
    if (password.length < 8) {
      message = 'Password is too short';
    } else {
      if (hasUpperCase) score += 1;
      if (hasLowerCase) score += 1;
      if (hasNumber) score += 1;
      if (hasSpecialChar) score += 1;
      
      if (score <= 1) message = 'Weak';
      else if (score === 2) message = 'Fair';
      else if (score === 3) message = 'Good';
      else message = 'Strong';
    }
    
    setPasswordStrength({ score, message });
  };

  const validateForm = () => {
    // Check if passwords match
    if (formData.password !== formData.confirmPassword) {
      throw new Error('Passwords do not match');
    }
    
    // Check password strength
    if (formData.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      throw new Error('Please enter a valid email address');
    }
    
    // Name validation
    if (!formData.name.trim()) {
      throw new Error('Name is required');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError(null);
      setLoading(true);
      
      // Client-side validation
      validateForm();
      
      // Prepare user data (exclude confirmPassword)
      const userData = {
        name: formData.name,
        email: formData.email,
        password: formData.password
      };
      
      // Register user
      await api.register(userData);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
      });
      
      // Redirect to login with success message
      history.push('/login?registered=true');
    } catch (err) {
      // Extract error message
      const errorMessage = err.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Get color for password strength indicator
  const getPasswordStrengthColor = () => {
    const { score } = passwordStrength;
    if (score === 0) return 'gray';
    if (score === 1) return 'red';
    if (score === 2) return 'orange';
    if (score === 3) return 'blue';
    return 'green';
  };
  
  return (
    <div className="container auth-container">
      <div className="card auth-card">
        <h1 className="auth-title">Create your TaskFlow account</h1>
        
        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={() => setError(null)} className="dismiss-error">×</button>
          </div>
        )}
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name:</label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              disabled={loading}
              className="form-input"
              placeholder="John Doe"
              required
              autoFocus
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              className="form-input"
              placeholder="your@email.com"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              className="form-input"
              placeholder="••••••••••••"
              required
            />
            <div className="password-strength">
              <div className="strength-meter">
                <div 
                  className="strength-fill" 
                  style={{
                    width: `${(passwordStrength.score / 4) * 100}%`,
                    backgroundColor: getPasswordStrengthColor()
                  }}
                ></div>
              </div>
              <small className="form-hint">
                {formData.password ? 
                  `Strength: ${passwordStrength.message}` : 
                  'Must be at least 8 characters long'}
              </small>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password:</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={loading}
              className="form-input"
              placeholder="••••••••••••"
              required
            />
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <small className="form-hint error">Passwords do not match</small>
            )}
          </div>
          
          <div className="terms-agreement">
            <p>
              By registering, you agree to our 
              <a href="/terms" target="_blank" rel="noopener noreferrer"> Terms of Service </a> 
              and 
              <a href="/privacy" target="_blank" rel="noopener noreferrer"> Privacy Policy</a>
            </p>
          </div>
          
          <button 
            className="button button-primary button-block" 
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>Already have an account? <a href="/login">Login</a></p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;