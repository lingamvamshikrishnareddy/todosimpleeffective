import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/colors';
import { SPACING } from '../styles/spacing';
import { TYPOGRAPHY } from '../styles/typography';

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

  // Determine priority style
  const getPriorityStyle = () => {
    if (!task.priority) return {};
    
    const priorityColors = {
      high: { backgroundColor: COLORS.priorityHigh },
      medium: { backgroundColor: COLORS.priorityMedium },
      low: { backgroundColor: COLORS.priorityLow },
    };
    
    return priorityColors[task.priority.toLowerCase()] || {};
  };

  // Use task._id or task.id consistently
  const taskId = task._id || task.id;
  const taskTitle = task.title || task.text || "Untitled Task";

  const cardStyle = [
    styles.taskCard,
    getPriorityStyle(),
    isDragging && styles.dragging,
    isOverlay && styles.overlay,
    {
      transform: transform ? [
        { translateX: transform.x }, 
        { translateY: transform.y }
      ] : [],
      transition,
      opacity: isDragging ? 0.5 : 1,
    }
  ];

  return (
    <View
      ref={setNodeRef}
      style={cardStyle}
      {...attributes}
      {...listeners}
    >
      <View style={styles.taskCardHeader}>
        <Text style={styles.taskCardTitle} numberOfLines={2}>{taskTitle}</Text>
        
        {/* Action buttons */}
        <View style={styles.taskActions}>
          <TouchableOpacity
            style={styles.taskActionButton}
            onPress={(e) => {
              // React Native doesn't need stopPropagation in the same way
              onEdit(task); // Pass the full task object
            }}
            disabled={isOverlay}
          >
            <Ionicons name="pencil" size={18} color={COLORS.textDark} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.taskActionButton}
            onPress={(e) => {
              onDelete(taskId); // Pass the ID for deletion
            }}
            disabled={isOverlay}
          >
            <Ionicons name="trash" size={18} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>
      </View>

      {task.description && (
        <Text style={styles.taskCardDescription} numberOfLines={2}>
          {task.description}
        </Text>
      )}

      <View style={styles.taskCardFooter}>
        {task.category && (
          <View style={styles.categoryTag}>
            <Ionicons name="pricetag" size={14} color={COLORS.textDark} />
            <Text style={styles.categoryText}>{task.category}</Text>
          </View>
        )}

        {task.dueDate && (
          <View style={styles.dueDateTag}>
            <Ionicons name="calendar" size={14} color={COLORS.textDark} />
            <Text style={styles.dueDateText}>
              {new Date(task.dueDate).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  taskCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  dragging: {
    opacity: 0.5,
  },
  overlay: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  taskCardTitle: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: 'bold',
    flex: 1,
    color: COLORS.textDark,
  },
  taskActions: {
    flexDirection: 'row',
    marginLeft: SPACING.sm,
  },
  taskActionButton: {
    padding: 6,
    marginLeft: 4,
  },
  taskCardDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMedium,
    marginBottom: SPACING.sm,
  },
  taskCardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginTop: SPACING.xs,
    gap: SPACING.sm,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.tagBackground,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  categoryText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textDark,
    marginLeft: 4,
  },
  dueDateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.tagBackground,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dueDateText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textDark,
    marginLeft: 4,
  },
});

export default SortableTask;