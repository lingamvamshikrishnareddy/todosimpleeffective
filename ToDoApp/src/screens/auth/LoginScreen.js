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
  Alert,
  SafeAreaView
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../../services/api';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import Icon from 'react-native-vector-icons/FontAwesome';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const route = useRoute();

  // Check for registration success message or session expired
  useEffect(() => {
    if (route.params?.registered) {
      setSuccessMessage('Registration successful! Please log in.');
    }
    if (route.params?.sessionExpired) {
      setError('Your session has expired. Please log in again.');
    }
  }, [route.params]);

  // Redirect if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (await api.auth.isAuthenticated()) {
          navigation.replace('Tasks');
        }
      } catch (err) {
        console.error('Auth check error:', err);
      }
    };
    
    checkAuth();
  }, [navigation]);

  const handleSubmit = async () => {
    setError(null);
    setSuccessMessage(null);

    // Basic client-side validation
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    try {
      await api.auth.login({ email, password });
      navigation.replace('Tasks');
    } catch (err) {
      const errorMessage = err.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>Login to TaskFlow</Text>

            {/* Success Message */}
            {successMessage && (
              <View style={styles.alertSuccess}>
                <Text style={styles.alertText}>{successMessage}</Text>
                <TouchableOpacity onPress={() => setSuccessMessage(null)}>
                  <Icon name="times" size={18} color={colors.success} />
                </TouchableOpacity>
              </View>
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.alertDanger}>
                <Text style={styles.alertText}>{error}</Text>
                <TouchableOpacity onPress={() => setError(null)}>
                  <Icon name="times" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email:</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@example.com"
                placeholderTextColor={colors.gray}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
                autoFocus
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password:</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.gray}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <TouchableOpacity 
              style={styles.forgotPassword}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, !email.trim() || !password.trim() ? styles.buttonDisabled : null]}
              onPress={handleSubmit}
              disabled={loading || !email.trim() || !password.trim()}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.buttonText}> Logging in...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>

            <View style={styles.authFooter}>
              <Text style={styles.footerText}>
                Don't have an account?{' '}
                <Text
                  style={styles.linkText}
                  onPress={() => navigation.navigate('Register')}
                >
                  Register
                </Text>
              </Text>
            </View>
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
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  authCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: spacing.lg,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  authTitle: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.lg,
    color: colors.primary,
  },
  alertSuccess: {
    backgroundColor: colors.successLight,
    borderRadius: 5,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertDanger: {
    backgroundColor: colors.errorLight,
    borderRadius: 5,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertText: {
    flex: 1,
    color: colors.darkText,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 5,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 5,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authFooter: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    color: colors.text,
    fontSize: 14,
  },
  linkText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
});

export default LoginScreen;