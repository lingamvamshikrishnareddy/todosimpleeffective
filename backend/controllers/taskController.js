const Task = require('../models/Task');

/**
 * Get all tasks with optional filtering
 * @route GET /api/tasks
 * @access Private
 */
const getTasks = async (req, res) => {
  try {
    // Support filtering by status or category
    const filter = {};
    
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    // Support searching by title or description
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Add user filtering for multi-user support
    if (req.user) {
      filter.user = req.user.id;
    }
    
    // Support pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Support sorting
    const sort = {};
    if (req.query.sortBy) {
      const parts = req.query.sortBy.split(':');
      sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
    } else {
      // Default sort by creation date (newest first)
      sort.createdAt = -1;
    }
    
    const tasks = await Task.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
      
    // Get total count for pagination
    const totalTasks = await Task.countDocuments(filter);
    
    res.json({
      tasks,
      pagination: {
        total: totalTasks,
        page,
        pages: Math.ceil(totalTasks / limit),
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Create a new task
 * @route POST /api/tasks
 * @access Private
 */
const createTask = async (req, res) => {
  try {
    const { title, description, category, dueDate, priority } = req.body;
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    
    // Create new task object
    const task = new Task({
      title,
      description,
      status: 'active',
      user: req.user ? req.user.id : null,
      category,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority || 'medium'
    });
    
    const createdTask = await task.save();
    res.status(201).json(createdTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Failed to create task', error: error.message });
  }
};

/**
 * Get a single task by ID
 * @route GET /api/tasks/:id
 * @access Private
 */
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Check if task belongs to current user
    if (req.user && task.user && task.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to access this task' });
    }
    
    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update a task
 * @route PUT /api/tasks/:id
 * @access Private
 */
const updateTask = async (req, res) => {
  try {
    const { title, description, status, category, dueDate, priority } = req.body;
    
    // Find task by ID
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Check if task belongs to current user
    if (req.user && task.user && task.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this task' });
    }
    
    // Update task fields
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (category !== undefined) task.category = category;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (priority !== undefined) task.priority = priority;
    
    // Update timestamps
    task.updatedAt = Date.now();
    
    const updatedTask = await task.save();
    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    res.status(500).json({ message: 'Failed to update task', error: error.message });
  }
};

/**
 * Delete a task
 * @route DELETE /api/tasks/:id
 * @access Private
 */
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Check if task belongs to current user
    if (req.user && task.user && task.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this task' });
    }
    
    await Task.deleteOne({ _id: req.params.id });
    res.json({ message: 'Task removed successfully', id: req.params.id });
  } catch (error) {
    console.error('Error deleting task:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    res.status(500).json({ message: 'Failed to delete task', error: error.message });
  }
};

/**
 * Toggle task completion status
 * @route PATCH /api/tasks/:id/toggle
 * @access Private
 */
const toggleTaskStatus = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Check if task belongs to current user
    if (req.user && task.user && task.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this task' });
    }
    
    // Toggle between 'active' and 'completed'
    task.status = task.status === 'completed' ? 'active' : 'completed';
    task.completedAt = task.status === 'completed' ? Date.now() : null;
    task.updatedAt = Date.now();
    
    const updatedTask = await task.save();
    res.json(updatedTask);
  } catch (error) {
    console.error('Error toggling task status:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    res.status(500).json({ message: 'Failed to update task status', error: error.message });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskStatus
};