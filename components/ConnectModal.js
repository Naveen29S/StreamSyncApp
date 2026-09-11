import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Platform, Image, TouchableOpacity, Modal, TextInput, ActivityIndicator, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { fetchPlatformData, syncPlatformData, isPlatformMatch, normalizePlatformKey, connectYouTubeViaApiKey, connectTwitchViaApiKey, disconnectPlatform } from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PLATFORMS = {
  YouTube:    { id: 'yt', color: '#FF0000', bg: 'rgba(255,0,0,0.08)',    logo: 'https://img.icons8.com/color/512/youtube-play.png' },
  Twitch:     { id: 'twitch', color: '#9146FF', bg: 'rgba(145,70,255,0.08)', logo: 'https://img.icons8.com/color/512/twitch--v1.png' },
  Instagram:  { id: 'ig', color: '#E1306C', bg: 'rgba(225,48,108,0.08)', logo: 'https://img.icons8.com/fluent/512/instagram-new.png' },
  'X (Twitter)': { id: 'x', color: '#000000', bg: 'rgba(0,0,0,0.04)',      logo: 'https://img.icons8.com/ios-filled/512/twitterx--v1.png' },
  Facebook:   { id: 'fb', color: '#1877F2', bg: 'rgba(24,119,242,0.08)', logo: 'https://img.icons8.com/color/512/facebook-new.png' },
  LinkedIn:   { id: 'in', color: '#0A66C2', bg: 'rgba(10,102,194,0.08)', logo: 'https://img.icons8.com/color/512/linkedin.png' },
};

export default function ConnectModal({ visible, onClose, initialPlatform = 'YouTube', onSuccess }) {
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform);
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const [apiKeys, setApiKeys] = useState({});
  const [session, setSession] = useState(null);

  // YouTube modal states
  const [ytTab, setYtTab] = useState('oauth'); // 'oauth' | 'apikey'
  const [ytApiKey, setYtApiKey] = useState('');
  const [ytChannelId, setYtChannelId] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [ytModalError, setYtModalError] = useState('');
  const [ytModalSuccess, setYtModalSuccess] = useState('');

  // Twitch modal states
  const [twitchUsername, setTwitchUsername] = useState('shroud');
  const [twitchClientId, setTwitchClientId] = useState('');
  const [twitchClientSecret, setTwitchClientSecret] = useState('');
  const [twitchLoading, setTwitchLoading] = useState(false);
  const [twitchModalError, setTwitchModalError] = useState('');
  const [twitchModalSuccess, setTwitchModalSuccess] = useState('');

  // General action states
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  const loadData = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) return;
    setSession(currentSession);

    const { data: profile } = await supabase
      .from('profiles')
      .select('connected_platforms, api_keys')
      .eq('id', currentSession.user.id)
      .maybeSingle();

    const identities = currentSession.user?.identities || [];
    const providerToPlatformMap = { 'google': 'yt', 'facebook': 'fb', 'twitter': 'x', 'linkedin_oidc': 'in', 'linkedin': 'in' };
    const identityPlatforms = identities.map(id => providerToPlatformMap[id.provider]).filter(Boolean);

    const apiKeys = profile?.api_keys || {};
    const keyPlatforms = [];
    if (apiKeys.youtube || apiKeys.yt || apiKeys.youtube_channel_id || apiKeys.youtube_token) {
      keyPlatforms.push('yt');
    }
    if (apiKeys.twitch || apiKeys.twitch_username || apiKeys.twitch_login || apiKeys.twitch_channel_id) {
      keyPlatforms.push('twitch');
    }

    const { data: anRows } = await supabase
      .from('analytics')
      .select('platform')
      .eq('user_id', currentSession.user.id);
    const anPlatforms = (anRows || []).map(r => normalizePlatformKey(r.platform)).filter(Boolean);

    const rawList = [
      ...(profile?.connected_platforms || []),
      ...identityPlatforms,
      ...keyPlatforms,
      ...anPlatforms
    ];
    const platforms = Array.from(new Set(rawList.map(p => normalizePlatformKey(p)).filter(Boolean)));
    setConnectedPlatforms(platforms);

    if (profile?.api_keys) {
      setApiKeys(profile.api_keys);
      const isYtConnected = platforms.includes('yt');
      if (isYtConnected) {
        const rawKey = typeof profile.api_keys.youtube === 'object'
          ? (profile.api_keys.youtube.apiKey || profile.api_keys.youtube.token || '')
          : (profile.api_keys.youtube || profile.api_keys.yt || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '');
        const rawChan = profile.api_keys.youtube_channel_id || profile.api_keys.yt_channel_id || (typeof profile.api_keys.youtube === 'object' ? profile.api_keys.youtube.channelId : '') || '';
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
  };

  useEffect(() => {
    if (visible) {
      setSelectedPlatform(initialPlatform || 'YouTube');
      setYtTab('oauth');
      setModalError('');
      setModalSuccess('');
      setYtModalError('');
      setYtModalSuccess('');
      loadData();
    }
  }, [visible, initialPlatform]);

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
      
      await loadData();
      if (onSuccess) {
        await onSuccess();
      }
      
      setTimeout(() => {
        onClose();
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
      await loadData();
      if (onSuccess) await onSuccess();
      setYtModalSuccess('Channel data refreshed successfully!');
      setTimeout(() => setYtModalSuccess(''), 2000);
    } catch (e) {
      setYtModalError(e.message || 'Sync failed');
    } finally {
      setYtLoading(false);
    }
  }

  async function handleTwitchConnect(customId, customSecret, customUser) {
    const idToUse = (customId !== undefined ? customId : twitchClientId).trim();
    const secToUse = (customSecret !== undefined ? customSecret : twitchClientSecret).trim();
    const userToUse = (customUser !== undefined ? customUser : twitchUsername).trim();

    if (!userToUse) {
      setTwitchModalError('Please enter a Twitch username/channel handle.');
      return;
    }
    if (!idToUse || !secToUse) {
      setTwitchModalError('Please enter Twitch Client ID & Secret (or click Quick Demo below).');
      return;
    }

    setTwitchLoading(true);
    setTwitchModalError('');
    setTwitchModalSuccess('');

    try {
      const channelData = await connectTwitchViaApiKey(idToUse, secToUse, userToUse);
      setTwitchModalSuccess(`Successfully connected to: ${channelData.channel.title}!`);
      await loadData();
      if (onSuccess) await onSuccess();
      setTimeout(() => {
        setTwitchModalSuccess('');
        onClose();
      }, 1200);
    } catch (err) {
      setTwitchModalError(err.message || 'Failed to connect Twitch channel.');
    } finally {
      setTwitchLoading(false);
    }
  }

  async function handleQuickDemoTwitchConnect() {
    setTwitchClientId('DEMO');
    setTwitchClientSecret('DEMO');
    setTwitchUsername('shroud');
    await handleTwitchConnect('DEMO', 'DEMO', 'shroud');
  }

  async function handleSyncTwitchNow() {
    setTwitchLoading(true);
    setTwitchModalError('');
    try {
      await syncPlatformData(['twitch']);
      await loadData();
      if (onSuccess) await onSuccess();
      setTwitchModalSuccess('Twitch stream data refreshed successfully!');
      setTimeout(() => setTwitchModalSuccess(''), 2000);
    } catch (e) {
      setTwitchModalError(e.message || 'Sync failed');
    } finally {
      setTwitchLoading(false);
    }
  }

  async function handleDisconnect(platformKey) {
    setActionLoading(true);
    setYtLoading(true);
    setTwitchLoading(true);
    setModalError('');
    setYtModalError('');
    setTwitchModalError('');
    try {
      // Optimistically clear local state immediately
      setConnectedPlatforms(prev => prev.filter(p => !isPlatformMatch(p, platformKey)));
      if (platformKey === 'yt') {
        setYtApiKey('');
        setYtChannelId('');
      }
      if (platformKey === 'twitch') {
        setTwitchUsername('');
        setTwitchClientId('');
        setTwitchClientSecret('');
      }

      await disconnectPlatform(platformKey);
      await loadData();
      if (onSuccess) {
        await onSuccess();
      }
      setModalSuccess('Platform disconnected.');
      setYtModalSuccess('Platform disconnected.');
      setTimeout(() => {
        setModalSuccess('');
        setYtModalSuccess('');
      }, 1000);
    } catch (e) {
      const msg = e.message || 'Failed to disconnect';
      setModalError(msg);
      setYtModalError(msg);
    } finally {
      setActionLoading(false);
      setYtLoading(false);
    }
  }

  async function handleSyncPlatform(platformKey) {
    setActionLoading(true);
    setModalError('');
    setModalSuccess('');
    try {
      await syncPlatformData([platformKey]);
      await loadData();
      if (onSuccess) await onSuccess();
      setModalSuccess('Platform data refreshed successfully!');
      setTimeout(() => setModalSuccess(''), 2000);
    } catch (e) {
      setModalError(e.message || 'Sync failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleOAuthConnect(platformKey) {
    setActionLoading(true);
    setModalError('');
    setYtModalError('');
    
    let provider = '';
    let scopes = '';
    
    switch (platformKey) {
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
      await AsyncStorage.setItem('pending_connection', platformKey);
      const isAlreadyConnected = connectedPlatforms.some(p => isPlatformMatch(p, platformKey));
      const authMethod = isAlreadyConnected ? supabase.auth.signInWithOAuth : supabase.auth.linkIdentity;
      
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/dashboard';
      const redirectUri = Platform.OS === 'web' ? (window.location.origin + currentPath) : undefined;

      const oauthOptions = {
        scopes: scopes ? scopes : undefined,
        redirectTo: redirectUri,
        queryParams: platformKey === 'yt' ? { access_type: 'offline', prompt: 'select_account consent' } : undefined,
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
        setModalError(error.message);
        setYtModalError(error.message);
        setActionLoading(false);
      } else if (data?.url) {
        if (Platform.OS === 'web') {
          window.location.href = data.url;
        } else {
          Linking.openURL(data.url);
          setActionLoading(false);
        }
      }
    } else {
      setActionLoading(false);
    }
  }

  const isYtConnected = connectedPlatforms.some(p => isPlatformMatch(p, 'yt'));

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {PLATFORMS[selectedPlatform] && (
                <Image source={{ uri: PLATFORMS[selectedPlatform].logo }} style={{ width: 24, height: 24 }} resizeMode="contain" />
              )}
              <Text style={styles.modalTitle}>
                {selectedPlatform} Connection
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Text style={{ fontSize: 16, color: '#666', fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Platform Selector Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
            <View style={styles.platformPickerRow}>
              {Object.keys(PLATFORMS).map((pName) => {
                const isActive = selectedPlatform === pName;
                const pConfig = PLATFORMS[pName];
                return (
                  <TouchableOpacity
                    key={pName}
                    style={[styles.platformPickerChip, isActive && styles.platformPickerChipActive]}
                    onPress={() => {
                      setSelectedPlatform(pName);
                      setModalError('');
                      setModalSuccess('');
                      setYtModalError('');
                      setYtModalSuccess('');
                    }}
                  >
                    <Image source={{ uri: pConfig.logo }} style={{ width: 14, height: 14 }} resizeMode="contain" />
                    <Text style={[styles.platformPickerChipText, isActive && styles.platformPickerChipTextActive]}>
                      {pName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Platform Body */}
          {selectedPlatform === 'YouTube' ? (
            <View>
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
                      onPress={() => handleDisconnect('yt')}
                      disabled={ytLoading}
                    >
                      <Text style={styles.modalDangerBtnText}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Subtabs for YouTube: OAuth / API Key */}
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

              {ytTab === 'apikey' ? (
                <View style={styles.tabBody}>
                  <Text style={styles.modalDesc}>
                    Enter your YouTube Data API v3 Key and channel Handle or ID to sync subscriber count, views, and videos.
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
                    disabled={actionLoading}
                  >
                    <Image source={{ uri: 'https://img.icons8.com/color/512/google-logo.png' }} style={{ width: 20, height: 20, marginRight: 10 }} />
                    <Text style={styles.googleOAuthBtnText}>
                      {actionLoading ? 'Connecting to Google...' : 'Continue with Google'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : selectedPlatform === 'Twitch' ? (
            /* Twitch Platform View */
            (() => {
              const isTwitchConn = connectedPlatforms.some(p => isPlatformMatch(p, 'twitch'));
              return (
                <View style={styles.tabBody}>
                  {isTwitchConn && (
                    <View style={styles.alreadyConnectedBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#9146FF' }} />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#9146FF' }}>Twitch Connected & Synced</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: '#444', marginTop: 4 }}>
                        {apiKeys.twitch_channel_title || apiKeys.twitch_username ? `Channel: ${apiKeys.twitch_channel_title || apiKeys.twitch_username}` : 'Your Twitch channel is actively connected.'}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                        <TouchableOpacity 
                          style={[styles.modalSecondaryBtn, { flex: 1 }]} 
                          onPress={handleSyncTwitchNow}
                          disabled={twitchLoading}
                        >
                          <Text style={styles.modalSecondaryBtnText}>
                            {twitchLoading ? 'Syncing...' : '↻ Sync Now'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.modalDangerBtn, { flex: 1 }]} 
                          onPress={() => handleDisconnect('twitch')}
                          disabled={twitchLoading}
                        >
                          <Text style={styles.modalDangerBtnText}>Disconnect</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <Text style={styles.modalDesc}>
                    Connect your Twitch channel to sync live stream viewers, total followers, game categories, and top broadcast clips in real time.
                  </Text>

                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>TWITCH CHANNEL USERNAME *</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="e.g. shroud, ninja, or your channel"
                      placeholderTextColor="#999"
                      value={twitchUsername}
                      onChangeText={setTwitchUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>TWITCH CLIENT ID</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="e.g. gp762nuuoqcoxypju8c569th9wz7q5"
                      placeholderTextColor="#999"
                      value={twitchClientId}
                      onChangeText={setTwitchClientId}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>TWITCH CLIENT SECRET</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="e.g. ••••••••••••••••••••••••••••••••"
                      placeholderTextColor="#999"
                      value={twitchClientSecret}
                      onChangeText={setTwitchClientSecret}
                      secureTextEntry={true}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <TouchableOpacity 
                    onPress={() => Linking.openURL('https://dev.twitch.tv/console/apps')}
                    style={{ marginBottom: 12 }}
                  >
                    <Text style={{ fontSize: 12, color: '#9146FF', fontWeight: '600' }}>
                      Need free Twitch API keys? Create a free app at dev.twitch.tv/console ↗
                    </Text>
                  </TouchableOpacity>

                  {twitchModalError ? (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorBannerText}>{twitchModalError}</Text>
                    </View>
                  ) : null}

                  {twitchModalSuccess ? (
                    <View style={[styles.errorBanner, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                      <Text style={[styles.errorBannerText, { color: '#166534' }]}>{twitchModalSuccess}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity 
                    style={[styles.modalPrimaryBtn, { backgroundColor: '#9146FF' }]} 
                    onPress={() => handleTwitchConnect()}
                    disabled={twitchLoading}
                  >
                    {twitchLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.modalPrimaryBtnText}>Connect Twitch Channel</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modalSecondaryBtn, { marginTop: 10, borderColor: '#9146FF' }]} 
                    onPress={handleQuickDemoTwitchConnect}
                    disabled={twitchLoading}
                  >
                    <Text style={[styles.modalSecondaryBtnText, { color: '#9146FF' }]}>⚡ Quick Demo: Test with Shroud Channel</Text>
                  </TouchableOpacity>
                </View>
              );
            })()
          ) : (
            /* Non-YouTube Platforms */
            (() => {
              const dbKeyMap = { 'Instagram': 'ig', 'X (Twitter)': 'x', 'Facebook': 'fb', 'LinkedIn': 'in' };
              const pKey = dbKeyMap[selectedPlatform];
              const isConn = connectedPlatforms.some(p => isPlatformMatch(p, pKey));

              return (
                <View style={styles.tabBody}>
                  {isConn ? (
                    <View style={styles.alreadyConnectedBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>Account Connected & Synced</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: '#444', marginTop: 4 }}>
                        Your {selectedPlatform} account is linked to your StreamSync profile.
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                        <TouchableOpacity 
                          style={[styles.modalSecondaryBtn, { flex: 1 }]} 
                          onPress={() => handleSyncPlatform(pKey)}
                          disabled={actionLoading}
                        >
                          <Text style={styles.modalSecondaryBtnText}>
                            {actionLoading ? 'Syncing...' : '↻ Sync Now'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.modalDangerBtn, { flex: 1 }]} 
                          onPress={() => handleDisconnect(pKey)}
                          disabled={actionLoading}
                        >
                          <Text style={styles.modalDangerBtnText}>Disconnect</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.modalDesc}>
                      Authorize StreamSync to connect with your {selectedPlatform} account to sync analytics, reach, and content.
                    </Text>
                  )}

                  {modalError ? (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorBannerText}>{modalError}</Text>
                    </View>
                  ) : null}

                  {modalSuccess ? (
                    <View style={styles.successBanner}>
                      <Text style={styles.successBannerText}>{modalSuccess}</Text>
                    </View>
                  ) : null}

                  {!isConn ? (
                    <TouchableOpacity 
                      style={[styles.modalPrimaryBtn, actionLoading && { opacity: 0.7 }]}
                      onPress={() => handleOAuthConnect(pKey)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.modalPrimaryBtnText}>Connect {selectedPlatform}</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={styles.quickSampleBtn}
                      onPress={() => handleOAuthConnect(pKey)}
                      disabled={actionLoading}
                    >
                      <Text style={styles.quickSampleText}>↻ Re-authenticate / Reconnect Account</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })()
          )}

        </View>
      </View>
    </Modal>
  );
}

const mono = Platform.OS === 'web' ? 'monospace' : undefined;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 520,
    padding: 24,
    ...(Platform.OS === 'web' ? { boxShadow: '0 20px 40px rgba(0,0,0,0.15)' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20 }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  platformPickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  platformPickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#eee',
  },
  platformPickerChipActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  platformPickerChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  platformPickerChipTextActive: {
    color: '#fff',
  },
  alreadyConnectedBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
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
    fontFamily: mono,
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
