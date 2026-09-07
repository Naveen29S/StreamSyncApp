import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Platform, Dimensions, Alert, Image, Linking } from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInUp, FadeIn, Layout } from 'react-native-reanimated';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function AuthScreen() {
  const { mode } = useLocalSearchParams();
  const [isSignUp, setIsSignUp] = useState(mode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleToggleMode = () => {
    setIsSignUp(!isSignUp);
    setEmail('');
    setPassword('');
    setPasswordError('');
    setAuthError('');
    setAuthSuccess('');
    setDob('');
  };

  async function handleGoogleSignIn() {
    setPasswordError('');
    setAuthError('');
    setAuthSuccess('');
    setLoading(true);
    try {
      await AsyncStorage.setItem('pending_connection', 'yt');
      const redirectUri = Platform.OS === 'web' ? (window.location.origin + '/dashboard') : undefined;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/youtube.readonly',
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account consent',
          },
          redirectTo: redirectUri,
        },
      });

      if (error) {
        setAuthError(error.message || 'Failed to start Google sign in');
        Alert.alert('Google Sign-In Error', error.message);
        setLoading(false);
      } else if (data?.url) {
        if (Platform.OS === 'web') {
          window.location.href = data.url;
        } else {
          Linking.openURL(data.url);
          setLoading(false);
        }
      }
    } catch (err) {
      const msg = err.message || 'Failed to initiate Google sign in';
      setAuthError(msg);
      Alert.alert('Sign-In Error', msg);
      setLoading(false);
    }
  }

  async function handleAuthentication() {
    setPasswordError('');
    setAuthError('');
    setAuthSuccess('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setAuthError('Please enter your email address.');
      return;
    }
    if (!password) {
      setAuthError('Please enter your password.');
      return;
    }

    setLoading(true);
    
    try {
      if (isSignUp) {
        // Strong Password Validation
        const strongRegex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])(?=.{8,})");
        if (!strongRegex.test(password)) {
          setPasswordError('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character (e.g. !@#$%).');
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: {
              dob: dob,
            }
          }
        });

        if (error) {
          const isExisting = error.message.toLowerCase().includes('already registered') || 
                             error.message.toLowerCase().includes('already exists');
          const msg = isExisting 
            ? 'This email is already registered. Please sign in instead.' 
            : error.message;
          setAuthError(msg);
          Alert.alert('Sign Up Error', msg);
        } else if (data?.user?.identities && data.user.identities.length === 0) {
          const msg = 'This email is already registered. Please sign in instead.';
          setAuthError(msg);
          Alert.alert('Sign Up Error', msg);
        } else {
          if (data?.session) {
            router.replace('/dashboard');
          } else {
            setAuthSuccess('Account created! Please check your email to verify, or sign in.');
            Alert.alert('Success', 'Account created! Please check your email to verify your account.');
            setPassword('');
            setIsSignUp(false);
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password,
        });

        if (error) {
          setAuthError(error.message || 'Invalid email or password.');
          Alert.alert('Sign In Error', error.message);
        } else if (data?.session) {
          router.replace('/dashboard');
        }
      }
    } catch (err) {
      const msg = err.message || 'A network error occurred. Please check your connection and try again.';
      setAuthError(msg);
      Alert.alert('Connection Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Subtle background glows matching dashboard cyan */}
      <View style={styles.glowA} pointerEvents="none" />
      <View style={styles.glowB} pointerEvents="none" />

      {/* Back link */}
      <Animated.View entering={FadeIn.delay(300)} style={styles.backButton}>
        <Link href="/" asChild>
          <TouchableOpacity>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </Link>
      </Animated.View>

      {/* Brand */}
      <Animated.View entering={FadeInUp.duration(600)} style={styles.brandRow}>
        <Image
          source={require('../assets/logo-mark.png')}
          style={styles.authLogoIcon}
          resizeMode="contain"
        />
        <Text style={styles.authBrandName}>StreamSync</Text>
      </Animated.View>

      {/* Auth Card */}
      <Animated.View layout={Layout.springify()} entering={FadeInUp.delay(100).duration(800)} style={styles.authCard}>
        <Animated.Text layout={Layout.springify()} style={styles.title}>
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </Animated.Text>
        <Animated.Text layout={Layout.springify()} style={styles.subtitle}>
          {isSignUp ? 'Join StreamSync and sync your platforms.' : 'Sign in to your creator hub.'}
        </Animated.Text>

        {/* Alerts */}
        {authError ? (
          <Animated.View entering={FadeInUp} style={styles.authAlertError}>
            <Text style={styles.authAlertText}>{authError}</Text>
          </Animated.View>
        ) : null}

        {authSuccess ? (
          <Animated.View entering={FadeInUp} style={styles.authAlertSuccess}>
            <Text style={styles.authAlertSuccessText}>{authSuccess}</Text>
          </Animated.View>
        ) : null}

        {/* Continue with Google */}
        <TouchableOpacity 
          style={styles.googleButton} 
          onPress={handleGoogleSignIn} 
          disabled={loading}
        >
          <Image 
            source={{ uri: 'https://img.icons8.com/color/512/google-logo.png' }} 
            style={styles.googleIcon} 
            resizeMode="contain" 
          />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput 
            style={styles.input} 
            placeholder="you@example.com" 
            placeholderTextColor="#5a6270"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (authError) setAuthError('');
            }}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput 
            style={[styles.input, passwordError ? { borderColor: '#ff4b91' } : null]} 
            placeholder="••••••••" 
            placeholderTextColor="#5a6270"
            secureTextEntry
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError('');
              if (authError) setAuthError('');
            }}
          />
          {passwordError ? (
            <Animated.Text entering={FadeInUp} style={styles.errorText}>
              {passwordError}
            </Animated.Text>
          ) : null}
        </View>

        {isSignUp && (
          <Animated.View entering={FadeInUp} style={styles.inputContainer}>
            <Text style={styles.label}>DATE OF BIRTH</Text>
            {Platform.OS === 'web' ? (
              <input 
                type="date"
                style={{
                  backgroundColor: '#f8f8f8',
                  padding: '16px 18px',
                  borderRadius: 8,
                  fontSize: 14,
                  color: '#000',
                  border: '1px solid #eee',
                  outline: 'none',
                  fontFamily: 'inherit',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            ) : (
              <TextInput 
                style={styles.input} 
                placeholder="YYYY-MM-DD" 
                placeholderTextColor="#5a6270"
                value={dob}
                onChangeText={setDob}
              />
            )}
          </Animated.View>
        )}

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleAuthentication} 
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'SYNCING...' : (isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN')}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          </Text>
          <TouchableOpacity onPress={handleToggleMode} disabled={loading}>
            <Text style={styles.footerLink}>
              {isSignUp ? 'Sign in' : 'Sign up'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  glowA: {
    position: 'absolute', top: -120, left: -80, width: 500, height: 500, borderRadius: 250,
    backgroundColor: '#ff4b91', opacity: 0.15,
    ...(Platform.OS === 'web' ? { filter: 'blur(120px)' } : {}),
  },
  glowB: {
    position: 'absolute', bottom: -100, right: -60, width: 400, height: 400, borderRadius: 200,
    backgroundColor: '#fb923c', opacity: 0.15,
    ...(Platform.OS === 'web' ? { filter: 'blur(100px)' } : {}),
  },
  backButton: {
    position: 'absolute', top: 32, left: 32, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: '#eee',
  },
  backText: {
    fontSize: 13, fontWeight: '500', color: '#666',
  },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32,
  },
  authLogoIcon: {
    width: 42,
    height: 42,
  },
  authBrandName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -0.4,
  },
  authCard: {
    width: '100%', maxWidth: 400, backgroundColor: '#fff', padding: 36,
    borderRadius: 24, borderWidth: 1, borderColor: '#eee',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.05, shadowRadius: 40,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  title: {
    fontSize: 28, fontWeight: '700', color: '#000', marginBottom: 6,
    textAlign: 'center', letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24,
  },
  authAlertError: {
    backgroundColor: '#fff0f3',
    borderWidth: 1,
    borderColor: '#ffd0d7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  authAlertText: {
    color: '#d90429',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  authAlertSuccess: {
    backgroundColor: '#eefbf4',
    borderWidth: 1,
    borderColor: '#bbf2d3',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  authAlertSuccessText: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 10, fontWeight: '700', color: '#666', marginBottom: 8,
    letterSpacing: 1.2, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#f8f8f8', paddingHorizontal: 18, paddingVertical: 16,
    borderRadius: 8, fontSize: 14, color: '#000', borderWidth: 1, borderColor: '#eee',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  errorText: {
    color: '#ff4b91',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#000', paddingVertical: 16, borderRadius: 999,
    alignItems: 'center', marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase',
  },
  footer: {
    flexDirection: 'row', justifyContent: 'center', marginTop: 24,
  },
  footerText: {
    color: '#666', fontSize: 14,
  },
  footerLink: {
    color: '#000', fontSize: 14, fontWeight: '700',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 999,
    paddingVertical: 14,
    marginBottom: 20,
    gap: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#eee',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
});
