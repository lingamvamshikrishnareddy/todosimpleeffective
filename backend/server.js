// In server.js
const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const { errorHandler } = require('./middleware/errorMiddleware');
const cors = require('cors');

dotenv.config();
connectDB();

const app = express();

// Use CORS middleware
app.use(cors());
app.use(express.json());

// Updated route configurations
app.use('/api/tasks', taskRoutes);
app.use('/api', userRoutes);  // Changed from '/api/auth' to '/api'

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
