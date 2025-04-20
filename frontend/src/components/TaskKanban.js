import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import './TaskKanban.css';

const TaskKanban = ({ tasks, onStatusChange, onEdit, onDelete }) => {
  // Initialize columns with the proper structure
  const [columns, setColumns] = useState({
    'backlog': {
      name: 'Backlog',
      items: []
    },
    'active': {
      name: 'In Progress',
      items: []
    },
    'review': {
      name: 'Under Review',
      items: []
    },
    'completed': {
      name: 'Completed',
      items: []
    }
  });

  // Prepare columns whenever tasks change
  useEffect(() => {
    const newColumns = {
      'backlog': { name: 'Backlog', items: [] },
      'active': { name: 'In Progress', items: [] },
      'review': { name: 'Under Review', items: [] },
      'completed': { name: 'Completed', items: [] }
    };

    // Distribute tasks into columns
    tasks.forEach(task => {
      const status = task.status || 'backlog';
      if (newColumns[status]) {
        newColumns[status].items.push(task);
      } else {
        // Default to backlog for any unrecognized status
        newColumns.backlog.items.push(task);
      }
    });

    setColumns(newColumns);
  }, [tasks]);

  // Handle drag end event
  const onDragEnd = useCallback((result) => {
    if (!result.destination) return;
    
    const { source, destination, draggableId } = result;

    // If dropped in the same column at the same position, do nothing
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) return;

    // Get source and destination columns
    const sourceColumn = columns[source.droppableId];
    const destColumn = columns[destination.droppableId];
    
    // Create copies of the item arrays
    const sourceItems = [...sourceColumn.items];
    const destItems = source.droppableId === destination.droppableId 
      ? sourceItems 
      : [...destColumn.items];
    
    // Remove the item from source array
    const [removed] = sourceItems.splice(source.index, 1);
    
    // Insert the item into destination array
    destItems.splice(destination.index, 0, removed);
    
    // Update the state
    setColumns({
      ...columns,
      [source.droppableId]: {
        ...sourceColumn,
        items: sourceItems
      },
      [destination.droppableId]: {
        ...destColumn,
        items: destItems
      }
    });

    // If the column changed, update the task status in the backend
    if (source.droppableId !== destination.droppableId) {
      onStatusChange(draggableId, destination.droppableId);
    }
  }, [columns, onStatusChange]);

  // Render priority badge
  const renderPriorityBadge = (priority) => {
    const badges = {
      high: { class: 'priority-badge-high', icon: '🔴', text: 'High' },
      medium: { class: 'priority-badge-medium', icon: '🟠', text: 'Medium' },
      low: { class: 'priority-badge-low', icon: '🟢', text: 'Low' }
    };
    
    const badge = badges[priority] || badges.medium;
    
    return (
      <span className={`priority-badge ${badge.class}`}>
        {badge.icon} {badge.text}
      </span>
    );
  };

  // Format due date
  const formatDueDate = (dateString) => {
    if (!dateString) return null;
    
    const date = new Date(dateString);
    const now = new Date();
    
    // Check if date is valid
    if (isNaN(date.getTime())) return null;
    
    // Format the date
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    
    // Calculate if it's overdue
    const isOverdue = date < now && columns['completed'].items.find(
      item => item._id === item._id || item.id === item.id
    ) === undefined;
    
    return (
      <span className={`due-date ${isOverdue ? 'overdue' : ''}`}>
        {isOverdue ? '⚠️ ' : '📅 '}
        Due: {formattedDate}
      </span>
    );
  };

  return (
    <div className="kanban-board">
      <DragDropContext onDragEnd={onDragEnd}>
        {Object.entries(columns).map(([columnId, column]) => (
          <div className="kanban-column" key={columnId}>
            <h3 className="kanban-column-title">
              {column.name} <span className="task-count">{column.items.length}</span>
            </h3>
            
            <Droppable droppableId={columnId}>
              {(provided, snapshot) => (
                <div
                  className={`kanban-tasks ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {column.items.map((task, index) => (
                    <Draggable 
                      key={task._id || task.id} 
                      draggableId={task._id || task.id} 
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          className={`kanban-task ${snapshot.isDragging ? 'dragging' : ''}`}
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <div className="task-header">
                            <h4 className="task-title">{task.title}</h4>
                            <div className="task-actions">
                              <button 
                                className="edit-button"
                                onClick={() => onEdit(task)}
                                title="Edit Task"
                              >
                                <i className="fa fa-pencil"></i>
                              </button>
                              <button 
                                className="delete-button"
                                onClick={() => onDelete(task._id || task.id)}
                                title="Delete Task"
                              >
                                <i className="fa fa-trash"></i>
                              </button>
                            </div>
                          </div>
                          
                          {task.description && (
                            <p className="task-description">{task.description}</p>
                          )}
                          
                          <div className="task-meta">
                            {task.category && (
                              <span className="task-category">
                                <i className="fa fa-tag"></i> {task.category}
                              </span>
                            )}
                            
                            {task.priority && renderPriorityBadge(task.priority)}
                            
                            {task.dueDate && formatDueDate(task.dueDate)}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  
                  {column.items.length === 0 && (
                    <div className="empty-column">
                      <p>No tasks in {column.name}</p>
                      <p className="empty-tip">Drag tasks here or add a new task</p>
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </DragDropContext>
    </div>
  );
};

export default TaskKanban;