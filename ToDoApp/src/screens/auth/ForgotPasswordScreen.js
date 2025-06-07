import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../../services/api';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import Icon from 'react-native-vector-icons/FontAwesome';

// Define support email centrally
const SUPPORT_EMAIL = 'lingamvamshikrishnareddy@gmail.com';

// Helper component for the support link
const ContactSupportLink = () => (
  <Text style={styles.supportText}>
    Having trouble?{' '}
    <Text
      style={styles.linkText}
      onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
    >
      Contact Support
    </Text>
  </Text>
);

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(null); // null: initial, true: valid, false: invalid
  const [validating, setValidating] = useState(false);

  const navigation = useNavigation();
  const route = useRoute();

  // Get token if it exists in params
  const token = route.params?.token;

  // Determine which view to show based on token presence
  const isResetView = !!token;

  // Validate token when entering reset view
  useEffect(() => {
    if (isResetView) {
      const validateToken = async () => {
        setValidating(true);
        setError(null);
        setTokenValid(null);

        try {
          // Assume api.validateResetToken throws an error for invalid tokens
          await api.validateResetToken(token);
          setTokenValid(true);
        } catch (err) {
          console.error('Token validation error:', err);
          setTokenValid(false);
          setError(err.response?.data?.message || err.message || 'This password reset link is invalid or has expired.');
        } finally {
          setValidating(false);
        }
      };

      validateToken();
    } else {
      setValidating(false);
      setTokenValid(null);
    }
  }, [token, isResetView]);

  const handleForgotSubmit = async () => {
    setError(null);
    setSuccess(false);
    setLoading(true);

    if (!email.trim()) {
      setError('Email is required');
      setLoading(false);
      return;
    }

    try {
      await api.forgotPassword({ email });
      setSuccess(true);
      setEmail('');
    } catch (err) {
      console.error('Forgot password error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to process your request. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async () => {
    setError(null);
    setSuccess(false);
    setLoading(true);

    // Client-side validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await api.resetPassword({ token, password });
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');

      // Navigate to login after a delay
      setTimeout(() => {
        navigation.navigate('Login');
      }, 3000);

    } catch (err) {
      console.error('Reset password error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to reset password. Please try again.';
      setError(errorMessage);

      // Check if the error indicates the token is now invalid
      if (err.response?.status === 400 || err.message.toLowerCase().includes('token')) {
        setTokenValid(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // Loading state while validating token
  if (isResetView && validating) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>Reset Password</Text>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Validating your password reset link...</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Error view if token is invalid
  if (isResetView && tokenValid === false && !validating) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>Reset Password</Text>
            {error && (
              <View style={styles.alertDanger}>
                <Text style={styles.alertText}>{error}</Text>
              </View>
            )}
            <View style={styles.authFooter}>
              <Text style={styles.footerText}>
                Need to reset your password again?{' '}
                <Text
                  style={styles.linkText}
                  onPress={() => navigation.navigate('ForgotPassword')}
                >
                  Request a new link
                </Text>
              </Text>
              <ContactSupportLink />
              <Text style={styles.footerText}>
                Or return to{' '}
                <Text
                  style={styles.linkText}
                  onPress={() => navigation.navigate('Login')}
                >
                  Login
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>
              {isResetView ? 'Set New Password' : 'Forgot Password'}
            </Text>

            {/* Error Display */}
            {error && !success && (
              <View style={styles.alertDanger}>
                <Text style={styles.alertText}>{error}</Text>
                <TouchableOpacity onPress={() => setError(null)}>
                  <Icon name="times" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}

            {/* Success Message */}
            {success ? (
              <View style={styles.successContainer}>
                <View style={styles.alertSuccess}>
                  <Text style={styles.alertText}>
                    {isResetView
                      ? '✅ Your password has been successfully reset!'
                      : `✅ Password reset instructions sent! Please check your email (${email || 'provided address'}) and follow the link to reset your password.`
                    }
                  </Text>
                </View>
                {isResetView && (
                  <Text style={styles.redirectText}>Redirecting to login page shortly...</Text>
                )}
                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.buttonText}>Return to Login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Conditional Form Rendering */}
                {isResetView && tokenValid === true ? (
                  // Reset Password Form
                  <View>
                    <Text style={styles.label}>New Password</Text>
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      placeholder="Enter new password"
                    />
                    <Text style={styles.label}>Confirm New Password</Text>
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      placeholder="Confirm new password"
                    />
                    <TouchableOpacity
                      style={styles.submitButton}
                      onPress={handleResetSubmit}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.buttonText}>Reset Password</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Forgot Password Form
                  <View>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholder="Enter your email address"
                    />
                    <TouchableOpacity
                      style={styles.submitButton}
                      onPress={handleForgotSubmit}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.buttonText}>Send Reset Instructions</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.medium,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  authCard: {
    backgroundColor: colors.white,
    padding: spacing.large,
    borderRadius: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  authTitle: {
    fontSize: typography.large,
    fontWeight: 'bold',
    marginBottom: spacing.medium,
    textAlign: 'center',
  },
  label: {
    fontSize: typography.medium,
    marginBottom: spacing.small,
  },
  input: {
    height: 40,
    borderColor: colors.gray,
    borderWidth: 1,
    borderRadius: 4,
    marginBottom: spacing.medium,
    paddingHorizontal: spacing.small,
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: spacing.medium,
    borderRadius: 4,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.medium,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: spacing.large,
  },
  loadingText: {
    marginTop: spacing.small,
    fontSize: typography.medium,
    color: colors.gray,
  },
  alertDanger: {
    backgroundColor: colors.errorLight,
    padding: spacing.medium,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium,
  },
  alertSuccess: {
    backgroundColor: colors.successLight,
    padding: spacing.medium,
    borderRadius: 4,
    marginBottom: spacing.medium,
  },
  alertText: {
    fontSize: typography.medium,
    color: colors.error,
  },
  successContainer: {
    alignItems: 'center',
  },
  redirectText: {
    fontSize: typography.medium,
    color: colors.gray,
    marginTop: spacing.small,
  },
  loginButton: {
    marginTop: spacing.medium,
    padding: spacing.medium,
    backgroundColor: colors.secondary,
    borderRadius: 4,
    alignItems: 'center',
  },
  authFooter: {
    marginTop: spacing.large,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.medium,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: spacing.small,
  },
  linkText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  supportText: {
    fontSize: typography.medium,
    color: colors.gray,
    textAlign: 'center',
    marginTop: spacing.small,
  },
});

export default ForgotPasswordScreen;
