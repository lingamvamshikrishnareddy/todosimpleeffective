// controllers/userController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto'); // For generating reset tokens
const bcrypt = require('bcryptjs'); // Needed for explicit password check if needed

// Generate authentication token (only needed for login now)
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '1d', // Example: 1 day expiry for access token
  });
};

// Generate refresh token (longer expiry)
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d', // Example: 7 days expiry for refresh token
  });
};

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

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
    // Check if user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create new user (password hashing is handled by the pre-save hook in the model)
    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      // Respond with success message, DO NOT send token here
      res.status(201).json({
        message: 'Registration successful. Please log in.',
        user: { // Send minimal non-sensitive info if needed
             _id: user._id,
             name: user.name,
             email: user.email,
        }
      });
    } else {
      // This case might be redundant if User.create throws an error, but good for safety
      res.status(400).json({ message: 'Invalid user data during creation' });
    }
  } catch (error) {
    console.error('Registration Error:', error);
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
  const { email, password } = req.body;

  if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
  }

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      // Generate both access and refresh tokens
      const accessToken = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      // Store refresh token securely in HTTP-only cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development', // Use secure cookies in production
        sameSite: 'strict', // Prevent CSRF
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        message: "Login successful",
        user: { // Send necessary user details
          _id: user._id,
          name: user.name,
          email: user.email,
        },
        token: accessToken, // Access Token
        refreshToken: refreshToken // Send refresh token in body (also set in cookie)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
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
    // Try to get token from cookie first, then body
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token required' });
    }

    try {
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        // Optionally: Check if the refresh token is still valid/not revoked in DB

        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({ message: 'Invalid refresh token - user not found' });
        }

        // Generate a new access token
        const newAccessToken = generateToken(user._id);

        res.json({
            token: newAccessToken,
            // Optionally issue a new refresh token for rotation
            // refreshToken: generateRefreshToken(user._id)
        });

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
 * @access  Private (Requires valid access token to identify user if needed, e.g., invalidate refresh token)
 */
const logoutUser = async (req, res) => {
  try {
    // Optional: Invalidate the refresh token on the server-side if stored
    // const { refreshToken } = req.body; // If sent from client
    // if (refreshToken) {
    //   // ... logic to invalidate ...
    // }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', { 
      httpOnly: true, 
      secure: process.env.NODE_ENV !== 'development', 
      sameSite: 'strict' 
    });

    res.status(200).json({ message: 'Logged out successfully' });
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
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address' });
  }
  
  try {
    const user = await User.findOne({ email });

    if (!user) {
      // Security: Don't reveal if email exists
      return res.status(200).json({
        message: 'If an account with that email exists, password reset instructions have been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 minutes expiry

    await user.save({ validateBeforeSave: false }); // Skip validation for these fields

    // Create reset URL (Ensure FRONTEND_URL is set in your .env)
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    // TODO: Implement actual email sending logic here
    // For development only - remove in production
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV ONLY] Password Reset URL for ${email}: ${resetUrl}`);
    }
    // await sendEmail({ to: user.email, subject: 'Password Reset', text: `Reset link: ${resetUrl}` });

    res.status(200).json({
      message: 'If an account with that email exists, password reset instructions have been sent.'
    });

  } catch (error) {
      console.error('Forgot Password Error:', error);
      // Attempt to clear potentially saved token info on error
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
  const { token } = req.params;

  try {
    // Hash the incoming token to compare with the stored hash
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user by hashed token and check expiry
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired' });
    }

    // Token is valid
    res.status(200).json({ message: 'Token is valid' });
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
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
  }
  if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  try {
    // Hash the incoming token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user by hashed token and check expiry
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired' });
    }

    // Set new password (hashing handled by pre-save hook)
    user.password = newPassword;

    // Clear the reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save(); // This will trigger the pre-save hook to hash the new password

    // Just confirm success and let them log in manually
    res.json({ message: 'Password reset successful. You can now log in with your new password.' });

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
  try {
    // req.user is populated by the auth middleware
    const user = await User.findById(req.user.id).select('-password'); // Use req.user.id

    if (user) {
      res.json({ // Structure consistently
          _id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
      });
    } else {
      // This case should be rare if token is valid but user deleted
      res.status(404).json({ message: 'User not found' });
    }
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
    const { name, email } = req.body;
    const userId = req.user.id;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if email is changing and if it's already taken
        if (email && email !== user.email) {
            // Email format validation
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
            updatedAt: updatedUser.updatedAt
        });

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

        // Check if current password matches
        if (!(await user.matchPassword(currentPassword))) {
            return res.status(401).json({ message: 'Incorrect current password' });
        }

        // Set new password (hashing handled by pre-save hook)
        user.password = newPassword;
        await user.save();

        res.json({ message: 'Password changed successfully' });

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