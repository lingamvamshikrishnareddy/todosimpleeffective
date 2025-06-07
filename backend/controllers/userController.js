// controllers/userController.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Import User model with error handling
let User;
try {
  User = require('../models/User');
  console.log('User model imported successfully');
} catch (error) {
  console.error('Error importing User model:', error);
  throw error;
}

// Verify User model has required methods
if (!User || typeof User.findOne !== 'function') {
  console.error('User model is not properly initialized as a Mongoose model');
  throw new Error('User model initialization failed');
}

// Generate authentication token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '1d',
  });
};

// Generate refresh token
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
};

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res) => {
  const startTime = Date.now();
  const { name, email, password } = req.body;

  console.log('Registration attempt for:', email); // Debug log

  // Basic input validation
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please provide name, email, and password' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address' });
  }

  try {
    // Verify User model is available
    if (!User || typeof User.findOne !== 'function') {
      console.error('User model not available in registerUser function');
      return res.status(500).json({ message: 'Database model error' });
    }

    console.log('Checking if user exists...'); // Debug log
    
    // Check if user already exists
    const userExists = await User.findOne({ email }).lean();
    console.log('User exists check completed:', !!userExists); // Debug log

    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    console.log('Creating new user...'); // Debug log
    
    // Create new user
    const user = await User.create({
      name,
      email,
      password,
    });

    console.log('User created successfully:', user._id); // Debug log

    if (user) {
      res.status(201).json({
        message: 'Registration successful. Please log in.',
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
        }
      });
    } else {
      res.status(400).json({ message: 'Invalid user data during creation' });
    }
    console.log(`Registration operation took ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('Registration Error:', error);
    console.error('Error stack:', error.stack);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    res.status(500).json({
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Authenticate user & get tokens
 * @route   POST /api/auth/login
 * @access  Public
 */
const authUser = async (req, res) => {
  const startTime = Date.now();
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  try {
    // Verify User model is available
    if (!User || typeof User.findOne !== 'function') {
      console.error('User model not available in authUser function');
      return res.status(500).json({ message: 'Database model error' });
    }

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      const accessToken = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        message: "Login successful",
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
        },
        token: accessToken,
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
    console.log(`Login operation took ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Refresh access token using refresh token
 * @route   POST /api/auth/refresh
 * @access  Public (requires valid refresh token)
 */
const refreshToken = async (req, res) => {
  const startTime = Date.now();
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('_id').lean();

    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token - user not found' });
    }

    const newAccessToken = generateToken(user._id);

    res.json({
      token: newAccessToken,
    });
    console.log(`Token refresh operation took ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('Token Refresh Error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({ message: 'Invalid or expired refresh token' });
    }
    res.status(500).json({ message: 'Server error during token refresh' });
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logoutUser = async (req, res) => {
  const startTime = Date.now();
  try {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict'
    });

    res.status(200).json({ message: 'Logged out successfully' });
    console.log(`Logout operation took ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({
      message: 'Error during logout',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Request password reset (forgot password)
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  const startTime = Date.now();
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        message: 'If an account with that email exists, password reset instructions have been sent.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV ONLY] Password Reset URL for ${email}: ${resetUrl}`);
    }

    res.status(200).json({
      message: 'If an account with that email exists, password reset instructions have been sent.'
    });
    console.log(`Forgot password operation took ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('Forgot Password Error:', error);
    try {
      const user = await User.findOne({ email });
      if (user && user.resetPasswordToken) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });
      }
    } catch (cleanupError) {
      console.error('Error cleaning up reset token after failure:', cleanupError);
    }
    res.status(500).json({
      message: 'Server error during password reset request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Validate password reset token
 * @route   GET /api/auth/reset-password/:token
 * @access  Public
 */
const validateResetToken = async (req, res) => {
  const startTime = Date.now();
  const { token } = req.params;

  try {
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired' });
    }

    res.status(200).json({ message: 'Token is valid' });
    console.log(`Validate reset token operation took ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('Validate Reset Token Error:', error);
    res.status(500).json({
      message: 'Server error validating token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Reset password using token
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
const resetPassword = async (req, res) => {
  const startTime = Date.now();
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Token and new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  try {
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired' });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.json({ message: 'Password reset successful. You can now log in with your new password.' });
    console.log(`Reset password operation took ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({
      message: 'Server error during password reset',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get user profile
 * @route   GET /api/user/profile
 * @access  Private
 */
const getUserProfile = async (req, res) => {
  const startTime = Date.now();
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
    console.log(`Get profile operation took ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({
      message: 'Server error retrieving user profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/user/profile
 * @access  Private
 */
const updateUserProfile = async (req, res) => {
  const startTime = Date.now();
  const { name, email } = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (email && email !== user.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Please provide a valid email address' });
      }

      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
    }

    if (name) {
      user.name = name;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      createdAt: updatedUser.createdAt,
      updatedUser: updatedUser.updatedAt
    });
    console.log(`Update profile operation took ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({
      message: 'Error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Change user password
 * @route   PUT /api/user/password
 * @access  Private
 */
const changePassword = async (req, res) => {
  const startTime = Date.now();
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Both current and new passwords are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters long' });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
    console.log(`Change password operation took ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({
      message: 'Error changing password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  registerUser,
  authUser,
  refreshToken,
  logoutUser,
  forgotPassword,
  validateResetToken,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  changePassword
};
