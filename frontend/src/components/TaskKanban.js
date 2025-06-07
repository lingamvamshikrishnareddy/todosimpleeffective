import React, { useState, useEffect, useCallback, useRef } from 'react';
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


// Define the columns and their corresponding statuses
const TASK_STATUSES = {
  BACKLOG: 'backlog',
  ACTIVE: 'active',
  UNDER_REVIEW: 'under-review',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

const KANBAN_COLUMNS = {
  backlog: { id: 'backlog', title: 'Backlog', status: 'backlog', icon: 'fa-inbox' },
  active: { id: 'active', title: 'Active', status: 'active', icon: 'fa-play' },
  'under-review': { id: 'under-review', title: 'Under Review', status: 'under-review', icon: 'fa-eye' },
  completed: { id: 'completed', title: 'Completed', status: 'completed', icon: 'fa-check' },
};

const TaskKanban = ({ tasks = [], onEdit, onDelete, onStatusChange, isLoading = false }) => {
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
      const targetColumnId = Object.values(KANBAN_COLUMNS).find(c => c.status === taskStatus)?.id || 'active';

      if (newColumns[targetColumnId]) {
        if (!newColumns[targetColumnId].taskIds.includes(taskId)) {
          newColumns[targetColumnId].taskIds.push(taskId);
        }
      } else {
        if (!newColumns.active.taskIds.includes(taskId)) {
          newColumns.active.taskIds.push(taskId);
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
  if (activeColumn.id === overColumn.id) return; // Same column, don't do anything here

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

    // Add to destination (at the end for now)
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

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
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
              formatDate={formatDate}
              getPriorityClass={getPriorityClass}
              isDragOver={dragOverColumn === column.id}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            formatDate={formatDate}
            getPriorityClass={getPriorityClass}
            onEdit={() => {}}
            onDelete={() => {}}
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
          gap: 1.5rem;
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
          }
        }
      `}</style>
    </DndContext>
  );
};

// Separate KanbanColumn component
const KanbanColumn = ({ column, tasks, getTaskById, onEdit, onDelete, formatDate, getPriorityClass, isDragOver }) => {
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
                  formatDate={formatDate}
                  getPriorityClass={getPriorityClass}
                  onEdit={onEdit}
                  onDelete={onDelete}
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
          min-width: 280px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 2px solid transparent;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
        }

        .kanban-column.drag-over {
          border-color: #007bff;
          background: #e3f2fd;
          transform: scale(1.02);
        }

        .column-header {
          padding: 1rem;
          background: #fff;
          border-radius: 8px 8px 0 0;
          border-bottom: 1px solid #e9ecef;
        }

        .column-title {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: #343a40;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .task-count {
          background: #6c757d;
          color: white;
          padding: 0.2rem 0.5rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
          margin-left: auto;
        }

        .column-content {
          flex: 1;
          padding: 1rem;
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
          padding: 2rem 1rem;
        }

        .empty-column i {
          font-size: 2rem;
          margin-bottom: 0.5rem;
          opacity: 0.5;
        }

        .empty-column p {
          margin: 0;
        }

        .drop-hint {
          color: #007bff;
          font-weight: 600;
          margin-top: 0.5rem;
        }

        .drop-zone {
          background: #e3f2fd;
          border: 2px dashed #007bff;
          border-radius: 8px;
          padding: 1rem;
          text-align: center;
          color: #007bff;
          font-weight: 600;
          margin-top: 1rem;
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

// Draggable task wrapper
const DraggableTask = ({ task, formatDate, getPriorityClass, onEdit, onDelete }) => {
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
        formatDate={formatDate}
        getPriorityClass={getPriorityClass}
        onEdit={onEdit}
        onDelete={onDelete}
        isDragging={isDragging}
      />
    </div>
  );
};

// Task card component
const TaskCard = ({ task, formatDate, getPriorityClass, onEdit, onDelete, isDragging = false, isOverlay = false }) => {
  return (
    <div className={`task-card ${isDragging ? 'task-item-dragging' : ''} ${isOverlay ? 'task-overlay' : ''}`}>
      <div className="task-card-header">
        <h4 className="task-title">{task.title}</h4>
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
          <span className="task-due-date">
            <i className="fa fa-calendar"></i> {formatDate(task.dueDate)}
          </span>
        )}
      </div>

      <style jsx>{`
        .task-card {
          background: white;
          border-radius: 8px;
          padding: 1rem;
          border: 1px solid #e9ecef;
          cursor: grab;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .task-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .task-card:active {
          cursor: grabbing;
        }

        .task-item-dragging {
          box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
          transform: rotate(2deg) !important;
          opacity: 0.8;
          z-index: 1000;
        }

        .task-overlay {
          transform: rotate(5deg) !important;
          box-shadow: 0 10px 30px rgba(0,0,0,0.4) !important;
        }

        .task-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.5rem;
        }

        .task-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #343a40;
          flex: 1;
          margin-right: 0.5rem;
        }

        .task-actions {
          display: flex;
          gap: 0.25rem;
        }

        .task-action-btn {
          background: none;
          border: none;
          color: #6c757d;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .task-action-btn:hover {
          background: #f8f9fa;
          color: #343a40;
        }

        .edit-btn:hover {
          color: #007bff;
        }

        .delete-btn:hover {
          color: #dc3545;
        }

        .task-description {
          margin: 0.5rem 0;
          color: #6c757d;
          font-size: 0.9rem;
          line-height: 1.4;
        }

        .task-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .task-meta span {
          font-size: 0.8rem;
          padding: 0.2rem 0.5rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .task-category {
          background: #e3f2fd;
          color: #1976d2;
        }

        .task-priority {
          font-weight: 500;
        }

        .priority-high {
          background: #ffebee;
          color: #d32f2f;
        }

        .priority-medium {
          background: #fff3e0;
          color: #f57c00;
        }

        .priority-low {
          background: #e8f5e8;
          color: #388e3c;
        }

        .priority-default {
          background: #f5f5f5;
          color: #757575;
        }

        .task-due-date {
          background: #f3e5f5;
          color: #7b1fa2;
        }
      `}</style>
    </div>
  );
};

export default TaskKanban;