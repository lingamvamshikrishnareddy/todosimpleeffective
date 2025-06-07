import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const HomeScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appLogo}>TaskFlow</Text>
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Stop Juggling, Start Organizing</Text>
          <Text style={styles.heroSubtitle}>
            TaskFlow brings your tasks and notes together in one seamless,
            intuitive platform. Focus on what matters, achieve more, stress less.
          </Text>
          <View style={styles.ctaButtons}>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.primaryButtonText}>Get Started for Free</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.secondaryButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Features/Benefits Section */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>Why Choose TaskFlow?</Text>
          <View style={styles.featureGrid}>
            <FeatureCard 
              icon="📝"
              title="Effortless Task Management"
              description="Create, categorize, prioritize, and track your to-dos with a clean, user-friendly interface."
            />
            <FeatureCard 
              icon="📒"
              title="Integrated Note Taking"
              description="Capture ideas, meeting minutes, or research notes right alongside your tasks. Never lose context."
            />
            <FeatureCard 
              icon="🔄"
              title="Seamless Cloud Sync"
              description="Access your tasks and notes instantly from any device. Your data is always up-to-date."
            />
            <FeatureCard 
              icon="🎨"
              title="Customizable Views"
              description="Organize your workspace the way you think with flexible boards, lists, and tagging options."
            />
            <FeatureCard 
              icon="🔔"
              title="Smart Reminders"
              description="Stay on track with timely reminders and notifications so you never miss a deadline."
            />
            <FeatureCard 
              icon="🤝"
              title="Collaboration Ready"
              description="(Coming Soon!) Share projects and tasks with your team or family members."
            />
          </View>
        </View>

        {/* How It Works Section */}
        <View style={styles.howItWorksSection}>
          <Text style={styles.sectionTitle}>Get Productive in 3 Simple Steps</Text>
          <View style={styles.stepsContainer}>
            <StepItem 
              number="1"
              title="Sign Up Quickly"
              description="Create your free TaskFlow account in seconds. No credit card required."
            />
            <StepItem 
              number="2"
              title="Create & Organize"
              description="Add your tasks and notes. Use tags, projects, and due dates to structure your work."
            />
            <StepItem 
              number="3"
              title="Access Anywhere"
              description="Use TaskFlow on your web browser, desktop, or mobile device. Your data syncs everywhere."
            />
          </View>
        </View>

        {/* Testimonial Section */}
        <View style={styles.testimonialSection}>
          <Text style={styles.testimonialSectionTitle}>What Our Users Say</Text>
          <View style={styles.testimonial}>
            <Text style={styles.testimonialQuote}>
              "TaskFlow has completely transformed how I manage my freelance projects and personal life. Having tasks and notes together is a game-changer!"
            </Text>
            <Text style={styles.testimonialAuthor}>- Alex R., Web Developer</Text>
          </View>
        </View>

        {/* Final CTA Section */}
        <View style={styles.finalCtaSection}>
          <Text style={styles.finalCtaTitle}>Ready to Take Control of Your Day?</Text>
          <Text style={styles.finalCtaText}>
            Join thousands of users who rely on TaskFlow to stay organized and achieve their goals. Sign up today!
          </Text>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.primaryButtonText}>Start Free Trial</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => navigation.navigate('About')}>
              <Text style={styles.footerLink}>About Us</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Privacy')}>
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Terms')}>
              <Text style={styles.footerLink}>Terms of Service</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Contact')}>
              <Text style={styles.footerLink}>Contact</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.copyright}>© {new Date().getFullYear()} TaskFlow. All rights reserved.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Feature Card Component
const FeatureCard = ({ icon, title, description }) => {
  return (
    <View style={styles.featureCard}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  );
};

// Step Item Component
const StepItem = ({ number, title, description }) => {
  return (
    <View style={styles.stepItem}>
      <View style={styles.stepNumberContainer}>
        <Text style={styles.stepNumber}>{number}</Text>
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepDescription}>{description}</Text>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  appLogo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#3498db',
  },
  loginButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  heroSection: {
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#333333',
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666666',
    marginBottom: 30,
    lineHeight: 24,
  },
  ctaButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  secondaryButtonText: {
    color: '#3498db',
    fontWeight: '600',
    fontSize: 16,
  },
  benefitsSection: {
    padding: 20,
    backgroundColor: '#F9F9F9',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333333',
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    width: width > 600 ? (width - 60) / 2 : width - 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  featureIcon: {
    fontSize: 40,
    marginBottom: 15,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333333',
  },
  featureDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  howItWorksSection: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  stepsContainer: {
    marginTop: 10,
  },
  stepItem: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 35,
  },
  stepNumberContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  stepNumber: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333333',
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  testimonialSection: {
    padding: 20,
    backgroundColor: '#3498db',
  },
  testimonialSectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  testimonial: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    padding: 25,
  },
  testimonialQuote: {
    fontSize: 16,
    color: '#FFFFFF',
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 15,
  },
  testimonialAuthor: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'right',
    fontWeight: '600',
  },
  finalCtaSection: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  finalCtaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#333333',
  },
  finalCtaText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666666',
    marginBottom: 30,
    lineHeight: 24,
  },
  footer: {
    backgroundColor: '#333333',
    padding: 25,
    alignItems: 'center',
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 15,
  },
  footerLink: {
    color: '#FFFFFF',
    fontSize: 14,
    marginHorizontal: 10,
    marginVertical: 5,
  },
  copyright: {
    color: '#AAAAAA',
    fontSize: 12,
  },
});

export default HomeScreen;