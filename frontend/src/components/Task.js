import React from 'react';

const Task = ({ task, onDelete, onEdit, onToggleComplete }) => {
  // Ensure we're using the correct ID property consistently
  const taskId = task._id || task.id;
  
  // Ensure we're properly handling the task title 
  const taskTitle = task.title || task.text || "Untitled Task";
  
  return (
    <div className={`task-item ${task.status === 'completed' ? 'completed' : ''}`}>
      <div className="task-checkbox-title">
        <input
          type="checkbox"
          className="task-checkbox"
          checked={task.status === 'completed'}
          onChange={() => onToggleComplete(taskId)}
          id={`task-${taskId}`}
        />
        <div className="task-content">
          <div className="task-header">
            <label 
              htmlFor={`task-${taskId}`} 
              className={`task-title ${task.status === 'completed' ? 'completed-text' : ''}`}
            >
              {taskTitle}
            </label>
            
            <div className="task-actions">
              <button 
                className="icon-button edit-button" 
                onClick={() => onEdit(task)}
                aria-label="Edit task"
              >
                <i className="fa fa-pencil"></i>
              </button>
              
              <button 
                className="icon-button delete-button" 
                onClick={() => onDelete(taskId)}
                aria-label="Delete task"
              >
                <i className="fa fa-trash"></i>
              </button>
            </div>
          </div>
          
          {task.priority && (
            <span className={`priority-badge priority-${task.priority.toLowerCase()}`}>
              {task.priority}
            </span>
          )}
          
          {task.category && <span className="category-tag">{task.category}</span>}
          
          {task.description && (
            <p className="task-description">{task.description}</p>
          )}
          
          {task.dueDate && (
            <div className="task-due-date">
              <i className="fa fa-calendar"></i> Due: {new Date(task.dueDate).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Task;