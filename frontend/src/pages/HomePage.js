import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import './HomePage.css'; // Import the dedicated CSS file



const HomePage = () => {
  return (
    <>
      <Helmet>
        <title>TaskFlow - Effortless Task & Note Management</title>
        <meta name="description" content="TaskFlow helps you organize tasks, capture notes, and boost productivity. Simple, powerful, and synced across devices." />
        <meta name="keywords" content="task management, note taking, productivity, organization, to-do list, project management, study helper" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Helmet>

      <div className="page-container"> {/* Main container for the whole page */}

        {/* Improved Header (Optional: Move to a separate Header component later) */}
        <header className="app-header">
           <div className="header-content">
              <Link to="/" className="app-logo">TaskFlow</Link>
              <nav className="main-nav">
                 {/* Add actual links later if needed */}
                 <a href="#features">Features</a>
                 <a href="#how-it-works">How It Works</a>
                 {/* Conditionally show Login/Register or Dashboard based on auth state */}
                 <Link to="/login" className="button button-primary" style={{marginLeft: '25px', padding: '8px 18px'}}>Login</Link>
              </nav>
           </div>
        </header>

        {/* Hero Section */}
        <section className="hero-section">
          <h1 className="hero-title">Stop Juggling, Start Organizing</h1>
          <p className="hero-subtitle">
            TaskFlow brings your tasks and notes together in one seamless,
            intuitive platform. Focus on what matters, achieve more, stress less.
          </p>
          <div className="cta-buttons">
            <Link to="/register" className="button button-primary">Get Started for Free</Link>
            <Link to="/login" className="button button-secondary">Sign In</Link>
          </div>
        </section>

        {/* Features/Benefits Section */}
        <section id="features" className="benefits-section content-wrapper">
          <h2 className="section-title">Why Choose TaskFlow?</h2>
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">📝</div>
              <h3>Effortless Task Management</h3>
              <p>Create, categorize, prioritize, and track your to-dos with a clean, user-friendly interface.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📒</div>
              <h3>Integrated Note Taking</h3>
              <p>Capture ideas, meeting minutes, or research notes right alongside your tasks. Never lose context.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Seamless Cloud Sync</h3>
              <p>Access your tasks and notes instantly from any device. Your data is always up-to-date.</p>
            </div>
             <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3>Customizable Views</h3>
              <p>Organize your workspace the way you think with flexible boards, lists, and tagging options.</p>
            </div>
             <div className="feature-card">
              <div className="feature-icon">🔔</div>
              <h3>Smart Reminders</h3>
              <p>Stay on track with timely reminders and notifications so you never miss a deadline.</p>
            </div>
             <div className="feature-card">
              <div className="feature-icon">🤝</div>
              <h3>Collaboration Ready</h3>
              <p>(Coming Soon!) Share projects and tasks with your team or family members.</p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="how-it-works-section content-wrapper">
          <h2 className="section-title">Get Productive in 3 Simple Steps</h2>
          <div className="steps-container">
            <div className="step-item">
              <div className="step-number">1</div>
              <h4>Sign Up Quickly</h4>
              <p>Create your free TaskFlow account in seconds. No credit card required.</p>
            </div>
            <div className="step-item">
              <div className="step-number">2</div>
              <h4>Create & Organize</h4>
              <p>Add your tasks and notes. Use tags, projects, and due dates to structure your work.</p>
            </div>
            <div className="step-item">
              <div className="step-number">3</div>
              <h4>Access Anywhere</h4>
              <p>Use TaskFlow on your web browser, desktop, or mobile device. Your data syncs everywhere.</p>
            </div>
          </div>
        </section>

       

        {/* Testimonial Section */}
        <section className="testimonial-section content-wrapper">
            <h2 className="section-title" style={{color: 'white', opacity: 0.9}}>What Our Users Say</h2>
          <div className="testimonial">
            <p className="testimonial-quote">"TaskFlow has completely transformed how I manage my freelance projects and personal life. Having tasks and notes together is a game-changer!"</p>
            <p className="testimonial-author">- Alex R., Web Developer</p>
          </div>
        </section>

        {/* Final CTA Section */}
         <section className="final-cta-section content-wrapper">
            <h2 className="final-cta-title">Ready to Take Control of Your Day?</h2>
            <p className="final-cta-text">Join thousands of users who rely on TaskFlow to stay organized and achieve their goals. Sign up today!</p>
            <div className="final-cta-buttons">
                <Link to="/register" className="button button-primary">Start Free Trial</Link>
                {/* Optionally add another button, e.g., for pricing */}
            </div>
        </section>


        {/* Footer */}
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-links">
                    {/* Use actual routes */}
                    <Link to="/about">About Us</Link>
                    <Link to="/privacy">Privacy Policy</Link>
                    <Link to="/terms">Terms of Service</Link>
                    <Link to="/contact">Contact</Link>
                </div>
                <p className="copyright">© {new Date().getFullYear()} TaskFlow. All rights reserved.</p>
            </div>
        </footer>

      </div> {/* End page-container */}
    </>
  );
};

export default HomePage;