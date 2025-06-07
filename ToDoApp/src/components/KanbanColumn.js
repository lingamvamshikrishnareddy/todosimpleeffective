import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortableTask from './SortableTask';
import { COLORS } from '../styles/colors';
import { SPACING } from '../styles/spacing';
import { TYPOGRAPHY } from '../styles/typography';

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
    <View
      style={[
        styles.kanbanColumn,
        isOver && styles.dropActive
      ]}
      ref={setNodeRef} // Attach droppable ref here
    >
      <View style={styles.kanbanColumnHeader}>
        <Text style={styles.kanbanColumnTitle}>{title}</Text>
        <View style={styles.taskCountContainer}>
          <Text style={styles.taskCount}>{taskIds.length}</Text>
        </View>
      </View>

      {/* SortableContext needs the ref from useDroppable to define the container */}
      <SortableContext
        items={taskIds} // Use only IDs for SortableContext
        strategy={verticalListSortingStrategy}
        id={id} // Pass the plain column id as the context id
      >
        <ScrollView style={styles.kanbanColumnContent}>
          {columnTasks.length === 0 ? (
            <View style={styles.emptyColumn}>
              <Text style={styles.emptyColumnText}>Drag tasks here or add new ones</Text>
            </View>
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
        </ScrollView>
      </SortableContext>
    </View>
  );
};

const styles = StyleSheet.create({
  kanbanColumn: {
    flex: 1,
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 8,
    minWidth: 280,
    maxWidth: 300,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  dropActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.backgroundHighlight,
  },
  kanbanColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.backgroundMedium,
  },
  kanbanColumnTitle: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: 'bold',
    color: COLORS.textDark,
  },
  taskCountContainer: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  taskCount: {
    color: COLORS.white,
    ...TYPOGRAPHY.caption,
    fontWeight: 'bold',
  },
  kanbanColumnContent: {
    flex: 1,
    padding: SPACING.sm,
  },
  emptyColumn: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 8,
    marginTop: SPACING.md,
  },
  emptyColumnText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

export default KanbanColumn;