// src/styles/spacing.js
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Base spacing unit
const baseUnit = 8;

export default {
  // Basic spacing increments (in pixels)
  tiny: baseUnit / 2, // 4
  small: baseUnit, // 8
  medium: baseUnit * 2, // 16
  large: baseUnit * 3, // 24
  xlarge: baseUnit * 4, // 32
  xxlarge: baseUnit * 6, // 48
  
  // Screen dimensions
  screenWidth: width,
  screenHeight: height,
  
  // Container padding
  containerPadding: baseUnit * 2, // 16
  
  // Common component spacing
  cardPadding: baseUnit * 2, // 16
  cardMargin: baseUnit, // 8
  buttonPadding: baseUnit * 1.5, // 12
  
  // Form elements
  inputHeight: baseUnit * 6, // 48
  inputPadding: baseUnit * 1.5, // 12
  inputMargin: baseUnit, // 8
  
  // Header and footer heights
  headerHeight: baseUnit * 7, // 56
  footerHeight: baseUnit * 8, // 64
  
  // Border related
  borderRadius: {
    small: baseUnit / 2, // 4
    medium: baseUnit, // 8
    large: baseUnit * 2, // 16
    circular: 999, // For circular elements
  },
  borderWidth: {
    thin: 1,
    medium: 2,
    thick: 3,
  },
  
  // Shadow settings
  shadowOffset: {
    width: 0,
    height: baseUnit / 4, // 2
  },
  
  // Component specific
  taskCardHeight: baseUnit * 10, // 80
  kanbanColumnWidth: width * 0.8, // 80% of screen width
};