import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Platform, Image, TouchableOpacity, Modal, TextInput, ActivityIndicator, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { 
  fetchPlatformData, 
  syncPlatformData, 
  isPlatformMatch, 
  normalizePlatformKey, 
  connectYouTubeViaApiKey, 
  connectTwitchViaApiKey, 
  connectXViaApiKey, 
  connectInstagramViaApiKey, 
  connectFacebookViaApiKey, 
  connectLinkedInViaApiKey, 
  disconnectPlatform 
} from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

export const PLATFORMS_CONFIG = {
  'YouTube': { 
    id: 'yt', 
    name: 'YouTube',
    color: '#FF0000', 
    bg: 'rgba(255,0,0,0.08)',    
    logo: 'https://img.icons8.com/color/512/youtube-play.png',
    portalUrl: 'https://console.cloud.google.com/apis/credentials',
    portalLabel: 'Google Cloud Console ↗',
    defaultHandle: '@GoogleDevelopers',
    type: 'Video & Streaming',
    metricLabels: ['Subscribers', 'Total Views', 'Engagement', 'Est. Revenue'],
    oauthProvider: 'google',
    oauthScopes: 'https://www.googleapis.com/auth/youtube.readonly',
    oauthText: 'Continue with Google OAuth',
    profileUrlPrefix: 'https://youtube.com/'
  },
  'Twitch': { 
    id: 'twitch', 
    name: 'Twitch',
    color: '#9146FF', 
    bg: 'rgba(145,70,255,0.08)', 
    logo: 'https://img.icons8.com/color/512/twitch--v1.png',
    portalUrl: 'https://dev.twitch.tv/console/apps',
    portalLabel: 'dev.twitch.tv/console ↗',
    defaultHandle: 'shroud',
    type: 'Live Broadcasting',
    metricLabels: ['Followers', 'Total Views', 'Avg Viewers', 'Sub Revenue'],
    oauthProvider: null,
    oauthText: 'Connect via Twitch API',
    profileUrlPrefix: 'https://twitch.tv/'
  },
  'X (Twitter)': { 
    id: 'x', 
    name: 'X (Twitter)',
    color: '#000000', 
    bg: 'rgba(0,0,0,0.04)',      
    logo: 'https://img.icons8.com/ios-filled/512/twitterx--v1.png',
    portalUrl: 'https://developer.x.com/en/portal/dashboard',
    portalLabel: 'developer.x.com ↗',
    defaultHandle: 'TwitterDev',
    type: 'Microblogging & Threads',
    metricLabels: ['Followers', 'Impressions', 'Engagement', 'Profile Visits'],
    oauthProvider: 'x',
    oauthScopes: 'tweet.read users.read offline.access',
    oauthText: 'Continue with X (OAuth 2.0)',
    profileUrlPrefix: 'https://x.com/'
  },
  'Instagram': { 
    id: 'ig', 
    name: 'Instagram', 
    color: '#E1306C', 
    bg: 'rgba(225,48,108,0.08)', 
    logo: 'https://img.icons8.com/fluent/512/instagram-new.png', 
    portalUrl: 'https://instagram.com', 
    portalLabel: 'instagram.com ↗', 
    defaultHandle: 'creators', 
    type: 'Photos, Reels & Stories', 
    metricLabels: ['Followers', 'Reel Views', 'Engagement', 'Reach Growth'], 
    oauthProvider: null, 
    oauthScopes: null, 
    oauthText: 'Sync via Instagram Handle', 
    profileUrlPrefix: 'https://instagram.com/' 
  },
  'Facebook': { 
    id: 'fb', 
    name: 'Facebook',
    color: '#1877F2', 
    bg: 'rgba(24,119,242,0.08)', 
    logo: 'https://img.icons8.com/color/512/facebook-new.png',
    portalUrl: 'https://developers.facebook.com/apps',
    portalLabel: 'developers.facebook.com ↗',
    defaultHandle: 'Meta',
    type: 'Pages & Social Network',
    metricLabels: ['Page Followers', 'Video Views', 'Engagement', 'Ad Revenue'],
    oauthProvider: 'facebook',
    oauthScopes: 'public_profile',
    oauthText: 'Continue with Facebook Login',
    profileUrlPrefix: 'https://facebook.com/'
  },
  'LinkedIn': { 
    id: 'in', 
    name: 'LinkedIn',
    color: '#0A66C2', 
    bg: 'rgba(10,102,194,0.08)', 
    logo: 'https://img.icons8.com/color/512/linkedin.png',
    portalUrl: 'https://www.linkedin.com/developers/apps',
    portalLabel: 'linkedin.com/developers ↗',
    defaultHandle: 'google',
    type: 'Professional Network',
    metricLabels: ['Connections', 'Impressions', 'Engagement', 'Follower Growth'],
    oauthProvider: 'linkedin_oidc',
    oauthScopes: 'openid profile email',
    oauthText: 'Continue with LinkedIn OIDC',
    profileUrlPrefix: 'https://linkedin.com/company/'
  },
};

export default function ConnectModal({ visible, onClose, initialPlatform = 'YouTube', onSuccess, platformData }) {
  const { colors, isDark } = useTheme();
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform);
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const [apiKeys, setApiKeys] = useState({});
  const [session, setSession] = useState(null);

  // Loaded analytics & posts per platform
  const [dbAnalytics, setDbAnalytics] = useState([]);
  const [dbContent, setDbContent] = useState([]);

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

  // X (Twitter) modal states
  const [xUsername, setXUsername] = useState('TwitterDev');
  const [xBearerToken, setXBearerToken] = useState('');
  const [xLoading, setXLoading] = useState(false);
  const [xModalError, setXModalError] = useState('');
  const [xModalSuccess, setXModalSuccess] = useState('');

  // Instagram modal states
  const [igUsername, setIgUsername] = useState('creators');
  const [igLoading, setIgLoading] = useState(false);
  const [igModalError, setIgModalError] = useState('');
  const [igModalSuccess, setIgModalSuccess] = useState('');

  // Facebook modal states
  const [fbPageName, setFbPageName] = useState('Meta');
  const [fbAccessToken, setFbAccessToken] = useState('');
  const [fbLoading, setFbLoading] = useState(false);
  const [fbModalError, setFbModalError] = useState('');
  const [fbModalSuccess, setFbModalSuccess] = useState('');

  // LinkedIn modal states
  const [inProfileName, setInProfileName] = useState('google');
  const [inAccessToken, setInAccessToken] = useState('');
  const [inLoading, setInLoading] = useState(false);
  const [inModalError, setInModalError] = useState('');
  const [inModalSuccess, setInModalSuccess] = useState('');

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
    const providerToPlatformMap = { 
      'google': 'yt', 
      'facebook': 'fb', 
      'twitter': 'x', 
      'x': 'x', 
      'linkedin_oidc': 'in', 
      'linkedin': 'in' 
    };
    const identityPlatforms = identities.map(id => providerToPlatformMap[id.provider]).filter(Boolean);

    const keys = profile?.api_keys || {};
    const keyPlatforms = [];
    if (keys.youtube || keys.yt || keys.youtube_channel_id || keys.youtube_token) keyPlatforms.push('yt');
    if (keys.twitch || keys.twitch_username || keys.twitch_login || keys.twitch_channel_id) keyPlatforms.push('twitch');
    if (keys.x || keys.x_username || keys.twitter_username || keys.twitter || keys.x_bearer_token) keyPlatforms.push('x');
    if (keys.ig || keys.ig_username || keys.instagram_username || keys.ig_token) keyPlatforms.push('ig');
    if (keys.fb || keys.fb_page || keys.facebook_page || keys.fb_token) keyPlatforms.push('fb');
    if (keys.in || keys.in_profile || keys.linkedin_profile || keys.in_token) keyPlatforms.push('in');

    const [anRes, contentRes] = await Promise.all([
      supabase.from('analytics').select('platform, total_followers, total_views, engagement_rate, estimated_revenue').eq('user_id', currentSession.user.id),
      supabase.from('content').select('id, title, platform, views, engagement, thumbnail_url, published_at').eq('user_id', currentSession.user.id).order('views', { ascending: false }).limit(20)
    ]);

    const anRows = anRes.data || [];
    setDbAnalytics(anRows);
    setDbContent(contentRes.data || []);

    const anPlatforms = anRows.map(r => normalizePlatformKey(r.platform)).filter(Boolean);

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
      if (platforms.includes('yt')) {
        const rawKey = typeof profile.api_keys.youtube === 'object'
          ? (profile.api_keys.youtube.apiKey || profile.api_keys.youtube.token || '')
          : (profile.api_keys.youtube || profile.api_keys.yt || '');
        const rawChan = profile.api_keys.youtube_channel_id || profile.api_keys.yt_channel_id || '';
        if (rawKey) setYtApiKey(rawKey);
        if (rawChan) setYtChannelId(rawChan);
      }
      if (platforms.includes('twitch')) {
        if (profile.api_keys.twitch_username) setTwitchUsername(profile.api_keys.twitch_username);
      }
      if (platforms.includes('x')) {
        if (profile.api_keys.x_username) setXUsername(profile.api_keys.x_username);
      }
      if (platforms.includes('ig')) {
        if (profile.api_keys.ig_username) setIgUsername(profile.api_keys.ig_username);
      }
      if (platforms.includes('fb')) {
        if (profile.api_keys.fb_page) setFbPageName(profile.api_keys.fb_page);
      }
      if (platforms.includes('in')) {
        if (profile.api_keys.in_profile) setInProfileName(profile.api_keys.in_profile);
      }
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
      setTwitchModalError('');
      setTwitchModalSuccess('');
      setXModalError('');
      setXModalSuccess('');
      setIgModalError('');
      setIgModalSuccess('');
      setFbModalError('');
      setFbModalSuccess('');
      setInModalError('');
      setInModalSuccess('');
      loadData();
    }
  }, [visible, initialPlatform]);

  // Current selected platform config
  const config = PLATFORMS_CONFIG[selectedPlatform] || PLATFORMS_CONFIG['YouTube'];
  const pKey = config.id;
  const isConnected = connectedPlatforms.some(p => isPlatformMatch(p, pKey));

  // Current stats for the selected platform
  const platformStats = platformData?.platformStats?.[selectedPlatform] || platformData?.platformStats?.[pKey];
  const dbStatRow = dbAnalytics.find(a => isPlatformMatch(a.platform, pKey));

  const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    const n = Number(num);
    if (isNaN(n)) return String(num);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  const followersCount = platformStats?.followers || formatNumber(dbStatRow?.total_followers) || '0';
  const viewsCount = platformStats?.views || formatNumber(dbStatRow?.total_views) || '0';
  const engageRate = platformStats?.engage || (dbStatRow?.engagement_rate ? `${dbStatRow.engagement_rate}%` : '0.0%');
  const revenueVal = dbStatRow?.estimated_revenue ? `$${Number(dbStatRow.estimated_revenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';

  // Filter synced content for this platform
  const recentContent = (platformData?.topContent || dbContent || []).filter(c => isPlatformMatch(c.platform, pKey));

  // Identifier handle
  let channelHandle = '';
  if (pKey === 'yt') {
    channelHandle = apiKeys.youtube_channel_title || apiKeys.youtube_channel_id || '@GoogleDevelopers';
  } else if (pKey === 'twitch') {
    channelHandle = apiKeys.twitch_channel_title || apiKeys.twitch_username || 'shroud';
  } else if (pKey === 'x') {
    channelHandle = apiKeys.x_username ? `@${apiKeys.x_username.replace(/^@/, '')}` : '@TwitterDev';
  } else if (pKey === 'ig') {
    channelHandle = apiKeys.ig_username ? `@${apiKeys.ig_username.replace(/^@/, '')}` : '@creators';
  } else if (pKey === 'fb') {
    channelHandle = apiKeys.fb_page || 'Meta';
  } else if (pKey === 'in') {
    channelHandle = apiKeys.in_profile ? `@${apiKeys.in_profile.replace(/^@/, '')}` : '@google';
  }

  // Profile URL
  const profileUrl = config.profileUrlPrefix 
    ? `${config.profileUrlPrefix}${channelHandle.replace(/^@/, '')}` 
    : 'https://google.com';

  // ─── Handlers ───

  // YouTube
  async function handleApiKeyConnect(customKey, customChannel) {
    const keyToUse = (customKey !== undefined ? customKey : ytApiKey).trim();
    const chanToUse = (customChannel !== undefined ? customChannel : ytChannelId).trim();

    if (!keyToUse) {
      setYtModalError('Please enter a YouTube Data API Key or continue with Google.');
      return;
    }
    if (!chanToUse) {
      setYtModalError('Please enter a YouTube Channel Handle or ID.');
      return;
    }

    setYtLoading(true);
    setYtModalError('');
    setYtModalSuccess('');
    try {
      const channelData = await connectYouTubeViaApiKey(keyToUse, chanToUse);
      setYtModalSuccess(`Successfully connected to: ${channelData.channel.title}!`);
      await loadData();
      if (onSuccess) await onSuccess();
      setTimeout(() => {
        setYtModalSuccess('');
        onClose();
      }, 1200);
    } catch (err) {
      setYtModalError(err.message || 'Failed to connect YouTube channel.');
    } finally {
      setYtLoading(false);
    }
  }

  // Twitch
  async function handleTwitchConnect(customId, customSecret, customUser) {
    const idToUse = (customId !== undefined ? customId : twitchClientId).trim();
    const secToUse = (customSecret !== undefined ? customSecret : twitchClientSecret).trim();
    const userToUse = (customUser !== undefined ? customUser : twitchUsername).trim();

    if (!userToUse) {
      setTwitchModalError('Please enter a Twitch username/channel handle.');
      return;
    }
    if (!idToUse || !secToUse) {
      setTwitchModalError('Please enter your Twitch Client ID & Secret.');
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

  // X (Twitter)
  async function handleXConnect(customToken, customUser) {
    const tokenToUse = (customToken !== undefined ? customToken : xBearerToken).trim();
    const userToUse = (customUser !== undefined ? customUser : xUsername).trim();

    setXLoading(true);
    setXModalError('');
    setXModalSuccess('');
    try {
      await connectXViaApiKey(tokenToUse, userToUse || 'TwitterDev');
      setXModalSuccess(`Connected @${(userToUse || 'TwitterDev').replace(/^@/, '')} successfully!`);
      await loadData();
      if (onSuccess) await onSuccess();
      setTimeout(() => {
        setXModalSuccess('');
        onClose();
      }, 1200);
    } catch (err) {
      setXModalError(err.message || 'Failed to connect X account.');
    } finally {
      setXLoading(false);
    }
  }

  // Instagram
  async function handleInstagramConnect(customToken, customUser) {
    const userToUse = (customUser !== undefined ? customUser : igUsername).trim();

    if (!userToUse) {
      setIgModalError('Please enter an Instagram username or handle.');
      return;
    }

    setIgLoading(true);
    setIgModalError('');
    setIgModalSuccess('');
    try {
      const data = await connectInstagramViaApiKey(userToUse);
      setIgModalSuccess(`Connected @${userToUse.replace(/^@/, '')} successfully!`);
      await loadData();
      if (onSuccess) await onSuccess();
      setTimeout(() => {
        setIgModalSuccess('');
        onClose();
      }, 1200);
    } catch (err) {
      setIgModalError(err.message || 'Failed to connect Instagram account.');
    } finally {
      setIgLoading(false);
    }
  }

  async function handleQuickInfluencerConnect(username) {
    setIgUsername(username);
    await handleInstagramConnect('', username);
  }

  // Facebook
  async function handleFacebookConnect(customToken, customPage) {
    const tokenToUse = (customToken !== undefined ? customToken : fbAccessToken).trim();
    const pageToUse = (customPage !== undefined ? customPage : fbPageName).trim();

    setFbLoading(true);
    setFbModalError('');
    setFbModalSuccess('');
    try {
      const data = await connectFacebookViaApiKey(pageToUse || 'Meta', tokenToUse);
      setFbModalSuccess(`Connected "${pageToUse || 'Meta'}" page successfully!`);
      await loadData();
      if (onSuccess) await onSuccess();
      setTimeout(() => {
        setFbModalSuccess('');
        onClose();
      }, 1200);
    } catch (err) {
      setFbModalError(err.message || 'Failed to connect Facebook page.');
    } finally {
      setFbLoading(false);
    }
  }

  // LinkedIn
  async function handleLinkedInConnect(customToken, customProfile) {
    const tokenToUse = (customToken !== undefined ? customToken : inAccessToken).trim();
    const profileToUse = (customProfile !== undefined ? customProfile : inProfileName).trim();

    setInLoading(true);
    setInModalError('');
    setInModalSuccess('');
    try {
      const data = await connectLinkedInViaApiKey(profileToUse || 'google', tokenToUse);
      setInModalSuccess(`Connected "${profileToUse || 'google'}" successfully!`);
      await loadData();
      if (onSuccess) await onSuccess();
      setTimeout(() => {
        setInModalSuccess('');
        onClose();
      }, 1200);
    } catch (err) {
      setInModalError(err.message || 'Failed to connect LinkedIn account.');
    } finally {
      setInLoading(false);
    }
  }

  // Universal Sync Now
  async function handleSyncPlatform(platformKey) {
    setActionLoading(true);
    setModalError('');
    setModalSuccess('');
    try {
      await syncPlatformData([platformKey]);
      await loadData();
      if (onSuccess) await onSuccess();
      setModalSuccess(`${selectedPlatform} data refreshed successfully!`);
      setTimeout(() => setModalSuccess(''), 2000);
    } catch (e) {
      setModalError(e.message || 'Sync failed');
    } finally {
      setActionLoading(false);
    }
  }

  // Universal Disconnect
  async function handleDisconnect(platformKey) {
    setActionLoading(true);
    setModalError('');
    try {
      setConnectedPlatforms(prev => prev.filter(p => !isPlatformMatch(p, platformKey)));
      if (platformKey === 'yt') {
        setYtApiKey('');
        setYtChannelId('');
      } else if (platformKey === 'twitch') {
        setTwitchUsername('');
        setTwitchClientId('');
        setTwitchClientSecret('');
      } else if (platformKey === 'x') {
        setXUsername('');
        setXBearerToken('');
      } else if (platformKey === 'ig') {
        setIgUsername('');
        setIgAccessToken('');
      } else if (platformKey === 'fb') {
        setFbPageName('');
        setFbAccessToken('');
      } else if (platformKey === 'in') {
        setInProfileName('');
        setInAccessToken('');
      }

      await disconnectPlatform(platformKey);
      await loadData();
      if (onSuccess) await onSuccess();
      setModalSuccess(`${selectedPlatform} disconnected.`);
      setTimeout(() => setModalSuccess(''), 1200);
    } catch (e) {
      setModalError(e.message || 'Failed to disconnect');
    } finally {
      setActionLoading(false);
    }
  }

  // Universal OAuth Connect
  async function handleOAuthConnect(platformKey) {
    setActionLoading(true);
    setModalError('');
    
    let provider = '';
    let scopes = '';
    
    switch (platformKey) {
      case 'yt':
        provider = 'google';
        scopes = 'https://www.googleapis.com/auth/youtube.readonly';
        break;
      case 'fb':
        provider = 'facebook';
        scopes = 'public_profile';
        break;
      case 'x':
        provider = 'x';
        scopes = 'tweet.read users.read offline.access';
        break;
      case 'in':
        provider = 'linkedin_oidc';
        scopes = 'openid profile email';
        break;
    }

    if (provider) {
      await AsyncStorage.setItem('pending_connection', platformKey);
      const userIdentities = session?.user?.identities || [];
      const hasProviderIdentity = userIdentities.some(id => {
        if (platformKey === 'x') return id.provider === 'x' || id.provider === 'twitter';
        if (platformKey === 'yt') return id.provider === 'google';
        if (platformKey === 'fb') return id.provider === 'facebook';
        if (platformKey === 'in') return id.provider === 'linkedin_oidc' || id.provider === 'linkedin';
        return false;
      });

      const isAlreadyConnected = connectedPlatforms.some(p => isPlatformMatch(p, platformKey)) || hasProviderIdentity;
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

      if (error && (provider === 'x' || provider === 'twitter')) {
        const altProvider = provider === 'x' ? 'twitter' : 'x';
        const altAttempt = await authMethod.call(supabase.auth, {
          provider: altProvider,
          options: oauthOptions
        });
        if (!altAttempt.error && altAttempt.data?.url) {
          data = altAttempt.data;
          error = null;
        }
      }

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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContent, 
          { 
            backgroundColor: colors.cardBg, 
            borderColor: colors.border, 
            borderWidth: 1 
          }
        ]}>
          
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[
                styles.headerIconWrap, 
                { backgroundColor: isDark ? '#ffffff' : config.bg, borderColor: isDark ? '#ffffff' : 'transparent' }
              ]}>
                <Image source={{ uri: config.logo }} style={{ width: 22, height: 22 }} resizeMode="contain" />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {config.name}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '500' }}>
                  {config.type}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.modalCloseBtn, { backgroundColor: colors.badgeBg }]}>
              <Text style={{ fontSize: 16, color: colors.textSecondary, fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Platform Selector Carousel / Tabs */}
          <View style={{ marginBottom: 16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.platformPickerRow}>
                {Object.entries(PLATFORMS_CONFIG).map(([pName, pConf]) => {
                  const isActive = selectedPlatform === pName;
                  const isPConn = connectedPlatforms.some(p => isPlatformMatch(p, pConf.id));
                  return (
                    <TouchableOpacity
                      key={pName}
                      style={[
                        styles.platformPickerChip, 
                        { backgroundColor: colors.badgeBg, borderColor: colors.border },
                        isActive && { backgroundColor: isDark ? colors.accent : '#000', borderColor: isDark ? colors.accent : '#000' }
                      ]}
                      onPress={() => {
                        setSelectedPlatform(pName);
                        setModalError('');
                        setModalSuccess('');
                        setYtModalError('');
                        setYtModalSuccess('');
                        setTwitchModalError('');
                        setTwitchModalSuccess('');
                        setXModalError('');
                        setXModalSuccess('');
                        setIgModalError('');
                        setIgModalSuccess('');
                        setFbModalError('');
                        setFbModalSuccess('');
                        setInModalError('');
                        setInModalSuccess('');
                      }}
                    >
                      <View style={[
                        styles.chipIconWrap, 
                        { backgroundColor: isDark ? '#ffffff' : 'transparent' }
                      ]}>
                        <Image source={{ uri: pConf.logo }} style={{ width: 14, height: 14 }} resizeMode="contain" />
                      </View>
                      <Text style={[
                        styles.platformPickerChipText, 
                        { color: colors.textSecondary },
                        isActive && { color: '#ffffff' }
                      ]}>
                        {pName}
                      </Text>
                      {isPConn && (
                        <View style={styles.connectedSmallDot} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Scrollable Modal Body */}
          <ScrollView 
            style={styles.modalBodyScroll} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 10 }}
          >
            {isConnected ? (
              /* ═══════════════════════════════════════════════
                 CONNECTED PLATFORM DASHBOARD VIEW
                 ═══════════════════════════════════════════════ */
              <View style={styles.tabBody}>
                {/* Channel / Profile Status Banner */}
                <View style={[
                  styles.alreadyConnectedBox, 
                  { 
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.06)',
                    borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.2)'
                  }
                ]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>Channel Connected & Live Synced</Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => Linking.openURL(profileUrl)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600' }}>View Profile ↗</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? '#ffffff' : config.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                      <Image source={{ uri: config.logo }} style={{ width: 24, height: 24 }} resizeMode="contain" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
                        {channelHandle}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        {config.name} active data stream verified & delivering live metrics
                      </Text>
                    </View>
                  </View>

                  {/* 4-Card Performance KPI Grid */}
                  <View style={styles.kpiGrid}>
                    <View style={[styles.kpiBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                      <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{followersCount}</Text>
                      <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>{config.metricLabels[0]}</Text>
                    </View>
                    <View style={[styles.kpiBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                      <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{viewsCount}</Text>
                      <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>{config.metricLabels[1]}</Text>
                    </View>
                    <View style={[styles.kpiBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                      <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{engageRate}</Text>
                      <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>{config.metricLabels[2]}</Text>
                    </View>
                    <View style={[styles.kpiBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                      <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{revenueVal}</Text>
                      <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>{config.metricLabels[3]}</Text>
                    </View>
                  </View>

                  {/* Action Toolbar */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <TouchableOpacity 
                      style={[styles.modalSecondaryBtn, { flex: 1, backgroundColor: colors.cardBg, borderColor: colors.border }]} 
                      onPress={() => handleSyncPlatform(pKey)}
                      disabled={actionLoading}
                    >
                      <Text style={[styles.modalSecondaryBtnText, { color: colors.textPrimary }]}>
                        {actionLoading ? 'Syncing...' : '↻ Sync Live Data Now'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modalDangerBtn, { flex: 1, backgroundColor: colors.cardBg }]} 
                      onPress={() => handleDisconnect(pKey)}
                      disabled={actionLoading}
                    >
                      <Text style={styles.modalDangerBtnText}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Synced Content Section */}
                {recentContent && recentContent.length > 0 && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
                      Recent Synced Content
                    </Text>
                    <View style={{ gap: 8, marginTop: 8 }}>
                      {recentContent.slice(0, 3).map((item, idx) => (
                        <View 
                          key={item.id || idx} 
                          style={[
                            styles.contentCardRow, 
                            { backgroundColor: colors.badgeBg, borderColor: colors.border }
                          ]}
                        >
                          {item.thumbnail_url ? (
                            <Image source={{ uri: item.thumbnail_url }} style={styles.contentThumb} resizeMode="cover" />
                          ) : (
                            <View style={[styles.contentThumbPlaceholder, { backgroundColor: config.bg }]}>
                              <Image source={{ uri: config.logo }} style={{ width: 20, height: 20 }} resizeMode="contain" />
                            </View>
                          )}
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[styles.contentTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                              {item.title || 'Untitled Post'}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                              <Text style={[styles.contentSubMetric, { color: colors.textSecondary }]}>
                                👁️ {formatNumber(item.views)} views
                              </Text>
                              {item.engagement ? (
                                <Text style={[styles.contentSubMetric, { color: colors.accent }]}>
                                  🔥 {item.engagement}% engage
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
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
              </View>
            ) : (
              /* ═══════════════════════════════════════════════
                 NOT CONNECTED / CONNECT FLOW VIEW
                 ═══════════════════════════════════════════════ */
              <View style={styles.tabBody}>
                <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
                  Connect your {config.name} account to sync live audience metrics, video views, impressions, and top content into your StreamSync dashboard.
                </Text>

                {/* Specific platform connect content */}
                {selectedPlatform === 'YouTube' ? (
                  <View>
                    {/* Subtabs for YouTube: OAuth / API Key */}
                    <View style={[styles.modalTabs, { backgroundColor: colors.badgeBg }]}>
                      <TouchableOpacity 
                        style={[styles.modalTabBtn, ytTab === 'oauth' && [styles.modalTabBtnActive, { backgroundColor: colors.cardBg }]]}
                        onPress={() => setYtTab('oauth')}
                      >
                        <Text style={[styles.modalTabText, { color: colors.textSecondary }, ytTab === 'oauth' && [styles.modalTabTextActive, { color: colors.textPrimary }]]}>
                          Google OAuth (Recommended)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.modalTabBtn, ytTab === 'apikey' && [styles.modalTabBtnActive, { backgroundColor: colors.cardBg }]]}
                        onPress={() => setYtTab('apikey')}
                      >
                        <Text style={[styles.modalTabText, { color: colors.textSecondary }, ytTab === 'apikey' && [styles.modalTabTextActive, { color: colors.textPrimary }]]}>
                          API Key & Handle
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {ytTab === 'apikey' ? (
                      <View style={{ gap: 14 }}>
                        <View style={styles.formGroup}>
                          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>YOUTUBE DATA API KEY *</Text>
                          <TextInput
                            style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                            placeholder="e.g. AIzaSy..."
                            placeholderTextColor={colors.textSecondary}
                            value={ytApiKey}
                            onChangeText={setYtApiKey}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>CHANNEL HANDLE OR ID *</Text>
                          <TextInput
                            style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                            placeholder="e.g. @mkbhd, @GoogleDevelopers, or UC..."
                            placeholderTextColor={colors.textSecondary}
                            value={ytChannelId}
                            onChangeText={setYtChannelId}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </View>

                        {ytModalError ? (
                          <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{ytModalError}</Text></View>
                        ) : null}
                        {ytModalSuccess ? (
                          <View style={styles.successBanner}><Text style={styles.successBannerText}>{ytModalSuccess}</Text></View>
                        ) : null}

                        <TouchableOpacity 
                          style={[styles.modalPrimaryBtn, { backgroundColor: colors.btnPrimaryBg }, ytLoading && { opacity: 0.7 }]}
                          onPress={() => handleApiKeyConnect()}
                          disabled={ytLoading}
                        >
                          {ytLoading ? (
                            <ActivityIndicator size="small" color={colors.btnPrimaryText} />
                          ) : (
                            <Text style={[styles.modalPrimaryBtnText, { color: colors.btnPrimaryText }]}>Connect & Fetch Channel Data</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ gap: 14 }}>
                        <TouchableOpacity 
                          style={[styles.googleOAuthBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                          onPress={() => handleOAuthConnect('yt')}
                          disabled={actionLoading}
                        >
                          <Image source={{ uri: 'https://img.icons8.com/color/512/google-logo.png' }} style={{ width: 20, height: 20, marginRight: 10 }} />
                          <Text style={[styles.googleOAuthBtnText, { color: colors.textPrimary }]}>
                            {actionLoading ? 'Connecting to Google...' : 'Continue with Google'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : selectedPlatform === 'Twitch' ? (
                  <View style={{ gap: 14 }}>
                    <View style={styles.formGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>TWITCH CHANNEL USERNAME *</Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="e.g. shroud, ninja, or your channel"
                        placeholderTextColor={colors.textSecondary}
                        value={twitchUsername}
                        onChangeText={setTwitchUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>TWITCH CLIENT ID</Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="e.g. gp762nuuoqcoxypju8c569th9wz7q5"
                        placeholderTextColor={colors.textSecondary}
                        value={twitchClientId}
                        onChangeText={setTwitchClientId}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>TWITCH CLIENT SECRET</Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="e.g. ••••••••••••••••••••••••••••••••"
                        placeholderTextColor={colors.textSecondary}
                        value={twitchClientSecret}
                        onChangeText={setTwitchClientSecret}
                        secureTextEntry={true}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <TouchableOpacity onPress={() => Linking.openURL('https://dev.twitch.tv/console/apps')}>
                      <Text style={{ fontSize: 12, color: '#9146FF', fontWeight: '600' }}>
                        Need free Twitch API keys? Create at dev.twitch.tv/console ↗
                      </Text>
                    </TouchableOpacity>

                    {twitchModalError ? (
                      <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{twitchModalError}</Text></View>
                    ) : null}
                    {twitchModalSuccess ? (
                      <View style={styles.successBanner}><Text style={styles.successBannerText}>{twitchModalSuccess}</Text></View>
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
                  </View>
                ) : selectedPlatform === 'X (Twitter)' ? (
                  <View style={{ gap: 14 }}>
                    {/* 1-Click OAuth 2.0 */}
                    <TouchableOpacity 
                      style={[
                        styles.googleOAuthBtn, 
                        { 
                          backgroundColor: isDark ? '#ffffff' : '#000000', 
                          borderColor: isDark ? '#ffffff' : '#000000', 
                        }
                      ]} 
                      onPress={() => handleOAuthConnect('x')}
                      disabled={actionLoading}
                    >
                      <Image 
                        source={{ uri: PLATFORMS_CONFIG['X (Twitter)'].logo }} 
                        style={{ width: 18, height: 18, marginRight: 10, tintColor: isDark ? '#000000' : '#ffffff' }} 
                      />
                      <Text style={[styles.googleOAuthBtnText, { color: isDark ? '#000000' : '#ffffff' }]}>
                        {actionLoading ? "Connecting with X..." : "Continue with X (OAuth 2.0)"}
                      </Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                      <Text style={{ marginHorizontal: 10, fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>
                        OR CONNECT VIA HANDLE / BEARER TOKEN
                      </Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>X (TWITTER) USERNAME / HANDLE *</Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="e.g. TwitterDev, elonmusk, or your handle"
                        placeholderTextColor={colors.textSecondary}
                        value={xUsername}
                        onChangeText={setXUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>X API BEARER TOKEN (OPTIONAL)</Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="e.g. Enter your X Bearer Token"
                        placeholderTextColor={colors.textSecondary}
                        value={xBearerToken}
                        onChangeText={setXBearerToken}
                        secureTextEntry={true}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <TouchableOpacity onPress={() => Linking.openURL('https://developer.x.com/en/portal/dashboard')}>
                      <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600' }}>
                        Get your Bearer Token at developer.x.com ↗
                      </Text>
                    </TouchableOpacity>

                    {xModalError ? (
                      <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{xModalError}</Text></View>
                    ) : null}
                    {xModalSuccess ? (
                      <View style={styles.successBanner}><Text style={styles.successBannerText}>{xModalSuccess}</Text></View>
                    ) : null}

                    <TouchableOpacity 
                      style={[styles.modalPrimaryBtn, { backgroundColor: colors.btnPrimaryBg }]} 
                      onPress={() => handleXConnect()}
                      disabled={xLoading}
                    >
                      {xLoading ? (
                        <ActivityIndicator color={colors.btnPrimaryText} size="small" />
                      ) : (
                        <Text style={[styles.modalPrimaryBtnText, { color: colors.btnPrimaryText }]}>Connect X Account</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : selectedPlatform === 'Instagram' ? (
                  <View style={{ gap: 14 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
                      Connect any Instagram creator or influencer profile to sync followers, reel views, engagement rates, and comments directly via StreamSync API.
                    </Text>

                    {/* Influencer Quick Presets */}
                    <View style={{ marginBottom: 4 }}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 8 }]}>POPULAR INFLUENCERS & CREATORS</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {[
                          { label: '@creators (14.8M)', user: 'creators' },
                          { label: '@mrbeast (62.4M)', user: 'mrbeast' },
                          { label: '@selenagomez (428M)', user: 'selenagomez' },
                          { label: '@natgeo (281M)', user: 'natgeo' },
                          { label: '@virat.kohli (271M)', user: 'viratkohli' },
                          { label: '@mkbhd (4.9M)', user: 'mkbhd' }
                        ].map(inf => {
                          const isSelected = (igUsername || '').toLowerCase().replace(/[@._]/g, '') === inf.user;
                          return (
                            <TouchableOpacity 
                              key={inf.user}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: isSelected ? '#E1306C' : colors.border,
                                backgroundColor: isSelected ? 'rgba(225,48,108,0.12)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)')
                              }}
                              onPress={() => handleQuickInfluencerConnect(inf.user)}
                              disabled={igLoading}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? '#E1306C' : colors.textPrimary }}>
                                {inf.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                      <Text style={{ marginHorizontal: 10, fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>
                        OR ENTER INSTAGRAM USERNAME / HANDLE
                      </Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>INSTAGRAM USERNAME / HANDLE *</Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="e.g. creators, mrbeast, or your handle"
                        placeholderTextColor={colors.textSecondary}
                        value={igUsername}
                        onChangeText={setIgUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    {igModalError ? (
                      <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{igModalError}</Text></View>
                    ) : null}
                    {igModalSuccess ? (
                      <View style={styles.successBanner}><Text style={styles.successBannerText}>{igModalSuccess}</Text></View>
                    ) : null}

                    <TouchableOpacity 
                      style={[styles.modalPrimaryBtn, { backgroundColor: '#E1306C' }]} 
                      onPress={() => handleInstagramConnect()}
                      disabled={igLoading}
                    >
                      {igLoading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.modalPrimaryBtnText}>Connect & Sync Influencer Data</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : selectedPlatform === 'Facebook' ? (
                  <View style={{ gap: 14 }}>
                    {/* 1-Click Facebook OAuth */}
                    <TouchableOpacity 
                      style={[
                        styles.googleOAuthBtn, 
                        { backgroundColor: '#1877F2', borderColor: '#1877F2' }
                      ]} 
                      onPress={() => handleOAuthConnect('fb')}
                      disabled={actionLoading}
                    >
                      <Image 
                        source={{ uri: PLATFORMS_CONFIG['Facebook'].logo }} 
                        style={{ width: 18, height: 18, marginRight: 10 }} 
                      />
                      <Text style={[styles.googleOAuthBtnText, { color: '#ffffff' }]}>
                        {actionLoading ? "Connecting to Facebook..." : "Continue with Facebook Login"}
                      </Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                      <Text style={{ marginHorizontal: 10, fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>
                        OR CONNECT VIA PAGE NAME / TOKEN
                      </Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>FACEBOOK PAGE NAME OR ID *</Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="e.g. Meta, StreamSync, or your page name"
                        placeholderTextColor={colors.textSecondary}
                        value={fbPageName}
                        onChangeText={setFbPageName}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>PAGE ACCESS TOKEN (OPTIONAL)</Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="e.g. Enter your Facebook Page Token"
                        placeholderTextColor={colors.textSecondary}
                        value={fbAccessToken}
                        onChangeText={setFbAccessToken}
                        secureTextEntry={true}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <TouchableOpacity onPress={() => Linking.openURL('https://developers.facebook.com/apps')}>
                      <Text style={{ fontSize: 12, color: '#1877F2', fontWeight: '600' }}>
                        Get Facebook Page Access Tokens at developers.facebook.com ↗
                      </Text>
                    </TouchableOpacity>

                    {fbModalError ? (
                      <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{fbModalError}</Text></View>
                    ) : null}
                    {fbModalSuccess ? (
                      <View style={styles.successBanner}><Text style={styles.successBannerText}>{fbModalSuccess}</Text></View>
                    ) : null}

                    <TouchableOpacity 
                      style={[styles.modalPrimaryBtn, { backgroundColor: '#1877F2' }]} 
                      onPress={() => handleFacebookConnect()}
                      disabled={fbLoading}
                    >
                      {fbLoading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.modalPrimaryBtnText}>Connect Facebook Page</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* LinkedIn */
                  <View style={{ gap: 14 }}>
                    {/* 1-Click LinkedIn OIDC */}
                    <TouchableOpacity 
                      style={[
                        styles.googleOAuthBtn, 
                        { backgroundColor: '#0A66C2', borderColor: '#0A66C2' }
                      ]} 
                      onPress={() => handleOAuthConnect('in')}
                      disabled={actionLoading}
                    >
                      <Image 
                        source={{ uri: PLATFORMS_CONFIG['LinkedIn'].logo }} 
                        style={{ width: 18, height: 18, marginRight: 10 }} 
                      />
                      <Text style={[styles.googleOAuthBtnText, { color: '#ffffff' }]}>
                        {actionLoading ? "Connecting to LinkedIn..." : "Continue with LinkedIn OIDC"}
                      </Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                      <Text style={{ marginHorizontal: 10, fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>
                        OR CONNECT VIA PROFILE / PAGE NAME
                      </Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>LINKEDIN PROFILE OR COMPANY HANDLE *</Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="e.g. google, microsoft, or your profile handle"
                        placeholderTextColor={colors.textSecondary}
                        value={inProfileName}
                        onChangeText={setInProfileName}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>LINKEDIN ACCESS TOKEN (OPTIONAL)</Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                        placeholder="e.g. Enter your LinkedIn Access Token"
                        placeholderTextColor={colors.textSecondary}
                        value={inAccessToken}
                        onChangeText={setInAccessToken}
                        secureTextEntry={true}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <TouchableOpacity onPress={() => Linking.openURL('https://www.linkedin.com/developers/apps')}>
                      <Text style={{ fontSize: 12, color: '#0A66C2', fontWeight: '600' }}>
                        Create a developer app at linkedin.com/developers ↗
                      </Text>
                    </TouchableOpacity>

                    {inModalError ? (
                      <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{inModalError}</Text></View>
                    ) : null}
                    {inModalSuccess ? (
                      <View style={styles.successBanner}><Text style={styles.successBannerText}>{inModalSuccess}</Text></View>
                    ) : null}

                    <TouchableOpacity 
                      style={[styles.modalPrimaryBtn, { backgroundColor: '#0A66C2' }]} 
                      onPress={() => handleLinkedInConnect()}
                      disabled={inLoading}
                    >
                      {inLoading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.modalPrimaryBtnText}>Connect LinkedIn Profile</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

        </View>
      </View>
    </Modal>
  );
}

const mono = Platform.OS === 'web' ? 'monospace' : undefined;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 580,
    maxHeight: '92%',
    padding: 22,
    ...(Platform.OS === 'web' ? { boxShadow: '0 20px 50px rgba(0,0,0,0.3)' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 25 }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformPickerRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  platformPickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  chipIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformPickerChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  connectedSmallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginLeft: 2,
  },
  modalBodyScroll: {
    flexGrow: 0,
  },
  tabBody: {
    gap: 14,
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  alreadyConnectedBox: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  kpiBox: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  contentCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  contentThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  contentThumbPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  contentSubMetric: {
    fontSize: 11,
    fontWeight: '500',
  },
  modalTabs: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
  },
  modalTabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalTabBtnActive: {
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } : {}),
  },
  modalTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalTabTextActive: {
    fontWeight: '700',
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    fontFamily: mono,
  },
  modalInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 10,
  },
  errorBannerText: {
    color: '#dc2626',
    fontSize: 12,
    lineHeight: 18,
  },
  successBanner: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 10,
  },
  successBannerText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '600',
  },
  modalPrimaryBtn: {
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  modalPrimaryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalSecondaryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalDangerBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '600',
  },
  googleOAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 13,
  },
  googleOAuthBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
