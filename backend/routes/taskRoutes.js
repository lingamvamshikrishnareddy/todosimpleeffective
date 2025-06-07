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
  bulkUpdateTasks,
  bulkDeleteTasks,
  getTaskStats,
  searchTasks // Assuming you have this exported from controller
} = require('../controllers/taskController');
const auth = require('../middleware/authMiddleware');

router.use(auth); // Apply auth middleware to all task routes

router.get('/', getTasks);
router.post('/', createTask);

router.get('/stats', getTaskStats);
router.get('/search', searchTasks); // Add route for dedicated search if used by TaskAPI

// Corrected bulk operation routes
router.put('/bulk-update', bulkUpdateTasks); // Changed from PATCH /bulk
router.delete('/bulk-delete', bulkDeleteTasks); // Changed from DELETE /bulk

router.get('/:id', getTaskById);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.patch('/:id/toggle', toggleTaskStatus);

module.exports = router;