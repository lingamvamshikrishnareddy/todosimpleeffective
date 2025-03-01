const express = require('express');
const router = express.Router();
const { 
  getTasks, 
  getTaskById, 
  createTask, 
  updateTask, 
  deleteTask, 
  toggleTaskStatus 
} = require('../controllers/taskController');
const auth = require('../middleware/authMiddleware');

// GET all tasks with optional filtering
router.get('/', (req, res, next) => {
  auth(req, res, () => {
    getTasks(req, res);
  });
});

// POST create a new task
router.post('/', (req, res, next) => {
  auth(req, res, () => {
    createTask(req, res);
  });
});

// GET a single task by ID
router.get('/:id', (req, res, next) => {
  auth(req, res, () => {
    getTaskById(req, res);
  });
});

// PUT update a task
router.put('/:id', (req, res, next) => {
  auth(req, res, () => {
    updateTask(req, res);
  });
});

// DELETE remove a task
router.delete('/:id', (req, res, next) => {
  auth(req, res, () => {
    deleteTask(req, res);
  });
});

// PATCH toggle task completion status
router.patch('/:id/toggle', (req, res, next) => {
  auth(req, res, () => {
    toggleTaskStatus(req, res);
  });
});

module.exports = router;