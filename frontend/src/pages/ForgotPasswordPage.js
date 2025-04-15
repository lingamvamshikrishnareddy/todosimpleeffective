import React, { useState, useEffect } from 'react';
import { Link, useParams, useHistory, useLocation } from 'react-router-dom';
import api from '../services/api';

// Define support email centrally
const SUPPORT_EMAIL = 'lingamvamshikrishnareddy@gmail.com';

// Helper component for the support link
const ContactSupportLink = () => (
  <p>
    Having trouble? <a href={`mailto:${SUPPORT_EMAIL}`}>Contact Support</a>
  </p>
);

const PasswordResetPage = () => {
  // --- States remain the same ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(null); // null: initial, true: valid, false: invalid
  const [validating, setValidating] = useState(false); // Renamed for clarity

  // --- Hooks remain the same ---
  const { token } = useParams();
  const history = useHistory();
  const location = useLocation(); // Kept in case needed later, though not directly used in logic now

  // Determine which view to show based on token presence
  const isResetView = !!token;

  // --- useEffect for token validation remains the same ---
  useEffect(() => {
    // Only run if we are in the reset view (token exists)
    if (isResetView) {
      const validateToken = async () => {
        setValidating(true); // Start validating
        setError(null); // Clear previous errors
        setTokenValid(null); // Reset validation status

        try {
          // Assume api.validateResetToken throws an error for invalid tokens
          await api.validateResetToken(token);
          setTokenValid(true); // Token is valid
        } catch (err) {
          console.error('Token validation error:', err);
          setTokenValid(false); // Token is invalid
          // Provide a user-friendly error message
          setError(err.response?.data?.message || err.message || 'This password reset link is invalid or has expired.');
        } finally {
          setValidating(false); // Stop validating
        }
      };

      validateToken();
    } else {
        // If not in reset view, ensure validation state is off
        setValidating(false);
        setTokenValid(null);
    }
    // Dependency array ensures this runs when `token` or `isResetView` changes
  }, [token, isResetView]);

  // --- Event Handlers remain mostly the same, added error logging ---
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Clear previous errors
    setSuccess(false); // Reset success state
    setLoading(true);

    if (!email.trim()) {
      setError('Email is required');
      setLoading(false);
      return; // Stop execution if validation fails
    }

    try {
      await api.forgotPassword({ email });
      setSuccess(true); // Show success message
      setEmail(''); // Clear the email field
    } catch (err) {
      console.error('Forgot password error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to process your request. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Clear previous errors
    setSuccess(false); // Reset success state
    setLoading(true);

    // Client-side validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await api.resetPassword({ token, password });
      setSuccess(true); // Show success message
      // Clear form fields
      setPassword('');
      setConfirmPassword('');

      // Redirect to login after a delay
      setTimeout(() => {
        history.push('/login');
      }, 3000); // 3-second delay

    } catch (err) {
      console.error('Reset password error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to reset password. Please try again.';
      setError(errorMessage);
       // Check if the error indicates the token is now invalid (e.g., expired after page load)
      if (err.response?.status === 400 || err.message.toLowerCase().includes('token')) {
         setTokenValid(false); // Mark token as invalid based on API response
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Render Logic ---

  // 1. Show loading state while validating token
  if (isResetView && validating) {
    return (
      <div className="container auth-container">
        <div className="card auth-card">
          <h1 className="auth-title">Reset Password</h1>
          <div className="loading-state">
            <p>Validating your password reset link...</p>
            {/* Optional: Add a spinner animation here */}
          </div>
        </div>
      </div>
    );
  }

  // 2. Show error view if token is invalid (and not validating)
  // Use `tokenValid === false` for explicit invalid state check
  if (isResetView && tokenValid === false && !validating) {
    return (
      <div className="container auth-container">
        <div className="card auth-card">
          <h1 className="auth-title">Reset Password</h1>
          {error && ( // Show the specific error message
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}
          <div className="auth-footer">
            <p>Need to reset your password again? <Link to="/forgot-password">Request a new link</Link>.</p>
            <ContactSupportLink /> {/* Added Contact Support Link */}
            <p>Or return to <Link to="/login">Login</Link>.</p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Main View (Forgot Password or Reset Password Form/Success)
  return (
    <div className="container auth-container">
      <div className="card auth-card">
        <h1 className="auth-title">{isResetView ? 'Set New Password' : 'Forgot Password'}</h1>

        {/* General Error Display Area (for API errors during submit, etc.) */}
        {error && !success && ( // Only show submit errors if not in success state
            <div className="error-message">
                <p>{error}</p>
                <button onClick={() => setError(null)} className="dismiss-error" aria-label="Dismiss error">×</button>
                {/* Also offer support for general errors */}
                <ContactSupportLink />
            </div>
        )}

        {/* Success Message Area */}
        {success ? (
          <div className="success-container">
            <div className="success-message">
              {isResetView ? (
                <>
                  <p>✅ Your password has been successfully reset!</p>
                  <p>Redirecting you to the login page shortly...</p>
                </>
              ) : (
                <>
                  <p>✅ Password reset instructions sent!</p>
                  <p>Please check your email ({email || 'provided address'}) and follow the link to reset your password.</p>
                </>
              )}
            </div>
            <div className="auth-footer">
              <p><Link to="/login">Return to Login</Link></p>
              {/* Optional: Add support link here too if desired */}
              {/* <ContactSupportLink /> */}
            </div>
          </div>
        ) : (
          <>
            {/* Conditional Form Rendering */}
            {isResetView && tokenValid === true ? ( // Show reset form only if token is validated
              <form className="auth-form" onSubmit={handleResetSubmit} noValidate>
                <p className="form-instructions">
                  Please enter and confirm your new password below.
                </p>
                <div className="form-group">
                  <label htmlFor="password">New Password:</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="form-input"
                    placeholder="Enter new password"
                    required
                    minLength={8} // HTML5 validation hint
                    aria-describedby="password-hint" // Accessibility
                    autoFocus
                  />
                  <small id="password-hint" className="form-hint">Must be at least 8 characters long.</small>
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm New Password:</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="form-input"
                    placeholder="Confirm new password"
                    required
                    minLength={8}
                  />
                </div>

                <button
                  className="button button-primary button-block"
                  type="submit"
                  disabled={loading || !password || !confirmPassword || password !== confirmPassword} // Basic button disable
                >
                  {loading ? 'Resetting...' : 'Set New Password'}
                </button>
                 <div className="auth-footer">
                     <ContactSupportLink /> {/* Added Contact Support Link */}
                     <p><Link to="/login">Back to Login</Link></p>
                 </div>
              </form>
            ) : !isResetView ? ( // Show forgot form if not in reset view
              <form className="auth-form" onSubmit={handleForgotSubmit} noValidate>
                <p className="form-instructions">
                  Enter your account's email address and we will send you a link to reset your password.
                </p>

                <div className="form-group">
                  <label htmlFor="email">Email Address:</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="form-input"
                    placeholder="e.g., yourname@example.com"
                    required
                    autoFocus
                  />
                </div>

                <button
                  className="button button-primary button-block"
                  type="submit"
                  disabled={loading || !email.trim()} // Disable if loading or email empty
                >
                  {loading ? 'Sending Link...' : 'Send Password Reset Link'}
                </button>

                <div className="auth-footer">
                  <p>Remembered your password? <Link to="/login">Login here</Link></p>
                  <ContactSupportLink /> {/* Added Contact Support Link */}
                </div>
              </form>
            ) : null /* Should not happen if logic above is correct, but prevents rendering stale form */}
          </>
        )}
      </div>
    </div>
  );
};

export default PasswordResetPage;