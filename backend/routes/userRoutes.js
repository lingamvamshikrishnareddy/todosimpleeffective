// In routes/userRoutes.js
const express = require('express');
const { 
  registerUser, 
  authUser, 
  logoutUser,
  forgotPassword,
  validateResetToken,
  resetPassword,
  getUserProfile
} = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// Auth routes
router.post('/users', registerUser);  // Changed from '/auth/register' to '/users'
router.post('/auth/login', authUser);
router.post('/users/logout', auth, logoutUser);  // Changed from '/auth/logout' to '/users/logout'

// Add refresh token endpoint
router.post('/auth/refresh', (req, res) => {
  // Implement token refresh logic here
  // This is a placeholder for the actual implementation
  const { refreshToken } = req.body;
  
  // Validate refresh token and generate new access token
  // ...
  
  res.json({
    token: "new-access-token",
    refreshToken: "new-refresh-token"
  });
});

// Password reset routes
router.post('/users/forgot-password', forgotPassword);  // Changed from '/auth/forgot-password'
router.get('/users/reset-password/:token', validateResetToken);  // Changed from '/auth/reset-password/:token'
router.post('/users/reset-password', resetPassword);  // Changed from '/auth/reset-password'

// Profile routes
router.get('/users/profile', auth, getUserProfile);  // Changed from '/profile'

module.exports = router;