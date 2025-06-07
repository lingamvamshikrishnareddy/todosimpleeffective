// backend/models/Task.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VALID_TASK_STATUSES = ['backlog', 'active', 'under-review', 'completed', 'archived'];
const VALID_TASK_PRIORITIES = ['low', 'medium', 'high'];

const TaskSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Task title is required.'],
    trim: true,
    maxlength: [255, 'Title cannot exceed 255 characters.']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters.']
  },
  status: {
    type: String,
    enum: {
        values: VALID_TASK_STATUSES,
        message: '"{VALUE}" is not a supported status.'
    },
    default: 'active' // FIX: Changed default to 'active' to ensure visibility in Kanban
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  // NEW: Field to track when a reminder notification has been shown to the user
  reminderSentAt: {
    type: Date,
    default: null
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

TaskSchema.index({ title: 'text', description: 'text', category: 'text' });
TaskSchema.index({ user: 1, status: 1 });
TaskSchema.index({ user: 1, dueDate: 1, status: 1, reminderSentAt: 1 }); // NEW: Improved index for reminders
TaskSchema.index({ user: 1, priority: 1 });

TaskSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.updatedAt = Date.now();
  }
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
      this.completedAt = Date.now();
  } else if (this.isModified('status') && this.status !== 'completed') {
      this.completedAt = null;
  }
  next();
});

TaskSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    if (update.$set) {
        update.$set.updatedAt = new Date();
        if (update.$set.status === 'completed') {
            if (this.completedAt === null || this.completedAt === undefined) {
                update.$set.completedAt = new Date();
            }
        } else if (update.$set.status && update.$set.status !== 'completed') {
            update.$set.completedAt = null;
        }
    }
    next();
});

module.exports = mongoose.model('Task', TaskSchema);
module.exports.VALID_TASK_STATUSES = VALID_TASK_STATUSES;
module.exports.VALID_TASK_PRIORITIES = VALID_TASK_PRIORITIES;
