import React from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TaskPage from './pages/TaskPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import './styles/styles.css';

const App = () => {
  return (
    <Router>
      <Route path="/" component={HomePage} exact />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/tasks" component={TaskPage} />
      <Route path = "/forgotpassword" component={ForgotPasswordPage} />
    </Router>
  );
};

export default App;
