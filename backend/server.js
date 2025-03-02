const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const { errorHandler } = require('./middleware/errorMiddleware');
const cors = require('cors');
const path = require('path');

dotenv.config();
connectDB();

const app = express();

// Use CORS middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/tasks', taskRoutes);
app.use('/api', userRoutes);

// Define the correct client build path for Render deployment
const clientBuildPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, '../client/build')  // Adjust this path based on your project structure
  : path.join(__dirname, 'client/build');

// Check if the client build path exists
const fs = require('fs');
if (fs.existsSync(clientBuildPath)) {
  // Serve static files from the client build folder
  app.use(express.static(clientBuildPath));

  // For any other routes, serve the index.html file
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  // If client build doesn't exist, serve a simple API message
  app.get('/', (req, res) => {
    res.json({ 
      message: 'API is running', 
      endpoints: {
        tasks: '/api/tasks',
        users: '/api'
      }
    });
  });
}

// Error handler should be after all routes
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`Client build path: ${clientBuildPath}`);
  console.log(`Client build exists: ${fs.existsSync(clientBuildPath)}`);
});
