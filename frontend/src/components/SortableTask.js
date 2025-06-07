import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Added `isOverlay` prop for potential styling differences
const SortableTask = ({ id, task, onEdit, onDelete, isOverlay = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
      id, // Use the passed task ID
      data: { // Add data for context in handlers
          type: 'task',
          task // Pass the full task data if needed in handlers
      }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab', // Indicate grabbability
    // Add style for overlay if needed
    boxShadow: isOverlay ? '0 5px 15px rgba(0,0,0,0.2)' : undefined,
    // Ensure overlay tasks are above others
    zIndex: isDragging || isOverlay ? 100 : 'auto',
  };

  // Determine priority class
  const getPriorityClass = () => {
    if (!task.priority) return '';
    return `priority-${task.priority.toLowerCase()}`;
  };

  // Use task._id or task.id consistently
  const taskId = task._id || task.id;
  const taskTitle = task.title || task.text || "Untitled Task";

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Spread attributes and listeners onto the main draggable element
      {...attributes}
      {...listeners}
      className={`task-card sortable-task ${isDragging ? 'dragging' : ''} ${getPriorityClass()} ${isOverlay ? 'overlay' : ''}`}
      data-task-id={taskId}
    >
      <div className="task-card-header">
        <h4 className="task-card-title">{taskTitle}</h4>
        {/* Action buttons should NOT have drag listeners */}
        <div className="task-actions">
          <button
            className="task-action-button edit"
            // Stop propagation to prevent drag listeners from firing
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task); // Pass the full task object
            }}
            // Prevent drag initiation from button itself if possible
            // onMouseDown={(e) => e.stopPropagation()} // Can sometimes help
            aria-label={`Edit task ${taskTitle}`}
          >
            <i className="fa fa-edit"></i>
          </button>
          <button
            className="task-action-button delete"
            // Stop propagation to prevent drag listeners from firing
            onClick={(e) => {
              e.stopPropagation();
              onDelete(taskId); // Pass the ID for deletion
            }}
            // onMouseDown={(e) => e.stopPropagation()} // Can sometimes help
            aria-label={`Delete task ${taskTitle}`}
          >
            <i className="fa fa-trash"></i>
          </button>
        </div>
      </div>

      {task.description && (
        <p className="task-card-description">{task.description}</p>
      )}

      <div className="task-card-footer">
        {task.category && (
          <span className="task-category">
            <i className="fa fa-tag"></i> {task.category}
          </span>
        )}

        {task.dueDate && (
          <span className="task-due-date">
            <i className="fa fa-calendar"></i> {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
};

export default SortableTask;