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
router.post('/users', registerUser);  // Remove the duplicate '/api' prefix
router.post('/auth/login', authUser);
router.post('/users/logout', auth, logoutUser);

// Add refresh token endpoint
router.post('/auth/refresh', (req, res) => {
  // Implement token refresh logic here
  const { refreshToken } = req.body;
  
  // Validate refresh token and generate new access token
  // ...
  
  res.json({
    token: "new-access-token",
    refreshToken: "new-refresh-token"
  });
});

// Password reset routes
router.post('/users/forgot-password', forgotPassword);
router.get('/users/reset-password/:token', validateResetToken);
router.post('/users/reset-password', resetPassword);

// Profile routes
router.get('/users/profile', auth, getUserProfile);

module.exports = router;
