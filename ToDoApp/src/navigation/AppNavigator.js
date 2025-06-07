// src/navigation/AppNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import TaskScreen from '../screens/TaskScreen';

// Import styles
import colors from '../styles/colors';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/**
 * Stack navigator for tasks-related screens
 */
const TasksStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.primary,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="TasksList" 
        component={HomeScreen} 
        options={{ title: 'My Tasks' }} 
      />
      <Stack.Screen 
        name="TaskDetails" 
        component={TaskScreen} 
        options={({ route }) => ({ 
          title: route.params?.isEditing ? 'Edit Task' : 'Task Details',
        })} 
      />
    </Stack.Navigator>
  );
};

/**
 * Kanban view for tasks
 */
const KanbanStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.primary,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="KanbanBoard" 
        component={HomeScreen} 
        options={{ title: 'Kanban Board' }}
        initialParams={{ viewMode: 'kanban' }}
      />
      <Stack.Screen 
        name="TaskDetails" 
        component={TaskScreen} 
        options={({ route }) => ({ 
          title: route.params?.isEditing ? 'Edit Task' : 'Task Details',
        })} 
      />
    </Stack.Navigator>
  );
};

/**
 * Main application navigator with bottom tabs
 */
const AppNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Tasks') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'Kanban') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mediumGray,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.lightGray,
          paddingTop: 5,
          paddingBottom: 5,
          height: 60,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Tasks" component={TasksStack} />
      <Tab.Screen name="Kanban" component={KanbanStack} />
    </Tab.Navigator>
  );
};

export default AppNavigator;