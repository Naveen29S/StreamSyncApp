import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, Dimensions, Image, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const platforms = [
  { 
    id: 'yt', 
    name: 'YouTube', 
    logo: 'https://img.icons8.com/color/512/youtube-play.png',
    logoBg: '#fff',
    logoSize: { width: 34, height: 34 },
    description: 'Sync video analytics & comments'
  },
  { 
    id: 'ig', 
    name: 'Instagram', 
    logo: 'https://img.icons8.com/fluent/512/instagram-new.png', 
    logoBg: '#fff',
    logoSize: { width: 34, height: 34 },
    description: 'Connect your Instagram business or creator account' 
  },
  { 
    id: 'x', 
    name: 'X (Twitter)', 
    logo: 'https://img.icons8.com/ios-filled/512/twitterx--v1.png', 
    logoBg: '#fff', // White background so the black X is visible!
    logoSize: { width: 30, height: 30 },
    description: 'Connect your X (Twitter) account' 
  },
  { 
    id: 'fb', 
    name: 'Facebook', 
    logo: 'https://img.icons8.com/ios-filled/512/FFFFFF/facebook-f.png', 
    logoBg: '#1877F2',
    logoSize: { width: 28, height: 28 },
    description: 'Connect your Facebook page' 
  },
  { 
    id: 'in', 
    name: 'LinkedIn', 
    logo: 'https://img.icons8.com/color/512/linkedin.png', 
    logoBg: '#fff',
    logoSize: { width: 34, height: 34 },
    description: 'Connect your LinkedIn profile or page' 
  },
];

export default function ConnectsScreen() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const [apiKeys, setApiKeys] = useState({});
  const [syncing, setSyncing] = useState(null);
  const [connectError, setConnectError] = useState(null);
  const params = useLocalSearchParams();

  // Handle OAuth redirect errors
  useEffect(() => {
    if (params?.error) {
      const description = params.error_description?.replace(/\+/g, ' ') || 'An unknown error occurred';
      if (params.error_code === 'identity_already_exists') {
        alert('This platform account is already connected to your StreamSync profile!');
      } else {
        alert('Connection Failed: ' + description);
      }
      
      // Clear params from URL securely without triggering infinite loops
      if (Platform.OS === 'web') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      router.setParams({ error: '', error_code: '', error_description: '' });
    }
  }, [params?.error]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await fetchProfile(session.user.id);
        
        // 1. Sync connected_platforms based strictly on Supabase identities (most reliable for linkIdentity)
        const { data: profile } = await supabase.from('profiles').select('connected_platforms, api_keys').eq('id', session.user.id).single();
        let newConnected = profile?.connected_platforms || [];
        let profileUpdated = false;
        
        const providerToPlatformMap = { 'google': 'yt', 'facebook': 'fb', 'twitter': 'x', 'linkedin_oidc': 'in' };
        const identities = session.user?.identities || [];
        
        identities.forEach(id => {
           const platformId = providerToPlatformMap[id.provider];
           // If they have the identity linked in Supabase but it's not in their profile yet, add it!
           if (platformId && !newConnected.includes(platformId)) {
               newConnected.push(platformId);
               profileUpdated = true;
           }
        });
        
        if (profileUpdated) {
           await supabase.from('profiles').update({ connected_platforms: newConnected }).eq('id', session.user.id);
           setConnectedPlatforms(newConnected);
        }

        // 2. Handle provider token capture if available (for future Edge function API calls)
        if (session.provider_token) {
          const pendingPlatform = await AsyncStorage.getItem('pending_connection');
          let platformId = pendingPlatform;
          
          if (!platformId) {
            const provider = session.user?.app_metadata?.provider;
            const platformMap = { google: 'yt', facebook: 'fb', twitter: 'x', linkedin_oidc: 'in' };
            platformId = platformMap[provider];
          }

          if (platformId) {
             await AsyncStorage.removeItem('pending_connection');
             const newApiKeys = { ...(profile?.api_keys || {}) };
             newApiKeys[platformId] = session.provider_token;
             
             await supabase.from('profiles').update({
               api_keys: newApiKeys
             }).eq('id', session.user.id);
             
             setApiKeys(newApiKeys);
          }
        }
      } else {
        router.replace('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('connected_platforms, api_keys')
      .eq('id', userId)
      .single();
    if (data?.connected_platforms) {
      setConnectedPlatforms(data.connected_platforms);
    }
    if (data?.api_keys) {
      setApiKeys(data.api_keys);
    }
  }

  async function handleConnectPress(platformId) {
    if (!session) return;
    setSyncing(platformId);
    
    let provider = '';
    let scopes = '';
    
    switch (platformId) {
      case 'yt':
        provider = 'google';
        scopes = 'https://www.googleapis.com/auth/youtube.readonly';
        break;
      case 'fb':
      case 'ig':
        provider = 'facebook';
        scopes = 'public_profile';
        break;
      case 'x':
        provider = 'twitter';
        break;
      case 'in':
        provider = 'linkedin_oidc';
        break;
    }

    if (provider) {
      await AsyncStorage.setItem('pending_connection', platformId);
      const { data, error } = await supabase.auth.linkIdentity({
        provider: provider,
        options: {
          scopes: scopes ? scopes : undefined,
          redirectTo: Platform.OS === 'web' ? window.location.origin + '/dashboard/platforms' : undefined
        }
      });
      if (error) {
        console.warn('OAuth Error:', error.message);
        setConnectError(error.message);
        setSyncing(platformId + '_error');
      } else if (data?.url && Platform.OS === 'web') {
        window.location.href = data.url;
      }
    } else {
      setSyncing(null);
    }
  }

  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: false,
      })
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.ScrollView 
        contentContainerStyle={styles.scrollContent}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Connect your <Text style={styles.titleHighlight}>social platforms</Text>
          </Text>
          <Text style={styles.subtitle}>
            Manage all your content, analytics, messages, and growth from one place.
          </Text>
        </View>

        {/* Platforms List */}
        <View style={styles.listContainer}>
          {platforms.map((platform, index) => {
            const isConnected = connectedPlatforms.includes(platform.id);
            
            return (
              <View key={platform.id} style={[styles.card, isConnected && styles.cardConnected]}>
                <View style={styles.cardLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: platform.logoBg }]}>
                    <Image source={{ uri: platform.logo }} style={platform.logoSize || styles.logoImage} resizeMode="contain" />
                  </View>
                  <View style={styles.platformInfo}>
                    <Text style={styles.platformName}>{platform.name}</Text>
                    <Text style={styles.platformDesc}>{platform.description}</Text>
                  </View>
                </View>
                
                {isConnected ? (
                  <View style={styles.cardRight}>
                    <View style={styles.connectedBadge}>
                      <Text style={styles.connectedBadgeText}>Connected</Text>
                    </View>
                    <TouchableOpacity style={styles.chevronButton} onPress={() => handleConnectPress(platform.id)}>
                      <Text style={styles.chevronIcon}>✎</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ marginRight: 16, opacity: 0.4 }}>
                      <Feather name="link-2" size={18} color="#000" />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <TouchableOpacity 
                        style={styles.connectButton} 
                        onPress={() => handleConnectPress(platform.id)}
                        disabled={syncing === platform.id}
                      >
                        <Text style={styles.connectButtonText}>
                          {syncing === platform.id ? 'Connecting...' : 'Connect  →'}
                        </Text>
                      </TouchableOpacity>
                      {connectError && syncing === platform.id + '_error' && (
                        <Text style={{ color: 'red', fontSize: 12, marginTop: 4, maxWidth: 150, textAlign: 'right' }}>
                          {connectError}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
          
      </Animated.ScrollView>

    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    maxWidth: 600,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000',
    marginBottom: 16,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  titleHighlight: {
    color: '#9d50ff',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  listContainer: {
    width: '100%',
    maxWidth: 800,
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 10,
  },
  cardConnected: {
    borderColor: 'rgba(157, 80, 255, 0.3)',
    backgroundColor: 'rgba(157, 80, 255, 0.02)',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  platformInfo: {
    flex: 1,
  },
  platformName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  platformDesc: {
    fontSize: 14,
    color: '#666',
  },

  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectedBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(157, 80, 255, 0.6)',
    backgroundColor: 'rgba(157, 80, 255, 0.1)',
    marginRight: 8,
    shadowColor: '#9d50ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  connectedBadgeText: {
    color: '#9d50ff',
    fontSize: 14,
    fontWeight: '600',
  },
  chevronButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronIcon: {
    color: '#666',
    fontSize: 16,
  },
  connectButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fafafa',
  },
  connectButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
});
