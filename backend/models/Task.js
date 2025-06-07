// backend/models/Task.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VALID_TASK_STATUSES = ['backlog', 'active', 'under-review', 'completed', 'archived']; // Define once
const VALID_TASK_PRIORITIES = ['low', 'medium', 'high'];

const TaskSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Task title is required.'], // Added custom message
    trim: true,
    maxlength: [255, 'Title cannot exceed 255 characters.'] // Added maxlength validation
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters.'] // Added maxlength validation
  },
  status: {
    type: String,
    enum: {
        values: VALID_TASK_STATUSES,
        message: '"{VALUE}" is not a supported status.' // Custom message for enum validation
    },
    default: 'backlog' // Default to 'backlog'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // Usually tasks are tied to a user
  },
  category: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: {
        values: VALID_TASK_PRIORITIES,
        message: '"{VALUE}" is not a supported priority.'
    },
    default: 'medium'
  },
  dueDate: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create text indexes for search functionality
// Consider indexing other commonly queried fields like user, status, priority, dueDate
TaskSchema.index({ title: 'text', description: 'text', category: 'text' });
TaskSchema.index({ user: 1, status: 1 });
TaskSchema.index({ user: 1, dueDate: 1 });
TaskSchema.index({ user: 1, priority: 1 });


// Middleware to update `updatedAt` timestamp on save
TaskSchema.pre('save', function(next) {
  if (this.isModified()) { // only update if something changed
    this.updatedAt = Date.now();
  }
  // If status changes to 'completed' and completedAt is not set, set it.
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
      this.completedAt = Date.now();
  } else if (this.isModified('status') && this.status !== 'completed') {
      this.completedAt = null; // Clear if moved out of completed
  }
  next();
});

// Middleware for findOneAndUpdate to update `updatedAt`
// Note: runValidators is important for $set operations to trigger schema validation
TaskSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    if (update.$set) {
        update.$set.updatedAt = new Date();

        // Handle completedAt based on status in $set
        if (update.$set.status === 'completed') {
            // Check current state if possible, or just set if status is changing to completed
            // This is simpler: if status is set to completed, ensure completedAt is set.
            if (this.completedAt === null || this.completedAt === undefined) { // Avoid overwriting if already set
                update.$set.completedAt = new Date();
            }
        } else if (update.$set.status && update.$set.status !== 'completed') {
            update.$set.completedAt = null;
        }
    } else if (update.$setOnInsert) { // For upserts
        update.$setOnInsert.updatedAt = new Date();
    }
    // Need to be careful here, this._update is deprecated. Use this.getUpdate().
    next();
});


module.exports = mongoose.model('Task', TaskSchema);
// Export constants for use in controller
module.exports.VALID_TASK_STATUSES = VALID_TASK_STATUSES;
module.exports.VALID_TASK_PRIORITIES = VALID_TASK_PRIORITIES;