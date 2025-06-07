import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
  KeyboardSensor
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { restrictToWindowEdges, restrictToParentElement } from '@dnd-kit/modifiers';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Define the columns and their corresponding statuses (only Active and Completed)
const TASK_STATUSES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
};

const KANBAN_COLUMNS = {
  active: { id: 'active', title: 'Active Tasks', status: 'active', icon: 'fa-play-circle' },
  completed: { id: 'completed', title: 'Completed Tasks', status: 'completed', icon: 'fa-check-circle' },
};

const TaskKanban = ({ 
  tasks = [], 
  onEdit, 
  onDelete, 
  onStatusChange, 
  onToggleComplete,
  isLoading = false 
}) => {
  const [columns, setColumns] = useState(() => {
    // Initialize columns with empty taskIds arrays
    const initialCols = {};
    Object.values(KANBAN_COLUMNS).forEach(colInfo => {
      initialCols[colInfo.id] = { ...colInfo, taskIds: [] };
    });
    return initialCols;
  });
  const [activeTask, setActiveTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Group tasks into columns when tasks prop changes
  useEffect(() => {
    const newColumns = {};
    Object.values(KANBAN_COLUMNS).forEach(colInfo => {
      newColumns[colInfo.id] = { ...colInfo, taskIds: [] };
    });

    tasks.forEach(task => {
      const taskId = task._id || task.id;
      const taskStatus = task.status || 'active';
      const targetColumnId = taskStatus === 'completed' ? 'completed' : 'active';

      if (newColumns[targetColumnId]) {
        if (!newColumns[targetColumnId].taskIds.includes(taskId)) {
          newColumns[targetColumnId].taskIds.push(taskId);
        }
      }
    });

    setColumns(newColumns);
  }, [tasks]);

  // Find task by ID helper (memoized)
  const getTaskById = useCallback((id) => {
    return tasks.find(task => (task._id || task.id) === id);
  }, [tasks]);

  // Setup sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const findColumnContainingTask = (taskId) => {
    if (!taskId) return null;
    return Object.values(columns).find(column => column.taskIds.includes(taskId));
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const task = getTaskById(active.id);
    setActiveTask(task);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over || !active) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeColumn = findColumnContainingTask(activeId);
    
    // Determine target column
    let overColumn = null;
    if (overId.toString().startsWith('column:')) {
      const columnId = overId.toString().replace('column:', '');
      overColumn = columns[columnId];
    } else {
      overColumn = findColumnContainingTask(overId);
    }

    if (!activeColumn || !overColumn) return;
    if (activeColumn.id === overColumn.id) return;

    setDragOverColumn(overColumn.id);

    // Move task between columns
    setColumns(prev => {
      const sourceItems = [...prev[activeColumn.id].taskIds];
      const destItems = [...prev[overColumn.id].taskIds];

      // Remove from source
      const activeIndex = sourceItems.indexOf(activeId);
      if (activeIndex !== -1) {
        sourceItems.splice(activeIndex, 1);
      }

      // Add to destination
      if (!destItems.includes(activeId)) {
        destItems.push(activeId);
      }

      return {
        ...prev,
        [activeColumn.id]: { ...prev[activeColumn.id], taskIds: sourceItems },
        [overColumn.id]: { ...prev[overColumn.id], taskIds: destItems },
      };
    });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTask(null);
    setDragOverColumn(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeColumn = findColumnContainingTask(activeId);
    
    let overColumn = null;
    if (overId.toString().startsWith('column:')) {
      const columnId = overId.toString().replace('column:', '');
      overColumn = columns[columnId];
    } else {
      overColumn = findColumnContainingTask(overId);
    }

    if (!activeColumn || !overColumn) return;

    // If moved to different column, trigger status change
    if (activeColumn.id !== overColumn.id) {
      const newStatus = KANBAN_COLUMNS[overColumn.id]?.status || 'active';
      console.log(`Task ${activeId} moved from ${activeColumn.id} to ${overColumn.id}. New status: ${newStatus}`);
      onStatusChange(activeId, newStatus);
    } else {
      // Same column reordering
      const taskIds = columns[activeColumn.id].taskIds;
      const oldIndex = taskIds.indexOf(activeId);
      const newIndex = taskIds.indexOf(overId);

      if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
        setColumns(prev => ({
          ...prev,
          [activeColumn.id]: {
            ...prev[activeColumn.id],
            taskIds: arrayMove(taskIds, oldIndex, newIndex),
          },
        }));
      }
    }
  };

  // Format date helper with time
  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get priority class helper
  const getPriorityClass = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-default';
    }
  };

  // Check if task is overdue
  const isOverdue = (dueDate, status) => {
    if (!dueDate || status === 'completed') return false;
    return new Date(dueDate) < new Date();
  };

  if (isLoading) {
    return (
      <div className="kanban-loading">
        <i className="fa fa-spinner fa-spin fa-2x"></i>
        <p>Loading tasks...</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToWindowEdges, restrictToParentElement]}
    >
      <div className="kanban-board">
        <div className="kanban-columns">
          {Object.values(columns).map(column => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={tasks}
              getTaskById={getTaskById}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleComplete={onToggleComplete}
              formatDateTime={formatDateTime}
              getPriorityClass={getPriorityClass}
              isOverdue={isOverdue}
              isDragOver={dragOverColumn === column.id}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            formatDateTime={formatDateTime}
            getPriorityClass={getPriorityClass}
            isOverdue={isOverdue}
            onEdit={() => {}}
            onDelete={() => {}}
            onToggleComplete={() => {}}
            isOverlay={true}
          />
        ) : null}
      </DragOverlay>

      <style jsx>{`
        .kanban-board {
          width: 100%;
          height: 100%;
          overflow-x: auto;
          padding: 1rem;
        }

        .kanban-columns {
          display: flex;
          gap: 2rem;
          min-width: fit-content;
          height: calc(100vh - 300px);
          min-height: 500px;
        }

        .kanban-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: #6c757d;
        }

        .kanban-loading i {
          margin-bottom: 1rem;
        }

        @media (max-width: 768px) {
          .kanban-columns {
            flex-direction: column;
            height: auto;
            gap: 1rem;
          }
        }
      `}</style>
    </DndContext>
  );
};

// Enhanced KanbanColumn component
const KanbanColumn = ({ 
  column, 
  tasks, 
  getTaskById, 
  onEdit, 
  onDelete, 
  onToggleComplete,
  formatDateTime, 
  getPriorityClass, 
  isOverdue,
  isDragOver 
}) => {
  const columnTasks = column.taskIds.map(taskId => getTaskById(taskId)).filter(Boolean);

  return (
    <div className={`kanban-column ${isDragOver ? 'drag-over' : ''}`}>
      <div className="column-header">
        <h3 className="column-title">
          <i className={`fa ${column.icon}`}></i>
          {column.title}
          <span className="task-count">({columnTasks.length})</span>
        </h3>
      </div>
      
      <DroppableColumn columnId={column.id}>
        <div className="column-content">
          {columnTasks.length === 0 ? (
            <div className="empty-column">
              <i className="fa fa-folder-open-o"></i>
              <p>No tasks</p>
              {isDragOver && (
                <p className="drop-hint">Drop task here</p>
              )}
            </div>
          ) : (
            <div className="task-list">
              {columnTasks.map(task => (
                <DraggableTask
                  key={task._id || task.id}
                  task={task}
                  formatDateTime={formatDateTime}
                  getPriorityClass={getPriorityClass}
                  isOverdue={isOverdue}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleComplete={onToggleComplete}
                />
              ))}
              {isDragOver && (
                <div className="drop-zone">
                  <i className="fa fa-plus-circle"></i>
                  <span>Drop here to move to {column.title}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DroppableColumn>

      <style jsx>{`
        .kanban-column {
          flex: 1;
          min-width: 350px;
          max-width: 450px;
          background: #f8f9fa;
          border-radius: 12px;
          border: 2px solid transparent;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .kanban-column.drag-over {
          border-color: #007bff;
          background: #e3f2fd;
          transform: scale(1.02);
          box-shadow: 0 4px 16px rgba(0,123,255,0.2);
        }

        .column-header {
          padding: 1.25rem;
          background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
          border-radius: 12px 12px 0 0;
          border-bottom: 1px solid #e9ecef;
        }

        .column-title {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 700;
          color: #343a40;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .column-title i {
          color: #007bff;
          font-size: 1.1rem;
        }

        .task-count {
          background: linear-gradient(135deg, #007bff, #0056b3);
          color: white;
          padding: 0.3rem 0.7rem;
          border-radius: 16px;
          font-size: 0.85rem;
          font-weight: 600;
          margin-left: auto;
          box-shadow: 0 2px 4px rgba(0,123,255,0.2);
        }

        .column-content {
          flex: 1;
          padding: 1.25rem;
          overflow-y: auto;
        }

        .task-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-height: 100px;
        }

        .empty-column {
          text-align: center;
          color: #6c757d;
          padding: 3rem 1rem;
        }

        .empty-column i {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          opacity: 0.4;
        }

        .empty-column p {
          margin: 0;
          font-size: 1.1rem;
        }

        .drop-hint {
          color: #007bff;
          font-weight: 600;
          margin-top: 0.75rem;
        }

        .drop-zone {
          background: linear-gradient(135deg, #e3f2fd, #bbdefb);
          border: 2px dashed #007bff;
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          color: #007bff;
          font-weight: 600;
          margin-top: 1rem;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .drop-zone i {
          margin-right: 0.5rem;
        }
      `}</style>
    </div>
  );
};

// Droppable column wrapper
const DroppableColumn = ({ columnId, children }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `column:${columnId}`,
    data: {
      type: 'column',
      columnId: columnId,
    },
  });

  return (
    <div ref={setNodeRef} className={isOver ? 'droppable-over' : ''}>
      {children}
    </div>
  );
};

// Enhanced Draggable task wrapper
const DraggableTask = ({ 
  task, 
  formatDateTime, 
  getPriorityClass, 
  isOverdue,
  onEdit, 
  onDelete, 
  onToggleComplete 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id || task.id,
    data: {
      type: 'task',
      task: task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? 'task-dragging' : ''}
    >
      <TaskCard
        task={task}
        formatDateTime={formatDateTime}
        getPriorityClass={getPriorityClass}
        isOverdue={isOverdue}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleComplete={onToggleComplete}
        isDragging={isDragging}
      />
    </div>
  );
};

// Enhanced Task card component with checkbox
const TaskCard = ({ 
  task, 
  formatDateTime, 
  getPriorityClass, 
  isOverdue,
  onEdit, 
  onDelete, 
  onToggleComplete,
  isDragging = false, 
  isOverlay = false 
}) => {
  const isCompleted = task.status === 'completed';
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div className={`task-card ${isDragging ? 'task-item-dragging' : ''} ${isOverlay ? 'task-overlay' : ''} ${isCompleted ? 'completed' : ''} ${overdue ? 'overdue' : ''}`}>
      <div className="task-card-header">
        <div className="task-checkbox-container">
          <input
            type="checkbox"
            className="task-checkbox"
            checked={isCompleted}
            onChange={(e) => {
              e.stopPropagation();
              onToggleComplete(task._id || task.id);
            }}
            title={isCompleted ? "Mark as active" : "Mark as completed"}
          />
          <h4 className={`task-title ${isCompleted ? 'completed-title' : ''}`}>
            {task.title}
          </h4>
        </div>
        <div className="task-actions">
          <button
            className="task-action-btn edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            aria-label={`Edit ${task.title}`}
            title="Edit task"
          >
            <i className="fa fa-edit"></i>
          </button>
          <button
            className="task-action-btn delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task._id || task.id);
            }}
            aria-label={`Delete ${task.title}`}
            title="Delete task"
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
        {task.priority && (
          <span className={`task-priority ${getPriorityClass(task.priority)}`}>
            <i className="fa fa-flag"></i> {task.priority}
          </span>
        )}
        {task.dueDate && (
          <span className={`task-due-date ${overdue ? 'overdue-date' : ''}`}>
            <i className="fa fa-calendar"></i> 
            Due: {formatDateTime(task.dueDate)}
            {overdue && <i className="fa fa-exclamation-triangle overdue-icon"></i>}
          </span>
        )}
        {task.createdAt && (
          <span className="task-created-date">
            <i className="fa fa-clock-o"></i> 
            Created: {formatDateTime(task.createdAt)}
          </span>
        )}
      </div>

      <style jsx>{`
        .task-card {
          background: white;
          border-radius: 12px;
          padding: 1.25rem;
          border: 1px solid #e9ecef;
          cursor: grab;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          position: relative;
        }

        .task-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.12);
          border-color: #007bff;
        }

        .task-card:active {
          cursor: grabbing;
        }

        .task-card.completed {
          background: #f8f9fa;
          border-color: #28a745;
        }

        .task-card.overdue {
          border-left: 4px solid #dc3545;
          background: linear-gradient(135deg, #fff 0%, #fff5f5 100%);
        }

        .task-item-dragging {
          box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important;
          transform: rotate(3deg) !important;
          opacity: 0.9;
          z-index: 1000;
          border-color: #007bff !important;
        }

        .task-overlay {
          transform: rotate(6deg) !important;
          box-shadow: 0 15px 40px rgba(0,0,0,0.4) !important;
        }

        .task-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        }

        .task-checkbox-container {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          flex: 1;
        }

        .task-checkbox {
          width: 18px;
          height: 18px;
          margin-top: 2px;
          cursor: pointer;
          accent-color: #28a745;
          transform: scale(1.2);
        }

        .task-title {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: #343a40;
          flex: 1;
          line-height: 1.4;
        }

        .completed-title {
          text-decoration: line-through;
          color: #6c757d;
        }

        .task-actions {
          display: flex;
          gap: 0.5rem;
          margin-left: 0.5rem;
        }

        .task-action-btn {
          background: none;
          border: none;
          color: #6c757d;
          cursor: pointer;
          padding: 0.4rem;
          border-radius: 6px;
          transition: all 0.2s ease;
          font-size: 0.9rem;
        }

        .task-action-btn:hover {
          background: #f8f9fa;
          color: #343a40;
          transform: scale(1.1);
        }

        .edit-btn:hover {
          color: #007bff;
          background: #e3f2fd;
        }

        .delete-btn:hover {
          color: #dc3545;
          background: #ffebee;
        }

        .task-description {
          margin: 0.75rem 0;
          color: #6c757d;
          font-size: 0.95rem;
          line-height: 1.5;
          padding-left: 2.5rem;
        }

        .task-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 1rem;
          padding-left: 2.5rem;
        }

        .task-meta span {
          font-size: 0.85rem;
          padding: 0.3rem 0.7rem;
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-weight: 500;
        }

        .task-category {
          background: #e3f2fd;
          color: #1976d2;
          border: 1px solid #bbdefb;
        }

        .task-priority {
          font-weight: 600;
        }

        .priority-high {
          background: #ffebee;
          color: #d32f2f;
          border: 1px solid #ffcdd2;
        }

        .priority-medium {
          background: #fff3e0;
          color: #f57c00;
          border: 1px solid #ffcc02;
        }

        .priority-low {
          background: #e8f5e8;
          color: #388e3c;
          border: 1px solid #c8e6c9;
        }

        .priority-default {
          background: #f5f5f5;
          color: #757575;
          border: 1px solid #e0e0e0;
        }

        .task-due-date {
          background: #f3e5f5;
          color: #7b1fa2;
          border: 1px solid #e1bee7;
        }

        .overdue-date {
          background: #ffebee;
          color: #d32f2f;
          border: 1px solid #ffcdd2;
          animation: pulse-red 2s infinite;
        }

        .overdue-icon {
          color: #dc3545;
          margin-left: 0.25rem;
        }

        .task-created-date {
          background: #e8f4fd;
          color: #1565c0;
          border: 1px solid #bbdefb;
        }

        @keyframes pulse-red {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default TaskKanban;
