// src/App.js
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';

// Import navigation
import Navigation from './navigation';

// Import styles
import colors from './styles/colors';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Mock redux setup (in a real app, you'd have proper reducers and actions)
const initialState = {
  auth: {
    isAuthenticated: false,
    user: null,
    token: null,
  },
  tasks: {
    items: [],
    loading: false,
    error: null,
  },
};

const rootReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        auth: {
          ...state.auth,
          isAuthenticated: true,
          user: action.payload.user,
          token: action.payload.token,
        },
      };
    case 'LOGOUT':
      return {
        ...state,
        auth: {
          isAuthenticated: false,
          user: null,
          token: null,
        },
      };
    case 'FETCH_TASKS_SUCCESS':
      return {
        ...state,
        tasks: {
          ...state.tasks,
          items: action.payload,
          loading: false,
        },
      };
    case 'ADD_TASK':
      return {
        ...state,
        tasks: {
          ...state.tasks,
          items: [...state.tasks.items, action.payload],
        },
      };
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: {
          ...state.tasks,
          items: state.tasks.items.map(task => 
            task.id === action.payload.id ? action.payload : task
          ),
        },
      };
    case 'DELETE_TASK':
      return {
        ...state,
        tasks: {
          ...state.tasks,
          items: state.tasks.items.filter(task => task.id !== action.payload),
        },
      };
    default:
      return state;
  }
};

// Configure Redux Persist
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'tasks'], // What to persist
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Create store with middleware
const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

const persistor = persistStore(store);

/**
 * Root App component
 */
const App = () => {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Load fonts, make API calls, etc.
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <SafeAreaProvider>
          <StatusBar
            backgroundColor={colors.primary}
            barStyle="light-content"
          />
          <Navigation />
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
};

export default App;