import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import CheckBox from '@react-native-community/checkbox';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/colors';
import { SPACING } from '../styles/spacing';
import { TYPOGRAPHY } from '../styles/typography';

const Task = ({ task, onDelete, onEdit, onToggleComplete }) => {
  // Ensure we're using the correct ID property consistently
  const taskId = task._id || task.id;
  
  // Ensure we're properly handling the task title 
  const taskTitle = task.title || task.text || "Untitled Task";
  
  return (
    <View style={[
      styles.taskItem,
      task.status === 'completed' && styles.completedTask
    ]}>
      <View style={styles.taskCheckboxTitle}>
        <CheckBox
          value={task.status === 'completed'}
          onValueChange={() => onToggleComplete(taskId)}
          tintColors={{ true: COLORS.primary, false: COLORS.textDark }}
          style={styles.taskCheckbox}
        />
        
        <View style={styles.taskContent}>
          <View style={styles.taskHeader}>
            <Text 
              style={[
                styles.taskTitle,
                task.status === 'completed' && styles.completedText
              ]}
            >
              {taskTitle}
            </Text>
            
            <View style={styles.taskActions}>
              <TouchableOpacity 
                style={styles.iconButton} 
                onPress={() => onEdit(task)}
              >
                <Ionicons name="pencil" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.iconButton} 
                onPress={() => onDelete(taskId)}
              >
                <Ionicons name="trash" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          </View>
          
          {task.priority && (
            <View style={[
              styles.priorityBadge, 
              styles[`priority${task.priority.charAt(0).toUpperCase() + task.priority.slice(1).toLowerCase()}`]
            ]}>
              <Text style={styles.priorityText}>{task.priority}</Text>
            </View>
          )}
          
          {task.category && (
            <View style={styles.categoryTag}>
              <Text style={styles.categoryText}>{task.category}</Text>
            </View>
          )}
          
          {task.description && (
            <Text style={styles.taskDescription} numberOfLines={2}>
              {task.description}
            </Text>
          )}
          
          {task.dueDate && (
            <View style={styles.taskDueDate}>
              <Ionicons name="calendar" size={16} color={COLORS.textMedium} />
              <Text style={styles.dueDateText}>
                Due: {new Date(task.dueDate).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  taskItem: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  completedTask: {
    backgroundColor: COLORS.backgroundMuted,
    opacity: 0.8,
  },
  taskCheckboxTitle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  taskCheckbox: {
    marginRight: SPACING.sm,
    alignSelf: 'flex-start',
  },
  taskContent: {
    flex: 1,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  taskTitle: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: '600',
    flex: 1,
    color: COLORS.textDark,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  taskActions: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 6,
    marginLeft: SPACING.sm,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: SPACING.sm,
    marginTop: 2,
  },
  priorityHigh: {
    backgroundColor: COLORS.priorityHighBg,
  },
  priorityMedium: {
    backgroundColor: COLORS.priorityMediumBg,
  },
  priorityLow: {
    backgroundColor: COLORS.priorityLowBg,
  },
  priorityText: {
    ...TYPOGRAPHY.caption,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.tagBackground,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: SPACING.sm,
  },
  categoryText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textDark,
  },
  taskDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMedium,
    marginBottom: SPACING.sm,
  },
  taskDueDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueDateText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMedium,
    marginLeft: 4,
  },
});

export default Task;