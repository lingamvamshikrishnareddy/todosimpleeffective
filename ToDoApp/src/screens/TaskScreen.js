import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/FontAwesome';
import Task from '../components/Task';
import TaskKanban from '../components/TaskKanban';
import api from '../services/api';
import colors from '../styles/colors';
import typography from '../styles/typography';
import spacing from '../styles/spacing';

// Number of ms to debounce task fetching
const DEBOUNCE_DELAY = 300;

const TaskScreen = () => {
  const [tasks, setTasks] = useState([]);
  const [taskText, setTaskText] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt:desc');
  const [userProfile, setUserProfile] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [viewMode, setViewMode] = useState('kanban'); // default to kanban
  const [showFilterModal, setShowFilterModal] = useState(false);
  const navigation = useNavigation();

  // Create a stable reference for the timeout
  const timeoutRef = useRef(null);

  // Get user profile on screen focus with error handling
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const getUserProfile = async () => {
        try {
          const profile = await api.user.getProfile();
          if (isMounted) {
            setUserProfile(profile);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
          if (isMounted && (err.status === 401 || err.message?.includes('unauthorized'))) {
            navigation.navigate('Login');
          }
        }
      };

      getUserProfile();

      return () => {
        isMounted = false;
      };
    }, [navigation])
  );

  // Convert filter to API status - memoize function
  const getStatusFromFilter = useCallback(() => {
    if (filter === 'completed') return 'completed';
    if (filter === 'active') return 'active';
    return '';
  }, [filter]);

  // Create memoized query parameters for fetchTasks to prevent unnecessary re-renders
  const queryParams = useMemo(() => ({
    page,
    limit: viewMode === 'kanban' ? 100 : 10, // Load more tasks for kanban view
    status: getStatusFromFilter(),
    category: category || undefined,
    search: searchQuery || undefined,
    sortBy,
    priority: priority || undefined,
    dueDate: dueDate || undefined
  }), [page, getStatusFromFilter, category, searchQuery, sortBy, priority, dueDate, viewMode]);

  // Memoize the fetch function without the timeout logic
  const executeFetch = useCallback(async () => {
    if (isFetching) return;

    try {
      setIsFetching(true);
      setLoading(true);
      setError(null);

      const response = await api.tasks.getTasks(queryParams);

      setTasks(response.tasks || []);
      setTotalPages(response.pagination?.pages || 1);
    } catch (err) {
      if (err.status === 429) {
        setError('Too many requests. Please try again in a moment.');
      } else if (err.status === 401) {
        navigation.navigate('Login');
      } else {
        setError('Failed to load tasks. Please try again.');
      }
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }, [queryParams, navigation, isFetching]);

  // Handle the debounced fetch separately
  useEffect(() => {
    // Clear any existing timeout first
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      executeFetch();
    }, DEBOUNCE_DELAY);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [executeFetch]);

  // Optimized task actions with error handling and retries
  const addTask = async () => {
    if (taskText.trim() === '') return;
    
    // Dismiss keyboard
    Keyboard.dismiss();

    try {
      setError(null);

      if (isEditing) {
        await api.tasks.updateTask(currentTaskId, {
          title: taskText,
          description: taskDescription,
          category,
          priority,
          dueDate: dueDate || undefined
        });

        setIsEditing(false);
        setCurrentTaskId(null);
      } else {
        await api.tasks.createTask({
          title: taskText,
          description: taskDescription,
          category,
          priority,
          dueDate: dueDate || undefined
        });
      }

      // Reset form
      setTaskText('');
      setTaskDescription('');
      setCategory('');
      setPriority('');
      setDueDate('');

      // Refresh task list
      executeFetch();
    } catch (err) {
      const errorMessage = err.status === 429
        ? 'Too many requests. Please try again in a moment.'
        : 'Failed to save task. Please try again.';

      setError(errorMessage);
      console.error('Error saving task:', err);
    }
  };

  // Optimized delete with correct API call
  const deleteTask = async (taskId) => {
    try {
      if (!taskId) {
        console.error('Invalid task ID');
        return;
      }

      // Confirm delete
      Alert.alert(
        "Delete Task",
        "Are you sure you want to delete this task?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Delete", 
            style: "destructive",
            onPress: async () => {
              // Optimistic UI update
              const originalTasks = [...tasks];
              setTasks(prevTasks => prevTasks.filter(task => (task._id || task.id) !== taskId));

              try {
                await api.tasks.deleteTask(taskId);
              } catch (err) {
                // Revert optimistic update on error
                setTasks(originalTasks);

                if (err.status === 429) {
                  setError('Too many requests. Please try again in a moment.');
                } else {
                  setError('Failed to delete task. Please try again.');
                }
                console.error('Error deleting task:', err);
              }
            }
          }
        ]
      );
    } catch (err) {
      setError('Failed to delete task. Please try again.');
      console.error('Error in delete task operation:', err);
    }
  };

  const editTask = async (task) => {
    setIsEditing(true);
    setCurrentTaskId(task._id || task.id);
    setTaskText(task.title || task.text);
    setTaskDescription(task.description || '');
    setCategory(task.category || '');
    setPriority(task.priority || '');
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
  };

  // Fixed toggle with correct API call
  const toggleComplete = async (taskId) => {
    try {
      if (!taskId) {
        console.error('Invalid task ID');
        return;
      }

      // Optimistic update
      const originalTasks = [...tasks];
      setTasks(prevTasks => prevTasks.map(task => {
        if ((task._id || task.id) === taskId) {
          return {
            ...task,
            status: task.status === 'completed' ? 'active' : 'completed'
          };
        }
        return task;
      }));

      try {
        await api.tasks.toggleTaskStatus(taskId);
      } catch (err) {
        // Revert optimistic update on error
        setTasks(originalTasks);

        if (err.status === 429) {
          setError('Too many requests. Please try again in a moment.');
        } else {
          setError('Failed to update task status. Please try again.');
        }
        console.error('Error updating task status:', err);
      }
    } catch (err) {
      setError('Failed to update task status. Please try again.');
      console.error('Error in toggle complete operation:', err);
    }
  };

  // This function is called by TaskKanban when a task is dropped in a new column
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      if (!taskId || !newStatus) {
        console.error('Invalid task ID or status for update', { taskId, newStatus });
        return;
      }

      // Find the original task to prevent issues if state updates haven't propagated yet
      const originalTask = tasks.find(t => (t._id || t.id) === taskId);
      if (!originalTask) {
        console.error('Original task not found for status update:', taskId);
        executeFetch(); // Refresh state as something is inconsistent
        return;
      }

      // API Call
      console.log(`API Call: Updating task ${taskId} to status ${newStatus}`);
      await api.tasks.updateTask(taskId, { status: newStatus });

    } catch (err) {
      // Refresh state on error
      console.error('Error updating task status via API:', err);
      setError(`Failed to update task status. Please refresh.`);
      executeFetch();
    }
  };

  const handleSearch = () => {
    Keyboard.dismiss();
    setPage(1); // Reset to first page when searching
    executeFetch();
  };

  const handleClearFilters = () => {
    setFilter('all');
    setCategory('');
    setPriority('');
    setDueDate('');
    setSearchQuery('');
    setSortBy('createdAt:desc');
    setPage(1);
    setShowFilterModal(false);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDueDate(selectedDate.toISOString().split('T')[0]);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      Alert.alert(
        "Logout",
        "Are you sure you want to logout?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Logout",
            onPress: async () => {
              try {
                await api.auth.logout();
                // Clear any stored tokens/user data
                await AsyncStorage.removeItem('userToken');
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              } catch (err) {
                setError('Logout failed. Please try again.');
                console.error('Logout error:', err);
              }
            }
          }
        ]
      );
    } catch (err) {
      setError('Logout failed. Please try again.');
      console.error('Logout error:', err);
    }
  };

  // Memoize active tasks count to avoid recalculation on every render
  const activeTaskCount = useMemo(() => {
    return tasks.filter(task => task.status !== 'completed').length;
  }, [tasks]);

  // Render Error Message
  const renderError = () => {
    if (!error) return null;
    
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorMessage}>
          <Icon name="exclamation-circle" size={20} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
        <TouchableOpacity 
          style={styles.errorDismiss}
          onPress={() => setError(null)}
        >
          <Text style={styles.errorDismissText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render View Toggle
  const renderViewToggle = () => (
    <View style={styles.viewToggleContainer}>
      <TouchableOpacity
        style={[styles.viewButton, viewMode === 'list' && styles.activeViewButton]}
        onPress={() => setViewMode('list')}
      >
        <Icon name="list" size={16} color={viewMode === 'list' ? colors.white : colors.primary} />
        <Text style={[styles.viewButtonText, viewMode === 'list' && styles.activeViewButtonText]}>
          List
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.viewButton, viewMode === 'kanban' && styles.activeViewButton]}
        onPress={() => setViewMode('kanban')}
      >
        <Icon name="columns" size={16} color={viewMode === 'kanban' ? colors.white : colors.primary} />
        <Text style={[styles.viewButtonText, viewMode === 'kanban' && styles.activeViewButtonText]}>
          Kanban
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Render Task Form
  const renderTaskForm = () => (
    <View style={styles.formCard}>
      <Text style={styles.cardTitle}>
        <Icon name="tasks" size={18} color={colors.text} /> {isEditing ? 'Edit Task' : 'Add New Task'}
      </Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Task Title:</Text>
        <TextInput
          style={styles.input}
          value={taskText}
          onChangeText={setTaskText}
          placeholder="What needs to be done?"
          placeholderTextColor={colors.placeholder}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Description (optional):</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={taskDescription}
          onChangeText={setTaskDescription}
          placeholder="Add details about this task..."
          placeholderTextColor={colors.placeholder}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.formRow}>
        <View style={styles.formGroupHalf}>
          <Text style={styles.label}>
            <Icon name="tag" size={14} color={colors.text} /> Category:
          </Text>
          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Work, Personal"
            placeholderTextColor={colors.placeholder}
          />
        </View>

        <View style={styles.formGroupHalf}>
          <Text style={styles.label}>
            <Icon name="flag" size={14} color={colors.text} /> Priority:
          </Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={priority}
              onValueChange={(itemValue) => setPriority(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Select Priority" value="" />
              <Picker.Item label="Low" value="low" />
              <Picker.Item label="Medium" value="medium" />
              <Picker.Item label="High" value="high" />
            </Picker>
          </View>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>
          <Icon name="calendar" size={14} color={colors.text} /> Due Date (optional):
        </Text>
        <TouchableOpacity 
          style={styles.dateInput}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={dueDate ? styles.dateText : styles.datePlaceholder}>
            {dueDate ? dueDate : 'Select a due date'}
          </Text>
          <Icon name="calendar" size={16} color={colors.primary} />
        </TouchableOpacity>
        
        {showDatePicker && (
          <DateTimePicker
            value={dueDate ? new Date(dueDate) : new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, (!taskText.trim() && styles.disabledButton)]}
          onPress={addTask}
          disabled={!taskText.trim()}
        >
          <Icon name="plus-circle" size={16} color={colors.white} />
          <Text style={styles.buttonText}>
            {isEditing ? 'Update Task' : 'Add Task'}
          </Text>
        </TouchableOpacity>
        
        {isEditing && (
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => {
              setIsEditing(false);
              setTaskText('');
              setTaskDescription('');
              setCategory('');
              setPriority('');
              setDueDate('');
            }}
          >
            <Icon name="times-circle" size={16} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Render Search Bar
  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search tasks..."
          placeholderTextColor={colors.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Icon name="search" size={16} color={colors.white} />
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity 
        style={styles.filterButton}
        onPress={() => setShowFilterModal(true)}
      >
        <Icon name="filter" size={16} color={colors.primary} />
        <Text style={styles.filterButtonText}>Filter</Text>
      </TouchableOpacity>
    </View>
  );

  // Render Filter Modal
  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowFilterModal(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowFilterModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Tasks</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Icon name="times" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Status:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={filter}
                  onValueChange={(itemValue) => setFilter(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="All Tasks" value="all" />
                  <Picker.Item label="Active" value="active" />
                  <Picker.Item label="Completed" value="completed" />
                </Picker>
              </View>
            </View>
            
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Sort By:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={sortBy}
                  onValueChange={(itemValue) => setSortBy(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Newest First" value="createdAt:desc" />
                  <Picker.Item label="Oldest First" value="createdAt:asc" />
                  <Picker.Item label="A-Z" value="title:asc" />
                  <Picker.Item label="Z-A" value="title:desc" />
                  <Picker.Item label="Priority (High-Low)" value="priority:desc" />
                  <Picker.Item label="Priority (Low-High)" value="priority:asc" />
                  <Picker.Item label="Due Date (Earliest)" value="dueDate:asc" />
                  <Picker.Item label="Due Date (Latest)" value="dueDate:desc" />
                </Picker>
              </View>
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleClearFilters}
              >
                <Icon name="times" size={16} color={colors.text} />
                <Text style={styles.secondaryButtonText}>Clear Filters</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={() => {
                  setShowFilterModal(false);
                  executeFetch();
                }}
              >
                <Icon name="check" size={16} color={colors.white} />
                <Text style={styles.buttonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Render Task Stats
  const renderTaskStats = () => (
    <View style={styles.taskStats}>
      <View style={styles.statItem}>
        <Icon name="check-circle" size={14} color={colors.text} />
        <Text style={styles.statText}>{tasks.length} total</Text>
      </View>
      <View style={styles.statItem}>
        <Icon name="clock-o" size={14} color={colors.active} />
        <Text style={styles.statText}>{activeTaskCount} active</Text>
      </View>
      <View style={styles.statItem}>
        <Icon name="check" size={14} color={colors.completed} />
        <Text style={styles.statText}>{tasks.length - activeTaskCount} done</Text>
      </View>
    </View>
  );

  // Render the list view of tasks
  const renderTaskList = () => (
    <View style={styles.listContainer}>
      {renderTaskStats()}
      
      {tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="tasks" size={50} color={colors.lightGray} />
          <Text style={styles.emptyStateText}>No tasks found with the current filters.</Text>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleClearFilters}
          >
            <Icon name="times" size={16} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.taskList}>
          {tasks.map(task => (
            <Task
              key={task._id || task.id}
              task={task}
              onToggle={() => toggleComplete(task._id || task.id)}
              onEdit={() => editTask(task)}
              onDelete={() => deleteTask(task._id || task.id)}
            />
          ))}
        </ScrollView>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[styles.paginationButton, page === 1 && styles.disabledButton]}
            onPress={() => handlePageChange(page - 1)}
            disabled={page === 1}
          >
            <Icon name="chevron-left" size={14} color={page === 1 ? colors.lightGray : colors.text} />
            <Text style={styles.paginationButtonText}>Previous</Text>
          </TouchableOpacity>

          <Text style={styles.paginationInfo}>
            Page {page} of {totalPages}
          </Text>

          <TouchableOpacity
            style={[styles.paginationButton, page === totalPages && styles.disabledButton]}
            onPress={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
          >
            <Text style={styles.paginationButtonText}>Next</Text>
            <Icon name="chevron-right" size={14} color={page === totalPages ? colors.lightGray : colors.text} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Render main content
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading tasks...</Text>
        </View>
      );
    }

    return (
      <>
        {viewMode === 'kanban' ? (
          <View style={styles.kanbanContainer}>
            <TaskKanban
              tasks={tasks}
              onEdit={editTask}
              onDelete={deleteTask}
              onStatusChange={handleStatusChange}
            />
          </View>
        ) : (
          renderTaskList()
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.appTitle}>TaskFlow</Text>
          {userProfile && (
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Icon name="sign-out" size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {renderError()}

        <View style={styles.mainContent}>
          <Text style={styles.pageTitle}>Task Management</Text>
          
          {renderTaskForm()}
          {renderViewToggle()}
          {renderSearchBar()}
          {renderContent()}
        </View>

        {renderFilterModal()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  appTitle: {
    ...typography.heading,
    fontSize: 20,
    color: colors.primary,
  },
  logoutButton: {
    padding: spacing.xs,
  },
  mainContent: {
    flex: 1,
    padding: spacing.md,
  },
  pageTitle: {
    ...typography.title,
    marginBottom: spacing.md,
  },
  errorContainer: {
    backgroundColor: colors.errorBg,
    margin: spacing.sm,
    borderRadius: 8,
    padding: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginLeft: spacing.xs,
    flex: 1,
  },
  errorDismiss: {
    paddingHorizontal: spacing.sm,
  },
  errorDismissText: {
    ...typography.body,
    color: colors.primary,
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    ...typography.subtitle,
    marginBottom: spacing.md,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  formGroupHalf: {
    width: '48%',
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: spacing.sm,
    ...typography.body,
    backgroundColor: colors.inputBg,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.inputBg,
    overflow: 'hidden',
  },
  picker: {
    height: 40,
    color: colors.text,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: spacing.sm,
    backgroundColor: colors.inputBg,
  },
  dateText: {
    ...typography.body,
    color: colors.text,
  },
  datePlaceholder: {
    ...typography.body,
    color: colors.placeholder,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.button,
    color: colors.white,
    marginLeft: spacing.xs,
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.secondary,
  },
  activeViewButton: {
    backgroundColor: colors.primary,
  },
  viewButtonText: {
    ...typography.button,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  activeViewButtonText: {
    ...typography.button,
    color: colors.white,
    marginLeft: spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.inputBg,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text,
  },
  searchButton: {
    padding: spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  filterButtonText: {
    ...typography.body,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: colors.white,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalContent: {
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.subtitle,
  },
  filterGroup: {
    marginBottom: spacing.md,
  },
  filterLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  taskStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    ...typography.body,
    marginLeft: spacing.xs,
  },
  listContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    ...typography.body,
    color: colors.lightGray,
    marginVertical: spacing.md,
  },
  taskList: {
    flex: 1,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
  },
  paginationButtonText: {
    ...typography.body,
    marginHorizontal: spacing.xs,
  },
  paginationInfo: {
    ...typography.body,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.md,
  },
  kanbanContainer: {
    flex: 1,
  },
});

export default TaskScreen;