import React, { useState } from 'react';

const Task = ({ task, onDelete, onEdit, onToggleComplete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className={`task-item ${task.completed ? 'completed' : ''}`}>
      <div className="task-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="task-checkbox-title">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => onToggleComplete(task.id)}
            onClick={(e) => e.stopPropagation()}
            className="task-checkbox"
          />
          <h3 className={task.completed ? 'completed-text' : ''}>{task.text}</h3>
        </div>
        <div className="task-actions">
          <button 
            className="icon-button edit-button" 
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            aria-label="Edit task"
          >
            ✏️
          </button>
          <button 
            className="icon-button delete-button" 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            aria-label="Delete task"
          >
            🗑️
          </button>
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>
      
      {isExpanded && task.description && (
        <div className="task-details">
          <p className="task-description">{task.description}</p>
          <div className="task-metadata">
            {task.createdAt && (
              <span className="task-date">Created: {formatDate(task.createdAt)}</span>
            )}
            {task.updatedAt && task.updatedAt !== task.createdAt && (
              <span className="task-date">Updated: {formatDate(task.updatedAt)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Task;