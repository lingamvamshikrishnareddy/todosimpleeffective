// routes/userRoutes.js
const express = require('express');
const {
  registerUser,
  authUser,
  refreshToken, // Import refreshToken
  logoutUser,
  forgotPassword,
  validateResetToken,
  resetPassword,
  getUserProfile,
  updateUserProfile, // Import updateUserProfile
  changePassword // Import changePassword
} = require('../controllers/userController');
const auth = require('../middleware/authMiddleware'); // Ensure this correctly verifies JWT

const router = express.Router();

// --- Authentication Routes ---
router.post('/auth/register', registerUser);
router.post('/auth/login', authUser);
router.post('/auth/refresh', refreshToken); // Add refresh route
router.post('/auth/logout', logoutUser); // Logout might not need auth middleware if just clearing client-side state, but good practice if invalidating server tokens

// --- Password Reset Routes ---
router.post('/auth/forgot-password', forgotPassword); // Changed to /auth/forgot-password
router.get('/auth/reset-password/:token', validateResetToken); // Changed to /auth/reset-password/:token
router.post('/auth/reset-password/confirm', resetPassword); // Changed to /auth/reset-password/confirm

// --- User Profile Routes (Protected) ---
router.get('/user/profile', auth, getUserProfile); // Route requires authentication
router.put('/user/profile', auth, updateUserProfile); // Add update profile route
router.put('/user/password', auth, changePassword); // Add change password route


// --- Deprecated/Incorrect routes to remove or correct ---
// router.post('/users', registerUser); // Remove this if using /auth/register
// router.post('/users/logout', auth, logoutUser); // Remove this if using /auth/logout
// router.get('/users/profile', auth, getUserProfile); // Remove this if using /user/profile


module.exports = router;