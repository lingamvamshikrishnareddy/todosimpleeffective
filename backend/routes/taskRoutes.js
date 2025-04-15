// routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskStatus,
  bulkUpdateTasks, // Import bulk methods
  bulkDeleteTasks, // Import bulk methods
  getTaskStats     // Import stats method
} = require('../controllers/taskController');
const auth = require('../middleware/authMiddleware'); // Your authentication middleware

// Apply auth middleware to all task routes
router.use(auth);

// GET all tasks for the logged-in user (with filtering, sorting, pagination)
router.get('/', getTasks);

// POST create a new task for the logged-in user
router.post('/', createTask);

// GET task statistics for the logged-in user
router.get('/stats', getTaskStats); // Add route for stats

// PATCH bulk update tasks for the logged-in user
router.patch('/bulk', bulkUpdateTasks); // Add route for bulk update

// DELETE bulk delete tasks for the logged-in user
router.delete('/bulk', bulkDeleteTasks); // Add route for bulk delete

// --- Routes for specific task ID ---

// GET a single task by ID (user-specific check done in controller)
router.get('/:id', getTaskById);

// PUT update a task by ID (user-specific check done in controller)
router.put('/:id', updateTask);

// DELETE remove a task by ID (user-specific check done in controller)
router.delete('/:id', deleteTask);

// PATCH toggle task completion status by ID (user-specific check done in controller)
router.patch('/:id/toggle', toggleTaskStatus);

module.exports = router;