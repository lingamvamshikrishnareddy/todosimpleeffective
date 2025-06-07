// src/styles/typography.js
import { Platform } from 'react-native';
import colors from './colors';

// Font families
const fontFamily = {
  regular: Platform.OS === 'ios' ? 'System' : 'Roboto',
  medium: Platform.OS === 'ios' ? 'System' : 'Roboto_Medium',
  bold: Platform.OS === 'ios' ? 'System' : 'Roboto_Bold',
};

// Font weights
const fontWeight = {
  regular: '400',
  medium: '600',
  bold: '700',
};

// Font sizes
const fontSize = {
  tiny: 10,
  small: 12,
  regular: 14,
  medium: 16,
  large: 18,
  xlarge: 20,
  xxlarge: 24,
  xxxlarge: 32,
};

// Line heights
const lineHeight = {
  tiny: 14,
  small: 18,
  regular: 20,
  medium: 24,
  large: 26,
  xlarge: 28,
  xxlarge: 32,
  xxxlarge: 40,
};

// Text styles
const text = {
  h1: {
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.xxxlarge,
    lineHeight: lineHeight.xxxlarge,
    color: colors.textPrimary,
  },
  h2: {
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.xxlarge,
    lineHeight: lineHeight.xxlarge,
    color: colors.textPrimary,
  },
  h3: {
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.xlarge,
    lineHeight: lineHeight.xlarge,
    color: colors.textPrimary,
  },
  h4: {
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.large,
    lineHeight: lineHeight.large,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.medium,
    lineHeight: lineHeight.medium,
    color: colors.textSecondary,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontWeight: fontWeight.regular,
    fontSize: fontSize.regular,
    lineHeight: lineHeight.regular,
    color: colors.textPrimary,
  },
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontWeight: fontWeight.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight.small,
    color: colors.textPrimary,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontWeight: fontWeight.regular,
    fontSize: fontSize.small,
    lineHeight: lineHeight.small,
    color: colors.textMuted,
  },
  button: {
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.medium,
    lineHeight: lineHeight.medium,
    color: colors.white,
    textTransform: 'uppercase',
  },
  buttonSmall: {
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.small,
    lineHeight: lineHeight.small,
    color: colors.white,
    textTransform: 'uppercase',
  },
  label: {
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.small,
    lineHeight: lineHeight.small,
    color: colors.textSecondary,
  },
  link: {
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    fontSize: fontSize.regular,
    lineHeight: lineHeight.regular,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
};

export default {
  fontFamily,
  fontWeight,
  fontSize,
  lineHeight,
  text,
};