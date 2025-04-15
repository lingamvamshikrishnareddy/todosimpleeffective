const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes'); // Assuming this includes /api/auth and /api/user routes
const { errorHandler } = require('./middleware/errorMiddleware');
const cors = require('cors'); // Already imported
const cookieParser = require('cookie-parser'); // Import cookie-parser
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

// Connect to MongoDB database
connectDB();

const app = express();

// --- CORS Configuration ---
// Define allowed origins for CORS requests
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000', // Your React app's URL
  // Add other allowed origins here (e.g., production frontend URL)
  // 'https://your-production-domain.com'
];

// Configure CORS options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    // or requests from whitelisted origins
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked for origin: ${origin}`); // Log blocked origins
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Important: Allow cookies and authorization headers
  optionsSuccessStatus: 200 // For legacy browser compatibility (optional)
};

// --- Global Middleware ---
// **IMPORTANT**: Apply CORS middleware *before* other middleware/routes
app.use(cors(corsOptions));

// Enable pre-flight requests across the board (optional, often handled by cors middleware itself)
// app.options('*', cors(corsOptions)); // Uncomment if you face pre-flight issues

// Middleware to parse cookies (Needed for httpOnly cookies like refresh tokens)
app.use(cookieParser());

// Middleware to parse JSON request bodies
app.use(express.json());

// Middleware to parse URL-encoded request bodies (optional, if you use form submissions)
// app.use(express.urlencoded({ extended: true }));


// --- API Routes ---
// Mount your API routes
app.use('/api/tasks', taskRoutes);
app.use('/api', userRoutes); // Handles '/api/auth/...' and '/api/user/...'


// --- Static File Serving (Production) ---
// Serve static assets (React build) if in production environment
if (process.env.NODE_ENV === 'production') {
  // Set the static folder where the React build output resides
  app.use(express.static(path.join(__dirname, 'client/build')));

  // For any request that doesn't match an API route or a static file,
  // serve the main index.html file (for client-side routing)
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
} else {
  // Basic root route for development environment to confirm API is running
  app.get('/', (req, res) => {
    res.send('API is running in development mode...');
  });
}

// --- Custom Error Handling Middleware ---
// **IMPORTANT**: This must be the *last* middleware added
app.use(errorHandler);

// --- Start Server ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`Allowing CORS requests from: ${allowedOrigins.join(', ')}`);
});