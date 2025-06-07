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
  getReminders,       // NEW
  markReminderSeen,   // NEW
} = require('../controllers/taskController');
const auth = require('../middleware/authMiddleware');

router.use(auth);

router.get('/', getTasks);
router.post('/', createTask);

router.get('/stats', getTaskStats);
// NEW: Route for fetching reminders
router.get('/reminders', getReminders);

router.put('/bulk-update', bulkUpdateTasks);
router.delete('/bulk-delete', bulkDeleteTasks);

router.get('/:id', getTaskById);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.patch('/:id/toggle', toggleTaskStatus);
// NEW: Route for marking a reminder as seen
router.patch('/:id/seen', markReminderSeen);

module.exports = router;
