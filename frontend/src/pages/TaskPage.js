import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import Task from '../components/Task';
import TaskKanban from '../components/TaskKanban';
import { Helmet } from 'react-helmet';
import api from '../services/api';
import './TaskPage.css';

// Number of ms to debounce task fetching
const DEBOUNCE_DELAY = 300;

const TaskPage = () => {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt:desc');
  const [userProfile, setUserProfile] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [viewMode, setViewMode] = useState('kanban'); // default to kanban
  const history = useHistory();

  // Create a stable reference for the timeout
  const timeoutRef = useRef(null);

  // Get user profile on component mount with error handling
  useEffect(() => {
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
          history.push('/login');
        }
      }
    };

    getUserProfile();

    return () => {
      isMounted = false;
    };
  }, [history]);

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
        history.push('/login');
      } else {
        setError('Failed to load tasks. Please try again.');
      }
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }, [queryParams, history, isFetching]);

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

  // New function to handle status change from kanban board
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      if (!taskId) {
        console.error('Invalid task ID');
        return;
      }

      // Optimistic update already handled by the Kanban component
      try {
        await api.tasks.updateTask(taskId, { status: newStatus });
      } catch (err) {
        // We need to refresh to get the correct state if the API call fails
        executeFetch();

        if (err.status === 429) {
          setError('Too many requests. Please try again in a moment.');
        } else {
          setError('Failed to update task status. Please try again.');
        }
        console.error('Error updating task status:', err);
      }
    } catch (err) {
      setError('Failed to update task status. Please try again.');
      console.error('Error in status change operation:', err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
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
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  // Fixed logout with correct API call
  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await api.auth.logout();
      history.push('/login');
    } catch (err) {
      setError('Logout failed. Please try again.');
      console.error('Logout error:', err);
      setLoggingOut(false);
    }
  };

  // Memoize active tasks count to avoid recalculation on every render
  const activeTaskCount = useMemo(() => {
    return tasks.filter(task => task.status !== 'completed').length;
  }, [tasks]);

  return (
    <>
      <Helmet>
        <title>TaskFlow - Manage Your Tasks</title>
        <meta name="description" content="Create, organize, and track your tasks efficiently with TaskFlow." />
      </Helmet>

      <div className="container">
        <div className="header task-header">
          <div className="logo-section">
            <h1 className="app-logo">TaskFlow</h1>
          </div>

          {/* User profile and logout section */}
          <div className="user-controls">
            {userProfile && (
              <div className="user-info">
                <span className="welcome-text">Welcome, {userProfile.name}</span>
                <div className="user-actions">
                  <a href="/profile" className="profile-link">
                    <i className="fa fa-user-circle"></i> My Profile
                  </a>
                  <button
                    className="logout-button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    <i className="fa fa-sign-out"></i> {loggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <h1 className="page-title">Task Management</h1>

        {error && (
          <div className="error-message">
            <p><i className="fa fa-exclamation-circle"></i> {error}</p>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* Task Form */}
        <div className="card task-form-card">
          <h2 className="card-title">
            <i className="fa fa-tasks"></i> {isEditing ? 'Edit Task' : 'Add New Task'}
          </h2>
          <div className="form-group">
            <label htmlFor="taskTitle">Task Title:</label>
            <input
              id="taskTitle"
              type="text"
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              placeholder="What needs to be done?"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="taskDescription">Description (optional):</label>
            <textarea
              id="taskDescription"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Add details about this task..."
              className="form-textarea"
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group half-width">
              <label htmlFor="taskCategory">
                <i className="fa fa-tag"></i> Category:
              </label>
              <input
                id="taskCategory"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Work, Personal"
                className="form-input"
              />
            </div>

            <div className="form-group half-width">
              <label htmlFor="taskPriority">
                <i className="fa fa-flag"></i> Priority:
              </label>
              <select
                id="taskPriority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="form-select"
              >
                <option value="">Select Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="taskDueDate">
              <i className="fa fa-calendar"></i> Due Date (optional):
            </label>
            <input
              id="taskDueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="button-group">
            <button
              className="button primary-button"
              onClick={addTask}
              disabled={!taskText.trim()}
            >
              <i className="fa fa-plus-circle"></i> {isEditing ? 'Update Task' : 'Add Task'}
            </button>
            {isEditing && (
              <button
                className="button secondary-button"
                onClick={() => {
                  setIsEditing(false);
                  setTaskText('');
                  setTaskDescription('');
                  setCategory('');
                  setPriority('');
                  setDueDate('');
                }}
              >
                <i className="fa fa-times-circle"></i> Cancel
              </button>
            )}
          </div>
        </div>

        {/* View Toggle */}
        <div className="view-toggle">
          <button 
            className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <i className="fa fa-list"></i> List View
          </button>
          <button 
            className={`view-button ${viewMode === 'kanban' ? 'active' : ''}`}
            onClick={() => setViewMode('kanban')}
          >
            <i className="fa fa-columns"></i> Kanban View
          </button>
        </div>

        {/* Search and Filter Controls */}
        <div className="card filter-card">
          <div className="filter-controls">
            <form onSubmit={handleSearch} className="search-form">
              <div className="form-group search-group">
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input search-input"
                />
                <button type="submit" className="search-button">
                  <i className="fa fa-search"></i>
                </button>
              </div>
            </form>

            <div className="filter-options">
              <div className="filter-group">
                <label htmlFor="filterStatus">Status:</label>
                <select
                  id="filterStatus"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="form-select filter-select"
                >
                  <option value="all">All Tasks</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="filterSort">Sort By:</label>
                <select
                  id="filterSort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="form-select filter-select"
                >
                  <option value="createdAt:desc">Newest First</option>
                  <option value="createdAt:asc">Oldest First</option>
                  <option value="title:asc">A-Z</option>
                  <option value="title:desc">Z-A</option>
                  <option value="priority:desc">Priority (High-Low)</option>
                  <option value="priority:asc">Priority (Low-High)</option>
                  <option value="dueDate:asc">Due Date (Earliest)</option>
                  <option value="dueDate:desc">Due Date (Latest)</option>
                </select>
              </div>

              <button
                className="clear-filters-button"
                onClick={handleClearFilters}
              >
                <i className="fa fa-times"></i> Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Task Content */}
        <div className="task-content">
          {loading ? (
            <div className="loading-spinner">
              <i className="fa fa-spinner fa-spin"></i>
              <p>Loading tasks...</p>
            </div>
          ) : (
            <>
              {viewMode === 'kanban' ? (
                <TaskKanban 
                  tasks={tasks} 
                  onEdit={editTask} 
                  onDelete={deleteTask}
                  onStatusChange={handleStatusChange}
                />
              ) : (
                <>
                  <div className="task-stats">
                    <span className="task-count">
                      <i className="fa fa-check-circle"></i> {tasks.length} tasks total
                    </span>
                    <span className="task-count active">
                      <i className="fa fa-clock-o"></i> {activeTaskCount} active
                    </span>
                    <span className="task-count completed">
                      <i className="fa fa-check"></i> {tasks.length - activeTaskCount} completed
                    </span>
                  </div>

                  <div className="task-list">
                    {tasks.length === 0 ? (
                      <div className="empty-state">
                        <i className="fa fa-tasks empty-icon"></i>
                        <p>No tasks found with the current filters.</p>
                        <button
                          className="button secondary-button"
                          onClick={handleClearFilters}
                        >
                          Clear Filters
                        </button>
                      </div>
                    ) : (
                      tasks.map(task => (
                        <Task
                          key={task._id || task.id}
                          task={task}
                          onToggle={() => toggleComplete(task._id || task.id)}
                          onEdit={() => editTask(task)}
                          onDelete={() => deleteTask(task._id || task.id)}
                        />
                      ))
                    )}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="pagination">
                      <button
                        className="pagination-button"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1}
                      >
                        <i className="fa fa-chevron-left"></i> Previous
                      </button>
                      
                      <div className="pagination-info">
                        Page {page} of {totalPages}
                      </div>
                      
                      <button
                        className="pagination-button"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === totalPages}
                      >
                        Next <i className="fa fa-chevron-right"></i>
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Quick help section */}
        <div className="quick-help-section">
          <div className="card help-card">
            <h3 className="help-title"><i className="fa fa-lightbulb-o"></i> Tips</h3>
            <ul className="help-list">
              <li>Use the Kanban view to drag-and-drop tasks between states</li>
              <li>Set priorities and due dates to keep track of important tasks</li>
              <li>Use categories to organize your tasks by project or area</li>
              <li>Search for specific tasks using the search bar</li>
            </ul>
          </div>
        </div>

        <footer className="app-footer">
          <p>&copy; {new Date().getFullYear()} TaskFlow App. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
};

export default TaskPage;
