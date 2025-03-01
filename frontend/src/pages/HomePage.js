import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet'; // For meta tags

const HomePage = () => {
  return (
    <>
      <Helmet>
        <title>TaskFlow - Organize Your Life</title>
        <meta name="description" content="A powerful to-do list and note-taking application to help you stay organized and productive." />
        <meta name="keywords" content="task management, note taking, productivity, organization, to-do list" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Helmet>
      
      <div className="container">
        <div className="header">
          <h1>TaskFlow</h1>
        </div>
        
        <div className="content-section">
          <h1 className="page-title">Organize Your Tasks & Notes in One Place</h1>
          
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">📝</div>
              <h3>Task Management</h3>
              <p>Create, organize and prioritize tasks with ease</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📒</div>
              <h3>Note Taking</h3>
              <p>Capture your ideas instantly, access them anytime</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Seamless Sync</h3>
              <p>Your data syncs across all your devices</p>
            </div>
          </div>
          
          <div className="cta-container">
            <Link to="/login" className="button">Sign In</Link>
            <Link to="/register" className="button button-outline">Create Account</Link>
          </div>
          
          <div className="testimonial">
            <p>"TaskFlow has completely transformed how I organize my work and personal life!"</p>
            <p className="testimonial-author">- Sarah J., Product Manager</p>
          </div>
        </div>
        
        <footer className="footer">
          <div className="footer-links">
            <Link to="/about">About</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/contact">Contact Us</Link>
          </div>
          <p className="copyright">© 2025 TaskFlow. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
};

export default HomePage;