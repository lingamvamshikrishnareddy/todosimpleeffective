import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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
import KanbanColumn from './KanbanColumn';
import SortableTask from './SortableTask';
import { COLORS } from '../styles/colors';
import { SPACING } from '../styles/spacing';

// Define the columns and their corresponding statuses
const KANBAN_COLUMNS = {
  backlog: { id: 'backlog', title: 'Backlog', status: 'backlog' },
  active: { id: 'active', title: 'Active', status: 'active' },
  'under-review': { id: 'under-review', title: 'Under Review', status: 'under-review' },
  completed: { id: 'completed', title: 'Completed', status: 'completed' },
};

const TaskKanban = ({ tasks = [], onEdit, onDelete, onStatusChange }) => {
  const [columns, setColumns] = useState(() => {
    // Initialize columns with empty taskIds arrays
    const initialCols = {};
    Object.values(KANBAN_COLUMNS).forEach(colInfo => {
      initialCols[colInfo.id] = { ...colInfo, taskIds: [] };
    });
    return initialCols;
  });
  const [activeTask, setActiveTask] = useState(null); // Store the full task being dragged

  // Group tasks into columns when tasks prop changes
  useEffect(() => {
    const newColumns = {};
    Object.values(KANBAN_COLUMNS).forEach(colInfo => {
      newColumns[colInfo.id] = { ...colInfo, taskIds: [] };
    });

    tasks.forEach(task => {
      const taskId = task._id || task.id;
      // Default to 'active' if status is missing or doesn't match a column
      const taskStatus = task.status || 'active';
      const targetColumnId = Object.values(KANBAN_COLUMNS).find(c => c.status === taskStatus)?.id || 'active';

      if (newColumns[targetColumnId]) {
        if (!newColumns[targetColumnId].taskIds.includes(taskId)) {
          newColumns[targetColumnId].taskIds.push(taskId);
        }
      } else {
        // Fallback if status somehow doesn't match known columns
        if (!newColumns.active.taskIds.includes(taskId)) {
          newColumns.active.taskIds.push(taskId);
        }
      }
    });

    setColumns(newColumns);
  }, [tasks]); // Rerun when tasks array changes

  // Find task by ID helper (memoized)
  const getTaskById = useCallback((id) => {
    return tasks.find(task => (task._id || task.id) === id);
  }, [tasks]);

  // Setup sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require the touch to move more pixels before initiating a drag
      // Helps distinguish between taps and drags
      activationConstraint: {
        distance: Platform.OS === 'web' ? 8 : 15, // More distance for touch devices
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
    setActiveTask(task); // Set the full task object for the overlay
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over || !active) return;

    const activeId = active.id;
    const overId = over.id;

    // Prevent dropping on itself
    if (activeId === overId) return;

    const activeColumn = findColumnContainingTask(activeId);
    const overColumn = findColumnContainingTask(overId) || (over.data.current?.type === 'column' ? columns[overId.replace('column:', '')] : null);

    if (!activeColumn || !overColumn || activeColumn === overColumn) {
      return; // Not dragging over a different valid column or task in a different column
    }

    // Preview the move
    setColumns(prev => {
      const activeItems = prev[activeColumn.id].taskIds;
      const overItems = prev[overColumn.id].taskIds;

      const activeIndex = activeItems.indexOf(activeId);
      let overIndex = overItems.indexOf(overId);

      // If dropping onto a column directly, find where to place it
      if (overIndex === -1 && over.data.current?.type === 'column') {
        // Drop at the end if dropping on the column container itself
        overIndex = overItems.length;
      } else if (overIndex === -1) {
        // Dropping onto a task within the target column
        const overTaskElement = over.data.current?.sortable?.node?.current;
        if (overTaskElement) {
          const isBelowOverItem = active.rect.current.translated &&
            active.rect.current.translated.top > overTaskElement.offsetTop + overTaskElement.offsetHeight / 2;
          overIndex = overItems.indexOf(overId) + (isBelowOverItem ? 1 : 0);
        } else {
          // Fallback if task element data isn't available
          overIndex = overItems.length;
        }
      }

      // Optimistic update preview
      let newColumns = { ...prev };
      newColumns[activeColumn.id] = {
        ...prev[activeColumn.id],
        taskIds: activeItems.filter(id => id !== activeId)
      };

      // Insert into new column preview
      const updatedOverItems = [
        ...overItems.slice(0, overIndex),
        activeId,
        ...overItems.slice(overIndex)
      ];
      newColumns[overColumn.id] = {
        ...prev[overColumn.id],
        taskIds: updatedOverItems
      };

      return newColumns;
    });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTask(null); // Clear overlay task

    if (!over) return; // Dropped outside any droppable

    const activeId = active.id;
    const overId = over.id;

    const activeColumn = findColumnContainingTask(activeId);
    // Determine destination: could be a column ID or a task ID
    let overColumn;
    if (over.data.current?.type === 'column') {
      overColumn = columns[overId.replace('column:', '')];
    } else {
      overColumn = findColumnContainingTask(overId);
    }

    if (!activeColumn || !overColumn) {
      console.warn("Could not determine source or destination column.");
      return;
    }

    const activeColumnId = activeColumn.id;
    const overColumnId = overColumn.id;

    // If dropped in a different column
    if (activeColumnId !== overColumnId) {
      const newStatus = KANBAN_COLUMNS[overColumnId]?.status || 'active'; // Map col ID back to status

      // Update local state (already previewed in handleDragOver, now finalize)
      setColumns(prev => {
        const sourceTaskIds = prev[activeColumnId]?.taskIds || [];
        const destinationTaskIds = prev[overColumnId]?.taskIds || [];

        // Ensure task is removed from source
        const filteredSourceTaskIds = sourceTaskIds.filter(id => id !== activeId);

        // Find correct insert position in destination
        let overIndex = destinationTaskIds.indexOf(overId); // Index if dropped ON a task
        if (overIndex === -1) {
          // If dropped on the column or invalid task, add to the end
          overIndex = destinationTaskIds.length;
        } else {
          // Adjust index based on drop position relative to the task dropped on
          const overTaskElement = over.data.current?.sortable?.node?.current;
          if (overTaskElement && active.rect.current.translated) {
            const isBelowOverItem = active.rect.current.translated.top > overTaskElement.offsetTop + overTaskElement.offsetHeight / 2;
            overIndex = overIndex + (isBelowOverItem ? 1 : 0);
          }
        }

        // Ensure task isn't duplicated if already exists (can happen with rapid moves)
        const uniqueDestinationTaskIds = destinationTaskIds.filter(id => id !== activeId);

        const finalDestinationTaskIds = [
          ...uniqueDestinationTaskIds.slice(0, overIndex),
          activeId,
          ...uniqueDestinationTaskIds.slice(overIndex)
        ];

        return {
          ...prev,
          [activeColumnId]: { ...prev[activeColumnId], taskIds: filteredSourceTaskIds },
          [overColumnId]: { ...prev[overColumnId], taskIds: finalDestinationTaskIds },
        };
      });

      // Call API to update task status
      console.log(`Task ${activeId} moved from ${activeColumnId} to ${overColumnId}. New status: ${newStatus}`);
      onStatusChange(activeId, newStatus);

    } else {
      // Task was moved within the same column (reordering)
      const taskIds = columns[activeColumnId].taskIds;
      const oldIndex = taskIds.indexOf(activeId);
      const newIndex = taskIds.indexOf(overId); // overId will be a task ID here

      if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
        setColumns(prev => ({
          ...prev,
          [activeColumnId]: {
            ...prev[activeColumnId],
            taskIds: arrayMove(taskIds, oldIndex, newIndex),
          },
        }));
        console.log(`Task ${activeId} reordered within ${activeColumnId}.`);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToWindowEdges, restrictToParentElement]}
    >
      <View style={styles.kanbanBoard}>
        {Object.values(columns).map(column => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            taskIds={column.taskIds}
            tasks={tasks}
            getTaskById={getTaskById}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </View>
      <DragOverlay>
        {activeTask ? (
          <SortableTask
            id={activeTask._id || activeTask.id}
            task={activeTask}
            isOverlay={true}
            onEdit={() => {}}
            onDelete={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

const styles = StyleSheet.create({
  kanbanBoard: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    padding: SPACING.md,
    gap: SPACING.md,
    height: '100%',
  },
});

export default TaskKanban;