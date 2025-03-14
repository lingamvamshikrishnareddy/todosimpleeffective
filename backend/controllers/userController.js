const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto'); // For generating reset tokens
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
// Generate authentication token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

/**
 * @desc    Register new user
 * @route   POST /api/users
 * @access  Public
 */
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  const userExists = await User.findOne({ email });
  
  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }
  
  // Create new user
  const user = await User.create({
    name,
    email,
    password, // This should be hashed in the User model pre-save hook
  });
  
  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } else {
    res.status(400).json({ message: 'Invalid user data' });
  }
});

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/users/login
 * @access  Public
 */
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  
  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } else {
    res.status(401).json({ message: 'Invalid email or password' });
  }
});

/**
 * @desc    Logout user / clear cookie
 * @route   POST /api/users/logout
 * @access  Private
 */
const logoutUser = asyncHandler(async (req, res) => {
  // If using cookies for authentication:
  if (req.cookies && req.cookies.jwt) {
    res.clearCookie('jwt');
  }
  
  res.status(200).json({ message: 'Logged out successfully' });
});

/**
 * @desc    Request password reset (forgot password)
 * @route   POST /api/users/forgot-password
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  
  if (!user) {
    // For security reasons, we still return a 200 response
    // to not expose which emails are registered
    return res.status(200).json({ 
      message: 'If an account with that email exists, we have sent password reset instructions.' 
    });
  }
  
  // Generate reset token and expiry date
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 minutes
  
  await user.save();
  
  // Create reset URL
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  
  // Send email with reset URL
  // Note: Implementation of sendEmail function would depend on your email service
  // This is a placeholder for the actual email sending functionality
  try {
    // await sendEmail({
    //   email: user.email,
    //   subject: 'Password Reset Instructions',
    //   message: `Please use the following link to reset your password: ${resetUrl}. This link will expire in 30 minutes.`
    // });
    
    // For now, we'll just log the URL
    console.log(`Reset URL: ${resetUrl}`);
    
    res.status(200).json({ 
      message: 'Password reset email sent' 
    });
  } catch (emailError) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    
    return res.status(500).json({ 
      message: 'Error sending email. Please try again later.' 
    });
  }
});

/**
 * @desc    Validate password reset token
 * @route   GET /api/users/reset-password/:token
 * @access  Public
 */
const validateResetToken = asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  // Hash token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  // Find user with matching token and valid expiry
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });
  
  if (!user) {
    return res.status(400).json({ message: 'Password reset token is invalid or has expired' });
  }
  
  res.status(200).json({ message: 'Token is valid' });
});

/**
 * @desc    Reset password
 * @route   PUT /api/users/reset-password
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  
  // Hash token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  // Find user with matching token and valid expiry
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });
  
  if (!user) {
    return res.status(400).json({ message: 'Password reset token is invalid or has expired' });
  }
  
  // Set new password
  user.password = password;
  
  // Clear reset token fields
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  
  await user.save();
  
  // Return new token for automatic login after password reset
  res.json({
    message: 'Password reset successful',
    token: generateToken(user._id)
  });
});

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
});

module.exports = {
  registerUser,
  authUser,
  logoutUser,
  forgotPassword,
  validateResetToken,
  resetPassword,
  getUserProfile
};
