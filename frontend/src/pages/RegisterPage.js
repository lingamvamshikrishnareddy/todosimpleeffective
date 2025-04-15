// pages/RegisterPage.jsx
import React, { useState, useEffect } from 'react';
import { useHistory, Link } from 'react-router-dom';
import api from '../services/api';
import './registerpage.css'; // <--- IMPORT THE CSS FILE

const RegisterPage = () => {
  // ... (all state and functions remain the same)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, message: '' });
  const history = useHistory();

  // Redirect if already logged in
  useEffect(() => {
    if (api.auth.isAuthenticated()) {
      history.replace('/tasks');
    }
    // Same dependency logic as LoginPage
  }, [history]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'password') {
      checkPasswordStrength(value);
    }
    // Clear specific errors when user types (logic unchanged)
    if (name === 'password' || name === 'confirmPassword') {
      if (error === 'Passwords do not match') setError(null);
    }
    if (name === 'password') {
      if (error === 'Password must be at least 8 characters long') setError(null);
      if (error === 'Password is too weak. Include uppercase, lowercase, numbers, or symbols.') setError(null);
    }
    if (name === 'email') {
      if (error === 'Please enter a valid email address') setError(null);
    }
    if (name === 'name') {
      if (error === 'Name is required') setError(null);
    }
  };

  const checkPasswordStrength = (password) => {
    // Logic unchanged
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);
    let score = 0;
    let message = '';

    if (password.length < 8) {
      message = 'Too short (min 8 chars)';
      score = 0;
    } else {
      score += 1;
      if (hasUpperCase) score += 1;
      if (hasLowerCase) score += 1;
      if (hasNumber) score += 1;
      if (hasSpecialChar) score += 1;
      if (password.length >= 12) score += 1; // Max score 6

      if (score <= 2) message = 'Weak';
      else if (score <= 4) message = 'Fair';
      else if (score === 5) message = 'Good';
      else message = 'Strong';
    }
    setPasswordStrength({ score, message });
  };


  const validateForm = () => {
    // Logic unchanged
    if (!formData.name.trim()) {
      throw new Error('Name is required');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      throw new Error('Please enter a valid email address');
    }
    if (formData.password.length < 8) { // Check length first
        throw new Error('Password must be at least 8 characters long');
    }
    // Adjusted the weak check slightly to only trigger if length is okay but strength is low
    if (passwordStrength.score < 3 && formData.password.length >= 8) { // Score 3 = Fair start
        throw new Error('Password is too weak. Include uppercase, lowercase, numbers, or symbols.');
    }
    if (formData.password !== formData.confirmPassword) {
      throw new Error('Passwords do not match');
    }
  };


  const handleSubmit = async (e) => {
    // Logic unchanged
    e.preventDefault();
    setError(null);

    try {
      validateForm();
      setLoading(true);

      const userData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password
      };

      const response = await api.auth.register(userData);

      console.log('Registration response:', response);
      history.push('/login?registered=true');

    } catch (err) {
      const errorMessage = err.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    // Logic unchanged
    const score = passwordStrength.score;
    if (!formData.password || score === 0) return '#dc3545'; // Start red if too short
    if (score <= 2) return '#f44336'; // Weak (Red)
    if (score <= 4) return '#ff9800'; // Fair (Orange)
    if (score === 5) return '#2196f3'; // Good (Blue)
    return '#4caf50'; // Strong (Green)
  };

  return (
    <div className="container auth-container">
      <div className="card auth-card">
        <h1 className="auth-title">Create your TaskFlow account</h1>

        {error && (
          <div className="alert alert-danger alert-dismissible">
            <span>{error}</span> {/* Wrap text in span */}
            <button onClick={() => setError(null)} className="btn-close" aria-label="Close">
              ×
            </button>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="name">Full Name:</label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              disabled={loading}
              className="form-input" // Use consistent class
              placeholder="e.g., Jane Doe"
              required
              autoFocus // Keep autoFocus
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
              className="form-input" // Use consistent class
              placeholder="your.email@example.com"
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
              className="form-input" // Use consistent class
              placeholder="Create a strong password"
              required
              aria-describedby="passwordHelp"
            />
            {/* Password Strength Meter - using existing classes */}
            <div className="password-strength-meter mt-2"> {/* Added wrapper class */}
              <div className="progress" style={{ height: '8px' }}>
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{
                    // Calculate width based on score (max 6)
                    width: `${Math.max(0, (passwordStrength.score / 6) * 100)}%`,
                    backgroundColor: getPasswordStrengthColor(),
                    transition: 'width 0.3s ease-in-out, background-color 0.3s ease-in-out' // Added bg color transition
                  }}
                  aria-valuenow={passwordStrength.score}
                  aria-valuemin="0"
                  aria-valuemax="6"
                ></div>
              </div>
              <small id="passwordHelp" className="form-text text-muted d-block mt-1">
                {formData.password ? (
                   <>Strength: <span style={{ color: getPasswordStrengthColor(), fontWeight: 'bold' }}>{passwordStrength.message || ' '}</span></> // Show message or space
                ) : (
                    "Minimum 8 characters." // Default help text
                )}
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
              // Keep dynamic class for validation feedback
              className={`form-input ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'is-invalid' : ''}`}
              placeholder="Re-enter your password"
              required
            />
            {/* Keep validation feedback structure */}
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <div className="invalid-feedback d-block">
                Passwords do not match.
              </div>
            )}
          </div>

          {/* Terms Agreement - using existing classes */}
          <div className="terms-agreement form-text text-muted small my-3">
            By registering, you agree to our
            <Link to="/terms" target="_blank" rel="noopener noreferrer"> Terms of Service </Link>
            and
            <Link to="/privacy" target="_blank" rel="noopener noreferrer"> Privacy Policy</Link>.
          </div>

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
                <span> Creating Account...</span>
              </>
            ) : 'Register'}
          </button>
        </form>

        {/* Footer Link - using existing class mt-4 */}
        <div className="auth-footer mt-4">
          <p>Already have an account? <Link to="/login">Login</Link></p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;