// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Simple in-memory cache for authenticated users
const userCache = new Map();

/**
 * Authentication middleware
 * Verifies JWT token and adds user to request object
 * Includes performance optimizations with caching
 */
const auth = async (req, res, next) => {
  const startTime = Date.now();
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    // Check if token exists in cookie if not in header
    const cookieToken = req.cookies?.jwt;
    const finalToken = token || cookieToken;
    
    // Check if no token
    if (!finalToken) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    // Verify token
    const decoded = jwt.verify(finalToken, process.env.JWT_SECRET);
    
    // Check cache first to avoid database query
    if (userCache.has(decoded.id)) {
      req.user = userCache.get(decoded.id);
      console.log(`Auth operation with cache hit took ${Date.now() - startTime}ms`);
      return next();
    }
    
    // Find user by id if not in cache
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Set user in cache with 5-minute expiry
    userCache.set(decoded.id, user);
    setTimeout(() => userCache.delete(decoded.id), 5 * 60 * 1000);
    
    // Set user in request
    req.user = user;
    console.log(`Auth operation with DB query took ${Date.now() - startTime}ms`);
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;