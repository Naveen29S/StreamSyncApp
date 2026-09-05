import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Platform, Dimensions, Alert } from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInUp, FadeIn, Layout } from 'react-native-reanimated';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function AuthScreen() {
  const { mode } = useLocalSearchParams();
  const [isSignUp, setIsSignUp] = useState(mode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleToggleMode = () => {
    setIsSignUp(!isSignUp);
    setEmail('');
    setPassword('');
    setPasswordError('');
    setDob('');
  };

  async function handleAuthentication() {
    setPasswordError('');
    setLoading(true);
    
    if (isSignUp) {
      // Strong Password Validation
      const strongRegex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])(?=.{8,})");
      if (!strongRegex.test(password)) {
        setPasswordError('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character (e.g. !@#$%).');
        setLoading(false);
        return; // Stops here, password will not be sent to database
      }

      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            dob: dob,
          }
        }
      });

      if (error) {
        if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
          Alert.alert('Sign Up Error', 'This email is linked to an existing account.');
        } else {
          Alert.alert('Sign Up Error', error.message);
        }
      } else if (data?.user?.identities && data.user.identities.length === 0) {
        // Supabase returns an empty identities array for existing users when email confirmations are enabled
        Alert.alert('Sign Up Error', 'This email is linked to an existing account.');
      } else {
        if (data?.session) {
          // Check if user needs to connect platforms
          const { data: profile } = await supabase
            .from('profiles')
            .select('connected_platforms')
            .eq('id', data.session.user.id)
            .maybeSingle();
            
          if (!profile?.connected_platforms || profile.connected_platforms.length === 0) {
            router.replace('/dashboard/platforms');
          } else {
            router.replace('/dashboard');
          }
        } else {
          Alert.alert('Success', 'Account created! Please check your email to verify your account.');
          setPassword('');
          setIsSignUp(false);
        }
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        Alert.alert('Sign In Error', error.message);
      } else if (data?.session) {
        // Check if user needs to connect platforms
        const { data: profile } = await supabase
          .from('profiles')
          .select('connected_platforms')
          .eq('id', data.session.user.id)
          .maybeSingle();
          
        if (!profile?.connected_platforms || profile.connected_platforms.length === 0) {
          router.replace('/dashboard/platforms');
        } else {
          router.replace('/dashboard');
        }
      }
    }
    setLoading(false);
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
        <View style={styles.brandIcon}>
          <Text style={styles.brandIconText}>⟁</Text>
        </View>
        <Text style={styles.brandName}>StreamSync</Text>
      </Animated.View>

      {/* Auth Card */}
      <Animated.View layout={Layout.springify()} entering={FadeInUp.delay(100).duration(800)} style={styles.authCard}>
        <Animated.Text layout={Layout.springify()} style={styles.title}>
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </Animated.Text>
        <Animated.Text layout={Layout.springify()} style={styles.subtitle}>
          {isSignUp ? 'Join StreamSync and sync your platforms.' : 'Sign in to your creator hub.'}
        </Animated.Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput 
            style={styles.input} 
            placeholder="you@example.com" 
            placeholderTextColor="#5a6270"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
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
                  backgroundColor: '#0c0e12',
                  padding: '16px 18px',
                  borderRadius: 8,
                  fontSize: 14,
                  color: '#e8eaed',
                  border: '1px solid #1e2228',
                  outline: 'none',
                  fontFamily: 'inherit',
                  width: '100%',
                  boxSizing: 'border-box',
                  colorScheme: 'dark',
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
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32,
  },
  brandIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center',
  },
  brandIconText: {
    fontSize: 18, color: '#fff', fontWeight: 'bold',
  },
  brandName: {
    fontSize: 22, fontWeight: '700', color: '#000', letterSpacing: -0.3,
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
    fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 32,
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
});
