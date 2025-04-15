import React from 'react';
import {
  BrowserRouter as Router,
  Route,
  Switch, // Import Switch for exclusive routing
  Redirect // Import Redirect for private routes and default behavior
} from 'react-router-dom';

// --- Page Imports ---
import HomePage from './pages/HomePage'; // Assuming you still want this for a public landing page
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TaskPage from './pages/TaskPage'; // This should likely be private
import ForgotPasswordPage from './pages/ForgotPasswordPage';
// Import the reset page

// --- Service Imports (needed for auth check in PrivateRoute) ---
import api from './services/api'; // Make sure this path is correct

// --- Styles ---
import './styles/styles.css'; // Assuming this is your main stylesheet

// --- Private Route Component ---
// This component checks if the user is authenticated.
// If yes, it renders the requested component (e.g., TaskPage).
// If no, it redirects the user to the login page.
const PrivateRoute = ({ component: Component, ...rest }) => (
  <Route
    {...rest}
    render={props =>
      api.auth.isAuthenticated() ? ( // Use your actual auth check logic here
        <Component {...props} />
      ) : (
        <Redirect
          to={{
            pathname: '/login',
            // Pass the current location so we can redirect back after login
            state: { from: props.location, sessionExpired: true } // Optional: pass state like sessionExpired
          }}
        />
      )
    }
  />
);


// --- App Component ---
const App = () => {
  return (
    <Router>
      {/* Switch renders the *first* route that matches */}
      <Switch>
        {/* Public Routes */}
        {/* Consider if HomePage is truly needed or if '/' should redirect */}
        <Route path="/" component={HomePage} exact />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        {/* Standardize path to kebab-case */}
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        {/* Route for the actual password reset page (requires token) */}
      

        {/* Private Routes */}
        {/* Use the PrivateRoute component for pages requiring authentication */}
        <PrivateRoute path="/tasks" component={TaskPage} />

        {/* Fallback Redirect (Optional but recommended) */}
        {/* If no other route matches, redirect based on auth status */}
        <Route path="*">
           {api.auth.isAuthenticated() ? <Redirect to="/tasks" /> : <Redirect to="/login" />}
           {/* Or redirect to a dedicated 404 page */}
           {/* <NotFoundPage /> */}
        </Route>

      </Switch>
    </Router>
  );
};

export default App;