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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import { colors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import { typography } from '../../styles/typography';
import Icon from 'react-native-vector-icons/FontAwesome';

const RegisterScreen = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, message: '' });
  const navigation = useNavigation();

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

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'password') {
      checkPasswordStrength(value);
    }
    
    // Clear specific errors when user types
    if (field === 'password' || field === 'confirmPassword') {
      if (error === 'Passwords do not match') setError(null);
    }
    if (field === 'password') {
      if (error === 'Password must be at least 8 characters long') setError(null);
      if (error === 'Password is too weak. Include uppercase, lowercase, numbers, or symbols.') setError(null);
    }
    if (field === 'email') {
      if (error === 'Please enter a valid email address') setError(null);
    }
    if (field === 'name') {
      if (error === 'Name is required') setError(null);
    }
  };

  const checkPasswordStrength = (password) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);
    let score = 0;
    let message = '';

    if (password.length < 8) {
      message = 'Too short (min 8 chars)';
      score = 0;
    } else {
      score += 1;
      if (hasUpperCase) score += 1;
      if (hasLowerCase) score += 1;
      if (hasNumber) score += 1;
      if (hasSpecialChar) score += 1;
      if (password.length >= 12) score += 1; // Max score 6

      if (score <= 2) message = 'Weak';
      else if (score <= 4) message = 'Fair';
      else if (score === 5) message = 'Good';
      else message = 'Strong';
    }
    
    setPasswordStrength({ score, message });
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      throw new Error('Name is required');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      throw new Error('Please enter a valid email address');
    }
    
    if (formData.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    if (passwordStrength.score < 3 && formData.password.length >= 8) {
      throw new Error('Password is too weak. Include uppercase, lowercase, numbers, or symbols.');
    }
    
    if (formData.password !== formData.confirmPassword) {
      throw new Error('Passwords do not match');
    }
  };

  const handleSubmit = async () => {
    setError(null);

    try {
      validateForm();
      setLoading(true);

      const userData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password
      };

      await api.auth.register(userData);
      navigation.navigate('Login', { registered: true });

    } catch (err) {
      const errorMessage = err.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    const score = passwordStrength.score;
    if (!formData.password || score === 0) return colors.error;
    if (score <= 2) return colors.error;
    if (score <= 4) return colors.warning;
    if (score === 5) return colors.info;
    return colors.success;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>Create your TaskFlow account</Text>

            {error && (
              <View style={styles.alertDanger}>
                <Text style={styles.alertText}>{error}</Text>
                <TouchableOpacity onPress={() => setError(null)}>
                  <Icon name="times" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Full Name:</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(value) => handleChange('name', value)}
                placeholder="e.g., Jane Doe"
                placeholderTextColor={colors.gray}
                autoCapitalize="words"
                editable={!loading}
                autoFocus
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email:</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(value) => handleChange('email', value)}
                placeholder="your.email@example.com"
                placeholderTextColor={colors.gray}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password:</Text>
              <TextInput
                style={styles.input}
                value={formData.password}
                onChangeText={(value) => handleChange('password', value)}
                placeholder="Create a strong password"
                placeholderTextColor={colors.gray}
                secureTextEntry
                editable={!loading}
              />
              
              {/* Password Strength Meter */}
              <View style={styles.passwordStrengthMeter}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { 
                        width: `${Math.max(0, (passwordStrength.score / 6) * 100)}%`,
                        backgroundColor: getPasswordStrengthColor(),
                      }
                    ]}
                  />
                </View>
                <Text style={styles.passwordHelpText}>
                  {formData.password
                    ? `Strength: ${passwordStrength.message}`
                    : "Minimum 8 characters"}
                </Text>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Confirm Password:</Text>
              <TextInput
                style={[
                  styles.input,
                  formData.confirmPassword && 
                  formData.password !== formData.confirmPassword && 
                  styles.inputError
                ]}
                value={formData.confirmPassword}
                onChangeText={(value) => handleChange('confirmPassword', value)}
                placeholder="Re-enter your password"
                placeholderTextColor={colors.gray}
                secureTextEntry
                editable={!loading}
              />
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <Text style={styles.errorText}>Passwords do not match.</Text>
              )}
            </View>

            <Text style={styles.termsAgreement}>
              By registering, you agree to our Terms of Service and Privacy Policy.
            </Text>

            <TouchableOpacity
              style={[
                styles.button,
                (loading || !formData.name || !formData.email || !formData.password || !formData.confirmPassword) && 
                styles.buttonDisabled
              ]}
              onPress={handleSubmit}
              disabled={loading || !formData.name || !formData.email || !formData.password || !formData.confirmPassword}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.buttonText}> Creating Account...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Register</Text>
              )}
            </TouchableOpacity>

            <View style={styles.authFooter}>
              <Text style={styles.footerText}>
                Already have an account?{' '}
                <Text
                  style={styles.linkText}
                  onPress={() => navigation.navigate('Login')}
                >
                  Login
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
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  passwordStrengthMeter: {
    marginTop: spacing.xs,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.lightGray,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: spacing.xs,
  },
  progressFill: {
    height: '100%',
  },
  passwordHelpText: {
    fontSize: 12,
    color: colors.gray,
  },
  termsAgreement: {
    fontSize: 12,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: spacing.md,
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

export default RegisterScreen;