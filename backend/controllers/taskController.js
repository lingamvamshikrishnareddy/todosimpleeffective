// backend/controllers/taskController.js
const TaskModel = require('../models/Task'); // Import the model itself
const { VALID_TASK_STATUSES, VALID_TASK_PRIORITIES } = TaskModel; // Destructure constants

// Helper for consistent error responses
const sendError = (res, statusCode, message, errorDetails = null) => {
  const response = { success: false, message };
  if (errorDetails && errorDetails.errors) {
    const messages = Object.values(errorDetails.errors).map(err => err.message).join('; ');
    response.detailedMessage = messages;
  } else if (process.env.NODE_ENV === 'development' && errorDetails) {
    response.error = errorDetails.message || errorDetails;
  }
  res.status(statusCode).json(response);
};

/**
 * Get all tasks with filtering, sorting, and pagination
 * @route GET /api/tasks
 * @access Private (requires authentication)
 */
const getTasks = async (req, res) => {
  try {
    const filter = { user: req.user.id };

    if (req.query.status && req.query.status !== 'all') {
      if (req.query.status === 'active') {
        filter.status = { $nin: ['completed', 'archived'] }; // Shows 'backlog', 'active', 'under-review'
      } else if (VALID_TASK_STATUSES.includes(req.query.status)) {
        filter.status = req.query.status;
      }
    }

    if (req.query.category) {
      filter.category = new RegExp(req.query.category, 'i');
    }

    if (req.query.priority && VALID_TASK_PRIORITIES.includes(req.query.priority)) {
      filter.priority = req.query.priority;
    }

    if (req.query.dueDate) {
      const dueDate = new Date(req.query.dueDate);
      if (!isNaN(dueDate.getTime())) {
        filter.dueDate = {
          $gte: new Date(dueDate.setHours(0, 0, 0, 0)),
          $lt: new Date(new Date(dueDate).setHours(23, 59, 59, 999)),
        };
      }
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
      ];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const sort = {};
    if (req.query.sortBy) {
      const parts = req.query.sortBy.split(':');
      const allowedSortFields = ['title', 'createdAt', 'updatedAt', 'dueDate', 'priority', 'status'];
      if (allowedSortFields.includes(parts[0])) {
        sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
        if (parts[0] !== 'createdAt' && parts[0] !== '_id') {
          sort.createdAt = -1;
        }
      }
    } else {
      sort.createdAt = -1; // Default sort: newest first
    }

    const [tasks, totalTasks] = await Promise.all([
      TaskModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      TaskModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalTasks / limit);

    res.json({
      success: true,
      tasks,
      pagination: {
        total: totalTasks,
        page,
        pages: totalPages,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    sendError(res, 500, 'Server error while fetching tasks', error);
  }
};

/**
 * Create a new task
 * @route POST /api/tasks
 * @access Private
 */
const createTask = async (req, res) => {
  try {
    const { title, description, category, dueDate, priority, status } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return sendError(res, 400, 'Title is required.');
    }

    if (status && !VALID_TASK_STATUSES.includes(status)) {
      return sendError(res, 400, `Invalid status. Must be one of: ${VALID_TASK_STATUSES.join(', ')}`);
    }
 
    if (priority && !VALID_TASK_PRIORITIES.includes(priority)) {
      return sendError(res, 400, `Invalid priority. Must be one of: ${VALID_TASK_PRIORITIES.join(', ')}`);
    }

    const taskData = {
      title: title.trim(),
      user: req.user.id,
      description: description ? description.trim() : undefined,
      category: category ? category.trim() : undefined,
      // CRITICAL: Defaults to 'active' if status is not provided or is falsy.
      // This addresses the Kanban issue where new tasks might default to 'backlog'
      // if the schema default was 'backlog' and frontend sent no status.
      status: status || 'active', 
      ...(priority && VALID_TASK_PRIORITIES.includes(priority) && { priority }), // Uses schema default if not provided
    };

    if (dueDate) {
      const parsedDueDate = new Date(dueDate);
      if (!isNaN(parsedDueDate.getTime())) {
        taskData.dueDate = parsedDueDate;
      } else {
        return sendError(res, 400, 'Invalid due date format.');
      }
    }

    const task = new TaskModel(taskData);
    const createdTask = await task.save();

    res.status(201).json({ success: true, task: createdTask });
  } catch (error) {
    console.error('Error creating task:', error);
    if (error.name === 'ValidationError') {
      return sendError(res, 400, 'Validation failed.', error);
    }
    sendError(res, 500, 'Failed to create task', error);
  }
};

/**
 * Get a single task by ID
 * @route GET /api/tasks/:id
 * @access Private
 */
const getTaskById = async (req, res) => {
  try {
    const task = await TaskModel.findOne({ _id: req.params.id, user: req.user.id }).lean();

    if (!task) {
      return sendError(res, 404, 'Task not found or not authorized.');
    }

    res.json({ success: true, task });
  } catch (error) {
    console.error('Error fetching task by ID:', error);
    if (error.kind === 'ObjectId') {
      return sendError(res, 404, 'Task not found (invalid ID format).');
    }
    sendError(res, 500, 'Server error while fetching task', error);
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
    const taskId = req.params.id;

    const updates = {};
    
    if (title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return sendError(res, 400, 'Title cannot be empty.');
      }
      updates.title = title.trim();
    }
    
    if (description !== undefined) updates.description = description ? description.trim() : '';
    if (category !== undefined) updates.category = category ? category.trim() : '';
    
    if (priority !== undefined) {
      if (priority === '' || priority === null) { // Allow clearing priority to default
        updates.priority = TaskModel.schema.path('priority').defaultValue;
      } else if (!VALID_TASK_PRIORITIES.includes(priority)) {
        return sendError(res, 400, `Invalid priority. Must be one of: ${VALID_TASK_PRIORITIES.join(', ')}`);
      } else {
        updates.priority = priority;
      }
    }

    if (status !== undefined) {
      if (!VALID_TASK_STATUSES.includes(status)) {
        return sendError(res, 400, `Invalid status. Must be one of: ${VALID_TASK_STATUSES.join(', ')}`);
      }
      updates.status = status;
      
      if (status === 'completed') {
        updates.completedAt = new Date();
      } else {
        // Ensure completedAt is unset if task is moved out of 'completed'
        updates.completedAt = null; 
        updates.$unset = updates.$unset || {}; // Ensure $unset exists
        updates.$unset.completedAt = 1; // Mongoose way to remove a field
      }
    }
    
    if (dueDate !== undefined) {
      if (dueDate === null || dueDate === '') {
        updates.dueDate = null;
        updates.$unset = updates.$unset || {};
        updates.$unset.dueDate = 1;
        // Reset reminder when due date is cleared
        updates.$unset.reminderSentAt = 1;
      } else {
        const parsedDueDate = new Date(dueDate);
        if (!isNaN(parsedDueDate.getTime())) {
          updates.dueDate = parsedDueDate;
          // Reset reminder when due date is changed
          updates.$unset = updates.$unset || {};
          updates.$unset.reminderSentAt = 1;
        } else {
          return sendError(res, 400, 'Invalid due date format.');
        }
      }
    }

    if (Object.keys(updates).length === 0 && !(updates.$unset && Object.keys(updates.$unset).length > 0)) {
      // If no actual updates, fetch and return current task to avoid unnecessary write
      const task = await TaskModel.findOne({ _id: taskId, user: req.user.id }).lean();
      if (!task) return sendError(res, 404, 'Task not found or not authorized.');
      return res.json({ success: true, task });
    }

    updates.updatedAt = new Date(); // Explicitly set updatedAt

    // Handle $unset separately if needed, or combine with $set
    const updateOperation = { $set: {} };
    for (const key in updates) {
        if (key === '$unset') {
            updateOperation.$unset = updates.$unset;
        } else {
            updateOperation.$set[key] = updates[key];
        }
    }
    // If $unset was the only operation, ensure $set is not empty or handle it.
    // For simplicity, Mongoose handles $set with $unset together well.

    const updatedTask = await TaskModel.findOneAndUpdate(
      { _id: taskId, user: req.user.id },
      updateOperation,
      { new: true, runValidators: true, lean: true }
    );
    
    if (!updatedTask) {
      return sendError(res, 404, 'Task not found, not authorized, or update failed.');
    }

    res.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    if (error.kind === 'ObjectId') {
      return sendError(res, 404, 'Task not found (invalid ID format).');
    }
    if (error.name === 'ValidationError') {
      return sendError(res, 400, 'Validation failed.', error);
    }
    sendError(res, 500, 'Failed to update task', error);
  }
};

/**
 * Delete a task
 * @route DELETE /api/tasks/:id
 * @access Private
 */
const deleteTask = async (req, res) => {
  try {
    const task = await TaskModel.findOneAndDelete({ _id: req.params.id, user: req.user.id });

    if (!task) {
      return sendError(res, 404, 'Task not found or not authorized.');
    }

    res.json({ success: true, message: 'Task removed successfully', id: req.params.id });
  } catch (error) {
    console.error('Error deleting task:', error);
    if (error.kind === 'ObjectId') {
      return sendError(res, 404, 'Task not found (invalid ID format).');
    }
    sendError(res, 500, 'Failed to delete task', error);
  }
};

/**
 * Toggle task completion status
 * @route PATCH /api/tasks/:id/toggle
 * @access Private
 */
const toggleTaskStatus = async (req, res) => {
  try {
    const task = await TaskModel.findOne({ _id: req.params.id, user: req.user.id });

    if (!task) {
      return sendError(res, 404, 'Task not found or not authorized.');
    }

    if (task.status === 'completed') {
      task.status = 'active'; // Or a more sophisticated logic to return to previous non-completed state
      task.completedAt = null;
    } else {
      task.status = 'completed';
      task.completedAt = new Date();
    }

    task.updatedAt = new Date();
    const updatedTask = await task.save();
    
    res.json({ success: true, task: updatedTask.toObject() }); // .toObject() for lean-like result
  } catch (error) {
    console.error('Error toggling task status:', error);
    if (error.kind === 'ObjectId') {
      return sendError(res, 404, 'Task not found (invalid ID format).');
    }
    if (error.name === 'ValidationError') {
      return sendError(res, 400, 'Validation failed while toggling status.', error);
    }
    sendError(res, 500, 'Failed to toggle task status', error);
  }
};

/**
 * Search tasks (uses getTasks internally)
 * @route GET /api/tasks/search
 * @access Private
 */
const searchTasks = async (req, res) => {
  if (!req.query.search) {
    return sendError(res, 400, 'Search term is required for /tasks/search.');
  }
  // Allow overriding limit for search results, default to a reasonable number
  req.query.limit = req.query.limit || 20; 
  return getTasks(req, res); // Leverage the main getTasks function
};

/**
 * Get task statistics
 * @route GET /api/tasks/stats
 * @access Private
 */
const getTaskStats = async (req, res) => {
  try {
    const userFilter = { user: req.user.id };

    const totalPromise = TaskModel.countDocuments(userFilter);
    
    const statusCountsPromise = TaskModel.aggregate([
      { $match: userFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const priorityCountsPromise = TaskModel.aggregate([
      { $match: userFilter },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    const upcomingDuePromise = TaskModel.find({
      ...userFilter,
      status: { $nin: ['completed', 'archived'] },
      dueDate: { $exists: true, $ne: null, $gte: new Date() }
    }).sort({ dueDate: 1 }).limit(5).lean();

    const [total, statusCountsResult, priorityCountsResult, upcomingDue] = await Promise.all([
      totalPromise, statusCountsPromise, priorityCountsPromise, upcomingDuePromise
    ]);

    const stats = {
      total,
      byStatus: VALID_TASK_STATUSES.reduce((acc, st) => ({ ...acc, [st]: 0 }), {}),
      byPriority: VALID_TASK_PRIORITIES.reduce((acc, p) => ({ ...acc, [p]: 0 }), {}),
      upcomingDue,
    };

    statusCountsResult.forEach(item => { 
      if (stats.byStatus.hasOwnProperty(item._id)) {
        stats.byStatus[item._id] = item.count; 
      }
    });
    
    priorityCountsResult.forEach(item => { 
      if (stats.byPriority.hasOwnProperty(item._id)) {
        stats.byPriority[item._id] = item.count; 
      }
    });
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting task stats:', error);
    sendError(res, 500, 'Failed to get task statistics', error);
  }
};

/**
 * Bulk update multiple tasks
 * @route PUT /api/tasks/bulk-update
 * @access Private
 */
const bulkUpdateTasks = async (req, res) => {
  try {
    const { taskIds, updateData } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return sendError(res, 400, 'Task IDs array is required and must not be empty.');
    }
    if (!updateData || typeof updateData !== 'object' || Object.keys(updateData).length === 0) {
      return sendError(res, 400, 'Update data object is required and must not be empty.');
    }

    const updatesToApply = { ...updateData };
    
    if (updatesToApply.status && !VALID_TASK_STATUSES.includes(updatesToApply.status)) {
      return sendError(res, 400, `Invalid status. Must be one of: ${VALID_TASK_STATUSES.join(', ')}`);
    }
    if (updatesToApply.priority && !VALID_TASK_PRIORITIES.includes(updatesToApply.priority)) {
      return sendError(res, 400, `Invalid priority. Must be one of: ${VALID_TASK_PRIORITIES.join(', ')}`);
    }

    updatesToApply.updatedAt = new Date();
    if (updatesToApply.status === 'completed') {
      updatesToApply.completedAt = new Date();
    } else if (updatesToApply.status && updatesToApply.status !== 'completed') {
      // If changing status to non-completed, ensure completedAt is removed
      updatesToApply.$unset = { completedAt: 1 };
    }

    const operation = { $set: updatesToApply };
    if (updatesToApply.$unset) {
        operation.$unset = updatesToApply.$unset;
        delete updatesToApply.$unset; // remove from $set
    }

    const result = await TaskModel.updateMany(
      { _id: { $in: taskIds }, user: req.user.id },
      operation,
      { runValidators: true } // Mongoose updateMany doesn't run validators by default on sub-documents or paths, but direct paths in $set are validated.
    );

    if (result.matchedCount === 0) {
      return sendError(res, 404, 'No matching tasks found for bulk update or not authorized.');
    }

    res.json({
      success: true,
      message: `${result.modifiedCount} tasks updated successfully. ${result.matchedCount} tasks matched.`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error bulk updating tasks:', error);
     if (error.name === 'ValidationError') { // Catch validation errors if runValidators works as expected
      return sendError(res, 400, 'Validation failed during bulk update.', error);
    }
    sendError(res, 500, 'Failed to bulk update tasks', error);
  }
};

/**
 * Bulk delete multiple tasks
 * @route DELETE /api/tasks/bulk-delete
 * @access Private
 */
const bulkDeleteTasks = async (req, res) => {
  try {
    const { taskIds } = req.body; 

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return sendError(res, 400, 'Task IDs array is required and must not be empty.');
    }

    const result = await TaskModel.deleteMany({
      _id: { $in: taskIds },
      user: req.user.id,
    });

    if (result.deletedCount === 0) {
      return sendError(res, 404, 'No matching tasks found for bulk delete or not authorized.');
    }

    res.json({
      success: true,
      message: `${result.deletedCount} tasks deleted successfully.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Error bulk deleting tasks:', error);
    sendError(res, 500, 'Failed to bulk delete tasks', error);
  }
};

/**
 * Get tasks that are due soon and need reminders
 * @route GET /api/tasks/reminders
 * @access Private
 * @query {number} hours - Hours ahead to check for due tasks (default: 24)
 * @query {boolean} includeOverdue - Include overdue tasks (default: true)
 */
const getReminders = async (req, res) => {
  try {
    const hoursAhead = parseInt(req.query.hours) || 24; // Default to 24 hours
    const includeOverdue = req.query.includeOverdue !== 'false'; // Default to true
    const now = new Date();
    const futureTime = new Date(now.getTime() + (hoursAhead * 60 * 60 * 1000));

    // Build the query for due date
    let dueDateQuery;
    if (includeOverdue) {
      // Include both overdue tasks and tasks due within the specified time
      dueDateQuery = { $lte: futureTime };
    } else {
      // Only include tasks due within the specified time (not overdue)
      dueDateQuery = { $gte: now, $lte: futureTime };
    }

    const reminders = await TaskModel.find({
      user: req.user.id,
      status: { $nin: ['completed', 'archived'] }, // Only active tasks
      dueDate: { 
        $exists: true, 
        $ne: null,
        ...dueDateQuery
      },
      $or: [
        { reminderSentAt: { $exists: false } }, // Field doesn't exist
        { reminderSentAt: null }, // Field is null
        // Include tasks where reminder was sent more than 1 hour ago (for recurring reminders)
        { reminderSentAt: { $lt: new Date(now.getTime() - (60 * 60 * 1000)) } }
      ]
    })
    .sort({ dueDate: 1 }) // Sort by due date (earliest first)
    .lean();

    // Add additional metadata for each reminder
    const enrichedReminders = reminders.map(task => {
      const timeUntilDue = task.dueDate.getTime() - now.getTime();
      const hoursUntilDue = Math.floor(timeUntilDue / (1000 * 60 * 60));
      const isOverdue = timeUntilDue < 0;
      
      return {
        ...task,
        isOverdue,
        hoursUntilDue: Math.abs(hoursUntilDue),
        urgencyLevel: isOverdue ? 'overdue' : 
                     hoursUntilDue <= 2 ? 'urgent' : 
                     hoursUntilDue <= 6 ? 'high' : 'normal'
      };
    });

    res.json({ 
      success: true, 
      reminders: enrichedReminders,
      count: enrichedReminders.length,
      overdueCount: enrichedReminders.filter(r => r.isOverdue).length
    });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    sendError(res, 500, 'Failed to fetch reminders', error);
  }
};

/**
 * Mark a task reminder as seen/acknowledged
 * @route PATCH /api/tasks/:id/seen
 * @access Private
 */
const markReminderSeen = async (req, res) => {
  try {
    const taskId = req.params.id;
    const now = new Date();

    const updatedTask = await TaskModel.findOneAndUpdate(
      { _id: taskId, user: req.user.id },
      { 
        $set: { 
          reminderSentAt: now,
          updatedAt: now
        } 
      },
      { new: true, runValidators: true, lean: true }
    );

    if (!updatedTask) {
      return sendError(res, 404, 'Task not found or not authorized.');
    }
    
    res.json({ 
      success: true, 
      task: updatedTask,
      message: 'Reminder marked as seen'
    });
  } catch (error) {
    console.error('Error marking reminder as seen:', error);
    if (error.kind === 'ObjectId') {
      return sendError(res, 404, 'Task not found (invalid ID format).');
    }
    sendError(res, 500, 'Failed to mark reminder as seen', error);
  }
};

/**
 * Bulk mark multiple task reminders as seen
 * @route PATCH /api/tasks/reminders/bulk-seen
 * @access Private
 */
const bulkMarkRemindersSeen = async (req, res) => {
  try {
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return sendError(res, 400, 'Task IDs array is required and must not be empty.');
    }

    const now = new Date();
    const result = await TaskModel.updateMany(
      { 
        _id: { $in: taskIds }, 
        user: req.user.id 
      },
      { 
        $set: { 
          reminderSentAt: now,
          updatedAt: now
        } 
      },
      { runValidators: true }
    );

    if (result.matchedCount === 0) {
      return sendError(res, 404, 'No matching tasks found or not authorized.');
    }

    res.json({
      success: true,
      message: `${result.modifiedCount} reminders marked as seen.`,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error bulk marking reminders as seen:', error);
    sendError(res, 500, 'Failed to bulk mark reminders as seen', error);
  }
};

/**
 * Get overdue tasks specifically
 * @route GET /api/tasks/overdue
 * @access Private
 */
const getOverdueTasks = async (req, res) => {
  try {
    const now = new Date();
    
    const overdueTasks = await TaskModel.find({
      user: req.user.id,
      status: { $nin: ['completed', 'archived'] },
      dueDate: { 
        $exists: true, 
        $ne: null,
        $lt: now // Due date is in the past
      }
    })
    .sort({ dueDate: 1 }) // Sort by due date (oldest overdue first)
    .lean();

    // Add metadata about how overdue each task is
    const enrichedOverdueTasks = overdueTasks.map(task => {
      const overdueTime = now.getTime() - task.dueDate.getTime();
      const daysPastDue = Math.floor(overdueTime / (1000 * 60 * 60 * 24));
      const hoursPastDue = Math.floor(overdueTime / (1000 * 60 * 60));
      
      return {
        ...task,
        daysPastDue,
        hoursPastDue,
        overdueSeverity: hoursPastDue <= 24 ? 'recent' : 
                        daysPastDue <= 7 ? 'moderate' : 'severe'
      };
    });

    res.json({
      success: true,
      overdueTasks: enrichedOverdueTasks,
      count: enrichedOverdueTasks.length
    });
  } catch (error) {
    console.error('Error fetching overdue tasks:', error);
    sendError(res, 500, 'Failed to fetch overdue tasks', error);
  }
};

/**
 * Snooze a task reminder (postpone reminder for specified time)
 * @route PATCH /api/tasks/:id/snooze
 * @access Private
 */
const snoozeReminder = async (req, res) => {
  try {
    const taskId = req.params.id;
    const { hours = 1 } = req.body; // Default snooze for 1 hour

    if (hours <= 0 || hours > 168) { // Max 1 week (168 hours)
      return sendError(res, 400, 'Snooze duration must be between 1 and 168 hours.');
    }

    const now = new Date();
    const snoozeUntil = new Date(now.getTime() + (hours * 60 * 60 * 1000));

    const updatedTask = await TaskModel.findOneAndUpdate(
      { _id: taskId, user: req.user.id },
      { 
        $set: { 
          reminderSentAt: snoozeUntil, // Set reminder to future time
          updatedAt: now
        } 
      },
      { new: true, runValidators: true, lean: true }
    );

    if (!updatedTask) {
      return sendError(res, 404, 'Task not found or not authorized.');
    }
    
    res.json({ 
      success: true, 
      task: updatedTask,
      message: `Reminder snoozed for ${hours} hour(s)`,
      snoozeUntil
    });
  } catch (error) {
    console.error('Error snoozing reminder:', error);
    if (error.kind === 'ObjectId') {
      return sendError(res, 404, 'Task not found (invalid ID format).');
    }
    sendError(res, 500, 'Failed to snooze reminder', error);
  }
};

module.exports = {
  getTasks,
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  toggleTaskStatus,
  searchTasks,
  getTaskStats,
  bulkUpdateTasks,
  bulkDeleteTasks,
  getReminders,
  markReminderSeen,
};
