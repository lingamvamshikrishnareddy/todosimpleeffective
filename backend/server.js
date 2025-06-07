const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const { errorHandler } = require('./middleware/errorMiddleware');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

// Connect to MongoDB database
connectDB();

const app = express();

// --- CORS Configuration ---
// Define allowed origins for CORS requests
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://todosimpleeffective.vercel.app',
  'https://todosimpleeffective-axj2d72g9.vercel.app', // Add your actual frontend URL
  // Add pattern to catch all your Vercel preview deployments
  /^https:\/\/todosimpleeffective-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/,
];

// Configure CORS options
const corsOptions = {
  origin: function (origin, callback) {
    console.log(`CORS check for origin: ${origin}`); // Debug log
    
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // Check string origins
    if (allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    })) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// --- Global Middleware ---
// Apply CORS middleware before other middleware/routes
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Middleware to parse cookies
app.use(cookieParser());

// Middleware to parse JSON request bodies
app.use(express.json());

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.get('Origin') || 'No Origin'}`);
  next();
});

// --- API Routes ---
app.use('/api/tasks', taskRoutes);
app.use('/api', userRoutes);

// --- Static File Serving (Production) ---
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('API is running in development mode...');
  });
}

// --- Custom Error Handling Middleware ---
app.use(errorHandler);

// --- Start Server ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`Allowing CORS requests from: ${allowedOrigins.filter(o => typeof o === 'string').join(', ')}`);
  console.log(`FRONTEND_URL from env: ${process.env.FRONTEND_URL}`);
});
