import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, Dimensions, Image, Animated, Modal, TextInput, ActivityIndicator, Alert, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { connectYouTubeViaApiKey, disconnectPlatform, syncPlatformData, isPlatformMatch, normalizePlatformKey, processSessionOAuthTokens } from '../../lib/api';
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
    description: 'Sync video analytics, subscriber count & comments via API or Google'
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
  const [managePlatform, setManagePlatform] = useState(null);
  const params = useLocalSearchParams();

  // YouTube modal states
  const [ytModalVisible, setYtModalVisible] = useState(false);
  const [ytTab, setYtTab] = useState('oauth'); // 'oauth' | 'apikey'
  const [ytApiKey, setYtApiKey] = useState('');
  const [ytChannelId, setYtChannelId] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [ytModalError, setYtModalError] = useState('');
  const [ytModalSuccess, setYtModalSuccess] = useState('');

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

    if (params?.connect) {
      if (params.connect === 'yt') {
        openYtModal();
      } else {
        const plat = platforms.find(p => p.id === params.connect);
        if (plat) {
          const isConn = connectedPlatforms.some(p => isPlatformMatch(p, plat.id));
          if (isConn) {
            setManagePlatform(plat);
          } else {
            handleOAuthConnect(plat.id);
          }
        }
      }
      if (Platform.OS === 'web') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      router.setParams({ connect: '' });
    }
  }, [params?.error, params?.connect]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        if (session.provider_token) {
          processSessionOAuthTokens(session).then(() => {
            fetchProfile(session.user.id);
          });
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        if (session.provider_token) {
          await processSessionOAuthTokens(session);
        }
        await fetchProfile(session.user.id);
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
      .maybeSingle();

    const { data: { user } } = await supabase.auth.getUser();
    const identities = user?.identities || session?.user?.identities || [];
    const providerToPlatformMap = { 'google': 'yt', 'facebook': 'fb', 'twitter': 'x', 'linkedin_oidc': 'in', 'linkedin': 'in' };
    const identityPlatforms = identities.map(id => providerToPlatformMap[id.provider]).filter(Boolean);

    const profileKeys = data?.api_keys || {};
    const keyPlatforms = [];
    if (profileKeys.youtube || profileKeys.yt || profileKeys.youtube_channel_id || profileKeys.youtube_token) {
      keyPlatforms.push('yt');
    }

    const { data: anRows } = await supabase
      .from('analytics')
      .select('platform')
      .eq('user_id', userId);
    const anPlatforms = (anRows || []).map(r => normalizePlatformKey(r.platform)).filter(Boolean);

    const rawList = [
      ...(data?.connected_platforms || []),
      ...identityPlatforms,
      ...keyPlatforms,
      ...anPlatforms
    ];
    const platforms = Array.from(new Set(rawList.map(p => normalizePlatformKey(p)).filter(Boolean)));
    setConnectedPlatforms(platforms);

    if (data?.api_keys) {
      setApiKeys(data.api_keys);
      const isYt = platforms.includes('yt');
      if (isYt) {
        const rawKey = typeof data.api_keys.youtube === 'object'
          ? (data.api_keys.youtube.apiKey || data.api_keys.youtube.token || '')
          : (data.api_keys.youtube || data.api_keys.yt || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '');
        const rawChan = data.api_keys.youtube_channel_id || data.api_keys.yt_channel_id || (typeof data.api_keys.youtube === 'object' ? data.api_keys.youtube.channelId : '') || '';
        if (rawKey) setYtApiKey(rawKey);
        if (rawChan) setYtChannelId(rawChan);
      } else {
        setYtApiKey('');
        setYtChannelId('');
      }
    } else {
      setYtApiKey('');
      setYtChannelId('');
    }
  }

  function openYtModal() {
    setYtModalError('');
    setYtModalSuccess('');
    setYtTab('oauth');
    const rawKey = typeof apiKeys.youtube === 'object'
      ? (apiKeys.youtube.apiKey || apiKeys.youtube.token || '')
      : (apiKeys.youtube || apiKeys.yt || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '');
    const rawChan = apiKeys.youtube_channel_id || apiKeys.yt_channel_id || (typeof apiKeys.youtube === 'object' ? apiKeys.youtube.channelId : '') || '';

    setYtApiKey(rawKey);
    setYtChannelId(rawChan || '@GoogleDevelopers');
    setYtModalVisible(true);
  }

  async function handleApiKeyConnect(customKey, customChannel) {
    const keyToUse = (customKey !== undefined ? customKey : ytApiKey).trim();
    const chanToUse = (customChannel !== undefined ? customChannel : ytChannelId).trim();

    if (!keyToUse) {
      setYtModalError('Please enter a YouTube Data API Key (or click "Quick Demo Channel" below to test).');
      return;
    }
    if (!chanToUse) {
      setYtModalError('Please enter a YouTube Channel Handle (e.g. @mkbhd, @GoogleDevelopers) or Channel ID (e.g. UC...).');
      return;
    }

    setYtLoading(true);
    setYtModalError('');
    setYtModalSuccess('');

    try {
      const channelData = await connectYouTubeViaApiKey(keyToUse, chanToUse);
      setYtModalSuccess(`Successfully connected to: ${channelData.channel.title}!`);
      
      // Update local state
      await fetchProfile(session.user.id);
      
      setTimeout(() => {
        setYtModalVisible(false);
        setYtModalSuccess('');
      }, 1200);
    } catch (err) {
      setYtModalError(err.message || 'Failed to connect YouTube channel. Please check your key and channel details.');
    } finally {
      setYtLoading(false);
    }
  }

  async function handleQuickDemoConnect() {
    setYtApiKey('DEMO');
    setYtChannelId('@GoogleDevelopers');
    await handleApiKeyConnect('DEMO', '@GoogleDevelopers');
  }

  async function handleSyncYtNow() {
    setYtLoading(true);
    setYtModalError('');
    try {
      await syncPlatformData(['yt']);
      setYtModalSuccess('Channel data refreshed successfully!');
      setTimeout(() => setYtModalSuccess(''), 2000);
    } catch (e) {
      setYtModalError(e.message || 'Sync failed');
    } finally {
      setYtLoading(false);
    }
  }

  async function handleDisconnectYt() {
    setYtLoading(true);
    try {
      // Optimistically clear local state immediately
      setConnectedPlatforms(prev => prev.filter(p => !isPlatformMatch(p, 'yt')));
      setYtApiKey('');
      setYtChannelId('');

      await disconnectPlatform('yt');
      await fetchProfile(session.user.id);
      setYtModalVisible(false);
    } catch (e) {
      setYtModalError(e.message || 'Failed to disconnect');
    } finally {
      setYtLoading(false);
    }
  }

  async function handleDisconnectPlatform(platformId) {
    if (!session) return;
    try {
      // Optimistically clear local state immediately
      setConnectedPlatforms(prev => prev.filter(p => !isPlatformMatch(p, platformId)));
      setManagePlatform(null);

      await disconnectPlatform(platformId);
      await fetchProfile(session.user.id);
    } catch (e) {
      alert('Failed to disconnect: ' + (e.message || 'Unknown error'));
    }
  }

  async function handleSyncPlatform(platformId) {
    if (!session) return;
    try {
      setSyncing(platformId);
      await syncPlatformData([platformId]);
      await fetchProfile(session.user.id);
      setTimeout(() => setSyncing(null), 1000);
    } catch (e) {
      setSyncing(null);
      alert('Failed to sync: ' + (e.message || 'Unknown error'));
    }
  }

  async function handleOAuthConnect(platformId) {
    if (!session) return;
    setSyncing(platformId);
    setConnectError(null);
    
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
      const isAlreadyConnected = connectedPlatforms.some(p => isPlatformMatch(p, platformId));
      const authMethod = isAlreadyConnected ? supabase.auth.signInWithOAuth : supabase.auth.linkIdentity;

      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/dashboard/platforms';
      const redirectUri = Platform.OS === 'web' ? (window.location.origin + currentPath) : undefined;

      const oauthOptions = {
        scopes: scopes ? scopes : undefined,
        redirectTo: redirectUri,
        queryParams: platformId === 'yt' ? { access_type: 'offline', prompt: 'select_account consent' } : undefined,
      };

      let { data, error } = await authMethod.call(supabase.auth, {
        provider: provider,
        options: oauthOptions
      });

      if (error && authMethod === supabase.auth.linkIdentity && 
          (error.message?.includes('already') || error.code === 'identity_already_exists')) {
        const retry = await supabase.auth.signInWithOAuth({
          provider: provider,
          options: oauthOptions
        });
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        await AsyncStorage.removeItem('pending_connection').catch(() => {});
        console.warn('OAuth Error:', error.message);
        setConnectError(error.message);
        setSyncing(null);
        if (platformId === 'yt') {
          setYtModalError(error.message);
        }
      } else if (data?.url) {
        if (Platform.OS === 'web') {
          window.location.href = data.url;
        } else {
          Linking.openURL(data.url);
          setSyncing(null);
        }
      }
    } else {
      setSyncing(null);
    }
  }

  function handleConnectPress(platformId) {
    if (platformId === 'yt') {
      openYtModal();
      return;
    }
    handleOAuthConnect(platformId);
  }

  const isYtConnected = connectedPlatforms.some(p => isPlatformMatch(p, 'yt'));

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
            const isConnected = connectedPlatforms.some(p => isPlatformMatch(p, platform.id));
            
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
                    <TouchableOpacity 
                      style={styles.chevronButton} 
                      onPress={() => platform.id === 'yt' ? openYtModal() : setManagePlatform(platform)}
                    >
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

      {/* ─── YouTube Connection Modal ─── */}
      <Modal
        visible={ytModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setYtModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Image source={{ uri: 'https://img.icons8.com/color/512/youtube-play.png' }} style={{ width: 28, height: 28 }} resizeMode="contain" />
                <Text style={styles.modalTitle}>Connect YouTube</Text>
              </View>
              <TouchableOpacity onPress={() => setYtModalVisible(false)} style={styles.modalCloseBtn}>
                <Text style={{ fontSize: 18, color: '#666' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {isYtConnected && (
              <View style={styles.alreadyConnectedBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>Channel Connected & Synced</Text>
                </View>
                <Text style={{ fontSize: 13, color: '#444', marginTop: 4 }}>
                  {apiKeys.youtube_channel_title ? `Channel: ${apiKeys.youtube_channel_title}` : 'Your YouTube channel is actively delivering data.'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity 
                    style={[styles.modalSecondaryBtn, { flex: 1 }]} 
                    onPress={handleSyncYtNow}
                    disabled={ytLoading}
                  >
                    <Text style={styles.modalSecondaryBtnText}>{ytLoading ? 'Syncing...' : '↻ Sync Now'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalDangerBtn, { flex: 1 }]} 
                    onPress={handleDisconnectYt}
                    disabled={ytLoading}
                  >
                    <Text style={styles.modalDangerBtnText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Tab Selection */}
            <View style={styles.modalTabs}>
              <TouchableOpacity 
                style={[styles.modalTabBtn, ytTab === 'oauth' && styles.modalTabBtnActive]}
                onPress={() => setYtTab('oauth')}
              >
                <Text style={[styles.modalTabText, ytTab === 'oauth' && styles.modalTabTextActive]}>Google OAuth (Recommended)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalTabBtn, ytTab === 'apikey' && styles.modalTabBtnActive]}
                onPress={() => setYtTab('apikey')}
              >
                <Text style={[styles.modalTabText, ytTab === 'apikey' && styles.modalTabTextActive]}>YouTube API Key</Text>
              </TouchableOpacity>
            </View>

            {/* Tab: API Key */}
            {ytTab === 'apikey' ? (
              <View style={styles.tabBody}>
                <Text style={styles.modalDesc}>
                  Enter your YouTube Data API v3 Key and your channel Handle or ID to instantly sync channel subscribers, views, engagement, and videos.
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>YOUTUBE DATA API KEY *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. AIzaSy..."
                    placeholderTextColor="#999"
                    value={ytApiKey}
                    onChangeText={setYtApiKey}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>CHANNEL HANDLE OR ID *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. @mkbhd, @GoogleDevelopers, or UC..."
                    placeholderTextColor="#999"
                    value={ytChannelId}
                    onChangeText={setYtChannelId}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {ytModalError ? (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{ytModalError}</Text>
                  </View>
                ) : null}

                {ytModalSuccess ? (
                  <View style={styles.successBanner}>
                    <Text style={styles.successBannerText}>{ytModalSuccess}</Text>
                  </View>
                ) : null}

                <TouchableOpacity 
                  style={[styles.modalPrimaryBtn, ytLoading && { opacity: 0.7 }]}
                  onPress={() => handleApiKeyConnect()}
                  disabled={ytLoading}
                >
                  {ytLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalPrimaryBtnText}>Connect & Fetch Channel Data</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.quickSampleBtn, { marginTop: 4 }]}
                  onPress={handleQuickDemoConnect}
                  disabled={ytLoading}
                >
                  <Text style={styles.quickSampleText}>⚡ Quick Connect Sample Channel (@GoogleDevelopers)</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Tab: Google OAuth */
              <View style={styles.tabBody}>
                <Text style={styles.modalDesc}>
                  Sign in with your Google account to authorize StreamSync to read your YouTube channel statistics and uploaded videos directly.
                </Text>

                {ytModalError ? (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{ytModalError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity 
                  style={styles.googleOAuthBtn}
                  onPress={() => handleOAuthConnect('yt')}
                  disabled={syncing === 'yt'}
                >
                  <Image source={{ uri: 'https://img.icons8.com/color/512/google-logo.png' }} style={{ width: 20, height: 20, marginRight: 10 }} />
                  <Text style={styles.googleOAuthBtnText}>
                    {syncing === 'yt' ? 'Connecting to Google...' : 'Continue with Google'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </View>
      </Modal>

      {/* ─── Platform Management Modal (for non-YT platforms) ─── */}
      <Modal
        visible={Boolean(managePlatform)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setManagePlatform(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {managePlatform && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Image source={{ uri: managePlatform.logo }} style={{ width: 26, height: 26 }} resizeMode="contain" />
                    <Text style={styles.modalTitle}>Manage {managePlatform.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setManagePlatform(null)} style={styles.modalCloseBtn}>
                    <Text style={{ fontSize: 18, color: '#666' }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.alreadyConnectedBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>Account Connected & Active</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: '#444', marginTop: 4 }}>
                    Your {managePlatform.name} account is linked to your StreamSync profile.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <TouchableOpacity 
                      style={[styles.modalSecondaryBtn, { flex: 1 }]} 
                      onPress={() => handleSyncPlatform(managePlatform.id)}
                      disabled={syncing === managePlatform.id}
                    >
                      <Text style={styles.modalSecondaryBtnText}>
                        {syncing === managePlatform.id ? 'Syncing...' : '↻ Sync Now'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modalDangerBtn, { flex: 1 }]} 
                      onPress={() => handleDisconnectPlatform(managePlatform.id)}
                    >
                      <Text style={styles.modalDangerBtnText}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.quickSampleBtn, { marginTop: 8 }]}
                  onPress={() => {
                    const pid = managePlatform.id;
                    setManagePlatform(null);
                    handleOAuthConnect(pid);
                  }}
                >
                  <Text style={styles.quickSampleText}>↻ Re-authenticate / Reconnect Account</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

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

  // ─── Modal Styles ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)' } : {})
  },
  modalContent: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alreadyConnectedBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    marginBottom: 20,
  },
  modalTabs: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modalTabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalTabBtnActive: {
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }),
  },
  modalTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  modalTabTextActive: {
    color: '#000',
  },
  tabBody: {
    gap: 16,
  },
  modalDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  modalInput: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#000',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
  },
  errorBannerText: {
    color: '#dc2626',
    fontSize: 13,
    lineHeight: 18,
  },
  successBanner: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 12,
  },
  successBannerText: {
    color: '#16a34a',
    fontSize: 13,
    fontWeight: '600',
  },
  modalPrimaryBtn: {
    backgroundColor: '#000',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  modalPrimaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalSecondaryBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    color: '#333',
    fontSize: 13,
    fontWeight: '600',
  },
  modalDangerBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modalDangerBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  quickSampleBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  quickSampleText: {
    fontSize: 12,
    color: '#9d50ff',
    fontWeight: '600',
  },
  googleOAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: 8,
  },
  googleOAuthBtnText: {
    color: '#222',
    fontSize: 14,
    fontWeight: '700',
  },
});
