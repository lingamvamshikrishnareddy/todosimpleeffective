import React, { useState, useEffect, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import Task from '../components/Task';
import { Helmet } from 'react-helmet';
import api from '../services/api';

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
  const history = useHistory();
  
  // Get user profile on component mount
  useEffect(() => {
    const getUserProfile = async () => {
      try {
        const profile = await api.getProfile();
        setUserProfile(profile);
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    };
    
    getUserProfile();
  }, []);
  
  // Convert filter to API status
  const getStatusFromFilter = () => {
    if (filter === 'completed') return 'completed';
    if (filter === 'active') return 'active';
    return '';
  };

  // Fetch tasks with current filters
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.getTasks({
        page,
        limit: 10,
        status: getStatusFromFilter(),
        category: category || undefined,
        search: searchQuery || undefined,
        sortBy,
        priority: priority || undefined,
        dueDate: dueDate || undefined
      });
      
      setTasks(response.tasks);
      setTotalPages(response.pagination.pages);
      setLoading(false);
    } catch (err) {
      setError('Failed to load tasks. Please try again.');
      setLoading(false);
      console.error('Error fetching tasks:', err);
    }
  }, [page, filter, category, searchQuery, sortBy, priority, dueDate]);

  // Load tasks when component mounts or filters change
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = async () => {
    if (taskText.trim() === '') return;
    
    try {
      if (isEditing) {
        // Update existing task
        await api.updateTask(currentTaskId, {
          title: taskText,
          description: taskDescription,
          category,
          priority,
          dueDate: dueDate || undefined
        });
        
        setIsEditing(false);
        setCurrentTaskId(null);
      } else {
        // Add new task
        await api.createTask({
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
      fetchTasks();
    } catch (err) {
      setError('Failed to save task. Please try again.');
      console.error('Error saving task:', err);
    }
  };

  // Fixed: Properly implement delete task functionality
  const deleteTask = async (taskId) => {
    try {
      // Make sure we have a valid taskId
      if (!taskId) {
        console.error('Invalid task ID');
        return;
      }
      
      await api.deleteTask(taskId);
      
      // Update local state to immediately remove the task from UI
      setTasks(prevTasks => prevTasks.filter(task => (task._id || task.id) !== taskId));
      
      // Also refresh from server
      fetchTasks();
    } catch (err) {
      setError('Failed to delete task. Please try again.');
      console.error('Error deleting task:', err);
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

  // Fixed: Properly implement toggle complete functionality
  const toggleComplete = async (taskId) => {
    try {
      // Make sure we have a valid taskId
      if (!taskId) {
        console.error('Invalid task ID');
        return;
      }
      
      await api.toggleTaskStatus(taskId);
      
      // Update local state to immediately reflect the change
      setTasks(prevTasks => prevTasks.map(task => {
        if ((task._id || task.id) === taskId) {
          return {
            ...task,
            status: task.status === 'completed' ? 'active' : 'completed'
          };
        }
        return task;
      }));
      
      // Also refresh from server to ensure all data is in sync
      fetchTasks();
    } catch (err) {
      setError('Failed to update task status. Please try again.');
      console.error('Error updating task status:', err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1); // Reset to first page when searching
    fetchTasks();
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
  
  // Handle logout
  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await api.logout();
      history.push('/login');
    } catch (err) {
      setError('Logout failed. Please try again.');
      console.error('Logout error:', err);
      setLoggingOut(false);
    }
  };

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
          
          {/* User profile and logout section - Improved UI */}
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
        
        {/* Improved Task Form UI */}
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
            <button className="button primary-button" onClick={addTask}>
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
        
        {/* Improved Filters UI */}
        <div className="task-filters-container">
          <div className="task-search">
            <form onSubmit={handleSearch}>
              <div className="search-input-container">
                <i className="fa fa-search search-icon"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="search-input"
                />
                <button type="submit" className="search-button">Search</button>
              </div>
            </form>
          </div>
          
          <div className="filter-controls">
            <div className="task-filter">
              <span className="filter-label">Status: </span>
              <div className="button-group">
                <button 
                  className={`filter-button ${filter === 'all' ? 'active' : ''}`} 
                  onClick={() => setFilter('all')}
                >
                  All
                </button>
                <button 
                  className={`filter-button ${filter === 'active' ? 'active' : ''}`} 
                  onClick={() => setFilter('active')}
                >
                  <i className="fa fa-circle-o"></i> Active
                </button>
                <button 
                  className={`filter-button ${filter === 'completed' ? 'active' : ''}`} 
                  onClick={() => setFilter('completed')}
                >
                  <i className="fa fa-check-circle"></i> Completed
                </button>
              </div>
            </div>
            
            <div className="task-sort">
              <label htmlFor="sortTasks" className="sort-label">
                <i className="fa fa-sort"></i> Sort by:
              </label>
              <select
                id="sortTasks"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="createdAt:desc">Newest First</option>
                <option value="createdAt:asc">Oldest First</option>
                <option value="dueDate:asc">Due Date (Soon First)</option>
                <option value="title:asc">Title (A-Z)</option>
                <option value="priority:desc">Priority (High-Low)</option>
              </select>
            </div>
            
            <button 
              className="clear-filters-button" 
              onClick={handleClearFilters}
            >
              <i className="fa fa-refresh"></i> Clear Filters
            </button>
          </div>
        </div>
        
        {/* Improved Loading and Empty States */}
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading tasks...</p>
          </div>
        ) : (
          <div className="task-list-container">
            {tasks.length > 0 ? (
              <div className="task-list">
                {tasks.map((task) => (
                  <Task 
                    key={task._id || task.id} 
                    task={task} 
                    onDelete={deleteTask} 
                    onEdit={editTask}
                    onToggleComplete={toggleComplete}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <i className="fa fa-clipboard empty-icon"></i>
                <p className="empty-message">No {filter !== 'all' ? filter : ''} tasks found.</p>
                <p className="empty-action">{filter === 'all' ? 'Start by adding a task above!' : 'Try changing your filters or adding a new task.'}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Improved Pagination */}
        {tasks.length > 0 && (
          <div className="pagination">
            <button 
              disabled={page === 1} 
              onClick={() => handlePageChange(page - 1)}
              className="pagination-button"
            >
              <i className="fa fa-chevron-left"></i> Previous
            </button>
            <span className="pagination-info">Page {page} of {totalPages}</span>
            <button 
              disabled={page === totalPages} 
              onClick={() => handlePageChange(page + 1)}
              className="pagination-button"
            >
              Next <i className="fa fa-chevron-right"></i>
            </button>
          </div>
        )}
        
        {/* Task Summary */}
        {tasks.length > 0 && (
          <div className="task-summary">
            <p><i className="fa fa-list-ul"></i> {tasks.filter(task => task.status !== 'completed').length} tasks remaining</p>
          </div>
        )}
      </div>
    </>
  );
};

export default TaskPage;
