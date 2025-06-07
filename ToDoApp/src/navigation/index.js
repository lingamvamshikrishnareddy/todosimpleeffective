// src/navigation/index.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import AppNavigator from './AppNavigator';
import AuthNavigator from './AuthNavigator';

/**
 * Root navigation component that handles authentication state
 * and renders either the auth flow or main app flow
 */
const Navigation = () => {
  // This would typically come from Redux or another state management solution
  const isAuthenticated = useSelector(state => state.auth?.isAuthenticated) || false;
  
  return (
    <NavigationContainer>
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export { AppNavigator, AuthNavigator };
export default Navigation;