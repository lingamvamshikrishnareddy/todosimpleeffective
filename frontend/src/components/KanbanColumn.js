import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortableTask from './SortableTask';

// Receive plain ID, construct droppable ID internally
const KanbanColumn = ({ id, title, taskIds, tasks, getTaskById, onEdit, onDelete }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${id}`, // Use prefix to distinguish columns in handlers
    data: { // Add data for context in handlers
        type: 'column',
        accepts: ['task'] // Specify what it accepts
    }
  });

  // Get full task objects for rendering
  const columnTasks = taskIds.map(taskId => getTaskById(taskId)).filter(Boolean); // Filter out nulls if task not found

  return (
    <div
       // Use the plain `id` for data attribute if needed elsewhere
      data-column-id={id}
      ref={setNodeRef} // Attach droppable ref here
      className={`kanban-column ${isOver ? 'drop-active' : ''}`}
    >
      <div className="kanban-column-header">
        <h3 className="kanban-column-title">{title}</h3>
        <span className="task-count">{taskIds.length}</span>
      </div>

      {/* SortableContext needs the ref from useDroppable to define the container */}
      <SortableContext
         items={taskIds} // Use only IDs for SortableContext
         strategy={verticalListSortingStrategy}
         id={id} // Pass the plain column id as the context id
      >
        {/* This div receives the layout styles potentially applied by SortableContext */}
        <div className="kanban-column-content">
          {columnTasks.length === 0 ? (
            <div className="empty-column">
              <p>Drag tasks here or add new ones</p> {/* Updated placeholder */}
            </div>
          ) : (
            columnTasks.map(task => (
              <SortableTask
                key={task._id || task.id}
                id={task._id || task.id} // Pass the task's unique ID
                task={task}
                onEdit={() => onEdit(task)} // Pass original task object
                onDelete={() => onDelete(task._id || task.id)} // Pass task ID
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
};

export default KanbanColumn;