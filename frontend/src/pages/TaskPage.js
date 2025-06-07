import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import Task from '../components/Task'; // Assuming path
import TaskKanban from '../components/TaskKanban'; // Assuming path
import { Helmet } from 'react-helmet';
import api from '../services/api'; // Assuming path
import './TaskPage.css'; // Assuming path

const DEBOUNCE_DELAY = 300;
const VALID_TASK_STATUSES_ARRAY = ['active', 'completed', 'archived'];
const DEFAULT_ACTIVE_STATUS = 'active';

const TASK_STATUSES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

const TaskPage = () => {
  const [tasks, setTasks] = useState([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [mainLoading, setMainLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [viewMode, setViewMode] = useState('kanban');
  
  const history = useHistory();
  const debounceTimeoutRef = useRef(null);
  const fetchingGuardRef = useRef(false);

  const parseApiError = (err, defaultMessage = 'An unexpected error occurred.') => {
    let message = defaultMessage;
    let details = '';
    if (err?.status === 429) {
      message = 'Too many requests. Please try again in a moment.';
    } else if (err?.data) {
      message = err.data.message || message;
      details = err.data.detailedMessage || (typeof err.data.error === 'string' ? err.data.error : '');
      if (!details && err.data.error && typeof err.data.error === 'object') {
        details = Object.values(err.data.error).map(e => e.message || e).join('; ');
      }
    } else if (err?.message && !String(err.message).toLowerCase().includes('status code')) {
        message = err.message;
    }
    return { message, details };
  };

  useEffect(() => {
    let isMounted = true;
    const getUserProfile = async () => {
      try {
        const profile = await api.user.getProfile();
        if (isMounted) setUserProfile(profile);
      } catch (err) {
        console.error('Error fetching user profile:', err);
        if (isMounted && (err?.status === 401 || err?.message?.includes('unauthorized'))) {
          history.push('/login');
        }
      }
    };
    getUserProfile();
    return () => { isMounted = false; };
  }, [history]);

  const getStatusQueryParam = useCallback(() => {
    if (filter === 'completed') return 'completed';
    if (filter === 'active') return 'active';
    return '';
  }, [filter]);

  // Filter tasks based on search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    
    const query = searchQuery.toLowerCase().trim();
    return tasks.filter(task => 
      task.title?.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query) ||
      task.category?.toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

  const queryParams = useMemo(() => ({
    page: viewMode === 'list' ? page : 1,
    limit: viewMode === 'kanban' ? 100 : 10,
    status: getStatusQueryParam(),
    category: category || undefined,
    sortBy,
    priority: priority || undefined,
    dueDate: dueDate || undefined,
  }), [page, viewMode, getStatusQueryParam, category, sortBy, priority, dueDate]);

  const executeFetch = useCallback(async (showMainLoadingSpinner = true) => {
    if (fetchingGuardRef.current) return;

    fetchingGuardRef.current = true;
    setIsFetching(true);
    if (showMainLoadingSpinner) setMainLoading(true);
    setError(null);

    try {
      const response = await api.tasks.getTasks(queryParams);
      setTasks(response.tasks || []);
      if (viewMode === 'list') {
        setTotalPages(response.pagination?.pages || 1);
        if (page > (response.pagination?.pages || 1) && (response.pagination?.pages || 1) > 0) {
            setPage(response.pagination.pages);
        }
      } else {
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      const parsedError = parseApiError(err, 'Failed to load tasks.');
      if (err?.status === 401) history.push('/login');
      else setError(parsedError);
    } finally {
      if (showMainLoadingSpinner) setMainLoading(false);
      setIsFetching(false);
      fetchingGuardRef.current = false;
    }
  }, [queryParams, history, viewMode, page]);

  // Debounced search effect
  useEffect(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      if (searchQuery.trim()) {
        // For search, we work with local filtering instead of API call
        return;
      }
      executeFetch(true);
    }, DEBOUNCE_DELAY);
    return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current); };
  }, [executeFetch, searchQuery]);

  // Initial fetch and filter changes
  useEffect(() => {
    executeFetch(true);
  }, [filter, category, priority, dueDate, sortBy, page, viewMode]);

  const resetForm = useCallback(() => {
    setTaskTitle('');
    setTaskDescription('');
    setIsEditing(false);
    setCurrentTaskId(null);
  }, []);
  
  const clearFullForm = useCallback(() => {
    setTaskTitle('');
    setTaskDescription('');
    setCategory(''); 
    setPriority('');
    setDueDate('');
    setIsEditing(false);
    setCurrentTaskId(null);
  }, []);

  const handleAddTask = async () => {
    if (taskTitle.trim() === '') {
      setError({ message: "Task title cannot be empty." });
      return;
    }
    setIsSubmitting(true);
    setError(null);
    
    const taskPayload = {
      title: taskTitle,
      description: taskDescription,
      category: category || undefined,
      priority: priority || undefined,
      dueDate: dueDate || undefined,
    };

    try {
      if (isEditing && currentTaskId) {
        const response = await api.tasks.updateTask(currentTaskId, taskPayload);
        setTasks(prevTasks => prevTasks.map(t => (t._id || t.id) === currentTaskId ? response.task : t));
      } else {
        const response = await api.tasks.createTask(taskPayload);
        setTasks(prevTasks => [response.task, ...prevTasks]);
      }
      clearFullForm();
    } catch (err) {
      console.error('Error saving task:', err);
      setError(parseApiError(err, `Failed to ${isEditing ? 'update' : 'create'} task.`));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!taskId) return;
    
    const originalTasks = [...tasks];
    setTasks(prevTasks => prevTasks.filter(task => (task._id || task.id) !== taskId));
    setError(null);

    try {
      await api.tasks.deleteTask(taskId);
    } catch (err) {
      console.error('Error deleting task:', err);
      setTasks(originalTasks);
      setError(parseApiError(err, 'Failed to delete task.'));
    }
  };

  const handleEditTask = (task) => {
    setIsEditing(true);
    setCurrentTaskId(task._id || task.id);
    setTaskTitle(task.title || '');
    setTaskDescription(task.description || '');
    setCategory(task.category || '');
    setPriority(task.priority || '');
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleComplete = async (taskId) => {
    if (!taskId) return;
    
    const originalTasks = [...tasks];
    let updatedTaskData = null;

    setTasks(prevTasks =>
      prevTasks.map(task => {
        if ((task._id || task.id) === taskId) {
          const newStatus = task.status === TASK_STATUSES.COMPLETED ? DEFAULT_ACTIVE_STATUS : TASK_STATUSES.COMPLETED;
          updatedTaskData = { 
            ...task, 
            status: newStatus,
            completedAt: newStatus === TASK_STATUSES.COMPLETED ? new Date().toISOString() : null 
          };
          return updatedTaskData;
        }
        return task;
      })
    );
    setError(null);

    try {
      const response = await api.tasks.toggleTaskStatus(taskId);
      setTasks(prevTasks => prevTasks.map(t => (t._id || t.id) === taskId ? response.task : t));
    } catch (err) {
      console.error('Error toggling task status:', err);
      setTasks(originalTasks);
      setError(parseApiError(err, 'Failed to update task status.'));
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    if (!taskId || !VALID_TASK_STATUSES_ARRAY.includes(newStatus)) {
      setError({ message: 'Invalid data for status update.' });
      return;
    }

    const originalTasks = [...tasks];
    const taskToUpdateOriginal = originalTasks.find(t => (t._id || t.id) === taskId);
    if (!taskToUpdateOriginal) return;

    setTasks(prevTasks =>
      prevTasks.map(task =>
        (task._id || task.id) === taskId 
        ? { ...task, 
            status: newStatus,
            completedAt: newStatus === TASK_STATUSES.COMPLETED ? new Date().toISOString() : (taskToUpdateOriginal.status === TASK_STATUSES.COMPLETED ? null : task.completedAt)
          } 
        : task
      )
    );
    setError(null);

    try {
      const response = await api.tasks.updateTask(taskId, { status: newStatus });
      setTasks(prevTasks => prevTasks.map(t => (t._id || t.id) === taskId ? response.task : t));
    } catch (err) {
      console.error(`Error updating task ${taskId} to status ${newStatus}:`, err);
      setTasks(originalTasks);
      setError(parseApiError(err, `Failed to update status for task "${taskToUpdateOriginal.title || taskId}".`));
    }
  };
  
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    // Search is now handled by local filtering
  };

  const handleClearFiltersAndSearch = () => {
    setFilter('all');
    setSearchQuery('');
    setSortBy('createdAt:desc');
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page && viewMode === 'list') {
      setPage(newPage);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setError(null);
    try {
      await api.auth.logout();
      history.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      setError(parseApiError(err, 'Logout failed.'));
      setLoggingOut(false);
    }
  };
  
  const activeTaskCount = useMemo(() => {
    return filteredTasks.filter(task => ![TASK_STATUSES.COMPLETED, TASK_STATUSES.ARCHIVED].includes(task.status)).length;
  }, [filteredTasks]);
  
  const completedTaskCount = useMemo(() => {
    return filteredTasks.filter(task => task.status === TASK_STATUSES.COMPLETED).length;
  }, [filteredTasks]);

  useEffect(() => {
    if (viewMode === 'kanban') {
        setPage(1);
    }
  }, [viewMode, filter, searchQuery, category, priority, dueDate]);

  return (
    <>
      <Helmet>
        <title>{`TaskFlow - ${isEditing ? 'Edit Task' : (taskTitle || 'Manage Tasks')}`}</title>
        <meta name="description" content="Create, organize, and track your tasks efficiently with TaskFlow." />
      </Helmet>

      <div className="container task-page-container">
        <header className="header task-header">
          <div className="logo-section">
            <h1 className="app-logo">TaskFlow</h1>
          </div>
          {userProfile && (
            <div className="user-controls">
              <div className="user-info">
                <span className="welcome-text">Welcome, {userProfile.name || 'User'}</span>
                <div className="user-actions">
                  <button className="logout-button" onClick={handleLogout} disabled={loggingOut || isSubmitting}>
                    <i className={`fa ${loggingOut ? 'fa-spinner fa-spin' : 'fa-sign-out'}`}></i> {loggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </header>

        <main className="content-area">
          <h1 className="page-title visually-hidden">Task Management</h1>

          {error && (
            <div className="error-message global-error">
              <div>
                <p><i className="fa fa-exclamation-circle"></i> {error.message}</p>
                {error.details && <small className="error-details">{error.details}</small>}
              </div>
              <button onClick={() => setError(null)} aria-label="Dismiss error message">×</button>
            </div>
          )}

          <section className="card task-form-card" aria-labelledby="task-form-title">
            <h2 id="task-form-title" className="card-title">
              <i className="fa fa-pencil-square-o"></i> {isEditing ? 'Edit Task' : 'Add New Task'}
            </h2>
            <form onSubmit={(e) => { e.preventDefault(); handleAddTask(); }}>
              <div className="form-group">
                <label htmlFor="taskTitle">Task Title <span aria-hidden="true">*</span>:</label>
                <input
                  id="taskTitle" type="text" value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g., Finish project report" className="form-input" required
                  aria-required="true"
                />
              </div>
              <div className="form-group">
                <label htmlFor="taskDescription">Description:</label>
                <textarea
                  id="taskDescription" value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Add more details..." className="form-textarea" rows="3"
                />
              </div>
              <div className="form-row">
                <div className="form-group half-width">
                  <label htmlFor="taskCategory"><i className="fa fa-tag" aria-hidden="true"></i> Category:</label>
                  <input
                    id="taskCategory" type="text" value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., Work, Personal" className="form-input"
                  />
                </div>
                <div className="form-group half-width">
                  <label htmlFor="taskPriority"><i className="fa fa-flag" aria-hidden="true"></i> Priority:</label>
                  <select
                    id="taskPriority" value={priority}
                    onChange={(e) => setPriority(e.target.value)} className="form-select"
                  >
                    <option value="">Default (Medium)</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="taskDueDate"><i className="fa fa-calendar" aria-hidden="true"></i> Due Date:</label>
                <input
                  id="taskDueDate" type="date" value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)} className="form-input"
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="button-row">
                <button
                  type="submit" className="button primary-button"
                  disabled={isSubmitting || !taskTitle.trim()}
                >
                  <i className={`fa ${isSubmitting ? 'fa-spinner fa-spin' : (isEditing ? 'fa-save' : 'fa-plus-circle')}`}></i>
                  {isSubmitting ? (isEditing ? 'Updating...' : 'Adding...') : (isEditing ? 'Update Task' : 'Add Task')}
                </button>
                {isEditing && (
                  <button type="button" className="button secondary-button" onClick={clearFullForm} disabled={isSubmitting}>
                    <i className="fa fa-times-circle"></i> Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="view-toggle-container card" aria-label="View mode and filters">
            <div className="view-toggle">
              <button
                className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                disabled={isFetching || mainLoading}
                aria-pressed={viewMode === 'list'}
              >
                <i className="fa fa-list"></i> List View
              </button>
              <button
                className={`view-button ${viewMode === 'kanban' ? 'active' : ''}`}
                onClick={() => setViewMode('kanban')}
                disabled={isFetching || mainLoading}
                aria-pressed={viewMode === 'kanban'}
              >
                <i className="fa fa-columns"></i> Kanban View
              </button>
            </div>
            
            <div className="filter-controls">
              <form onSubmit={handleSearchSubmit} className="search-form" role="search">
                <div className="search-input-wrapper">
                  <label htmlFor="searchQueryInput" className="visually-hidden">Search tasks</label>
                  <input
                    id="searchQueryInput" 
                    type="search" 
                    placeholder="Search tasks by title, description, or category..."
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-input search-input"
                  />
                  <button type="submit" className="search-button" disabled={isFetching || mainLoading} aria-label="Submit search">
                    <i className="fa fa-search"></i>
                  </button>
                </div>
              </form>
              <div className="advanced-filters">
                <div className="filter-group">
                  <label htmlFor="filterStatus">Filter by Status:</label>
                  <select
                    id="filterStatus" value={filter}
                    onChange={(e) => { setFilter(e.target.value); setPage(1);}}
                    className="form-select filter-select"
                    disabled={isFetching || mainLoading}
                  >
                    <option value="all">All Tasks</option>
                    <option value="active">Active Tasks</option>
                    <option value="completed">Completed Tasks</option>
                  </select>
                </div>
               {viewMode === 'list' && (
                <div className="filter-group">
                    <label htmlFor="filterSort">Sort By:</label>
                    <select
                        id="filterSort" value={sortBy}
                        onChange={(e) => { setSortBy(e.target.value); setPage(1);}}
                        className="form-select filter-select"
                        disabled={isFetching || mainLoading}
                    >
                        <option value="createdAt:desc">Newest First</option>
                        <option value="createdAt:asc">Oldest First</option>
                        <option value="title:asc">Title (A-Z)</option>
                        <option value="title:desc">Title (Z-A)</option>
                        <option value="priority:desc">Priority (High-Low)</option>
                        <option value="priority:asc">Priority (Low-High)</option>
                        <option value="dueDate:asc">Due Date (Earliest)</option>
                        <option value="dueDate:desc">Due Date (Latest)</option>
                    </select>
                </div>
                )}
                <button className="button-link clear-filters-button" onClick={handleClearFiltersAndSearch} disabled={isFetching || mainLoading}>
                  <i className="fa fa-times"></i> Clear Search & Filters
                </button>
              </div>
            </div>
          </section>

          <div className="task-content-container">
            {mainLoading ? (
              <div className="loading-container main-loader">
                <div className="loading-spinner">
                  <i className="fa fa-spinner fa-spin fa-3x"></i>
                  <p>Loading tasks...</p>
                </div>
              </div>
            ) : (
              <>
                {viewMode === 'kanban' ? (
                  <div className="kanban-container">
                    <TaskKanban
                      tasks={filteredTasks}
                      onEdit={handleEditTask}
                      onDelete={handleDeleteTask}
                      onStatusChange={handleStatusChange}
                      onToggleComplete={handleToggleComplete}
                      columnOrder={[TASK_STATUSES.ACTIVE, TASK_STATUSES.COMPLETED]}
                      isLoading={isFetching}
                    />
                  </div>
                ) : (
                  <div className="list-container">
                    <div className="task-stats">
                      <span className="task-count total">
                        <i className="fa fa-th-list"></i> {filteredTasks.length} tasks displayed
                      </span>
                      <span className="task-count active">
                        <i className="fa fa-clock-o"></i> {activeTaskCount} active
                      </span>
                      <span className="task-count completed">
                        <i className="fa fa-check-square-o"></i> {completedTaskCount} completed
                      </span>
                    </div>
                    {filteredTasks.length === 0 ? (
                       <div className="empty-state">
                         <i className="fa fa-folder-open-o empty-icon fa-3x"></i>
                         <p>{searchQuery || filter !== 'all' ? 'No tasks match your current filters.' : 'No tasks yet. Add one above to get started!'}</p>
                         {(searchQuery || filter !== 'all') && (
                            <button className="button secondary-button" onClick={handleClearFiltersAndSearch}>
                                Clear Filters & Search
                            </button>
                         )}
                       </div>
                     ) : (
                        <ul className="task-list">
                            {filteredTasks.map(task => (
                            <Task
                                key={task._id || task.id}
                                task={task}
                                onToggleComplete={() => handleToggleComplete(task._id || task.id)}
                                onEdit={() => handleEditTask(task)}
                                onDelete={() => handleDeleteTask(task._id || task.id)}
                            />
                            ))}
                        </ul>
                    )}
                    {totalPages > 1 && viewMode === 'list' && (
                      <nav className="pagination" aria-label="Task list navigation">
                        <button
                          className="pagination-button prev"
                          onClick={() => handlePageChange(page - 1)}
                          disabled={page === 1 || isFetching}
                          aria-label="Go to previous page"
                        >
                          <i className="fa fa-chevron-left"></i> Previous
                        </button>
                        <div className="pagination-info" aria-live="polite" aria-atomic="true">Page {page} of {totalPages}</div>
                        <button
                          className="pagination-button next"
                          onClick={() => handlePageChange(page + 1)}
                          disabled={page === totalPages || isFetching}
                          aria-label="Go to next page"
                        >
                          Next <i className="fa fa-chevron-right"></i>
                        </button>
                      </nav>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        <footer className="app-footer">
          <p>© {new Date().getFullYear()} TaskFlow App. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
};

export default TaskPage;
