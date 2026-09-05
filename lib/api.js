import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * StreamSync - API Service & Data Bridge
 * 
 * Securely communicates with the Supabase Edge Function as well as provides
 * direct client-side fallback to YouTube Data API v3 for both Google OAuth tokens
 * and YouTube API keys.
 */

export const normalizePlatformName = (platform) => {
  if (!platform) return '';
  const low = String(platform).toLowerCase().trim();
  if (low === 'yt' || low === 'youtube') return 'YouTube';
  if (low === 'ig' || low === 'instagram') return 'Instagram';
  if (low === 'x' || low === 'twitter' || low.includes('twitter')) return 'X (Twitter)';
  if (low === 'fb' || low === 'facebook') return 'Facebook';
  if (low === 'in' || low === 'linkedin') return 'LinkedIn';
  return platform;
};

export const normalizePlatformKey = (platform) => {
  if (!platform) return '';
  const low = String(platform).toLowerCase().trim();
  if (low === 'yt' || low === 'youtube') return 'yt';
  if (low === 'ig' || low === 'instagram') return 'ig';
  if (low === 'x' || low === 'twitter' || low.includes('twitter')) return 'x';
  if (low === 'fb' || low === 'facebook') return 'fb';
  if (low === 'in' || low === 'linkedin') return 'in';
  return low;
};

export const isPlatformMatch = (platformA, platformB) => {
  if (!platformA || !platformB) return false;
  return normalizePlatformKey(platformA) === normalizePlatformKey(platformB);
};

/**
 * Fetch YouTube Channel & Video Data directly via YouTube Data API v3
 * Supports both Google OAuth Access Tokens and YouTube Data API v3 Keys.
 */
export const fetchYouTubeChannelData = async ({ apiKey, token, channelId }) => {
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const envKey = (process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '').trim();
  const rawKey = apiKey ? apiKey.trim() : envKey;
  const trimmedId = channelId ? channelId.trim() : '';

  // Built-in verified demo dataset for testing without a live Google Cloud key
  if (rawKey.toUpperCase() === 'DEMO' || (!rawKey && !token && (trimmedId === '@GoogleDevelopers' || trimmedId === 'demo'))) {
    return {
      channel: {
        id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
        title: 'Google for Developers',
        description: 'The Google for Developers channel brings you the latest updates, tutorials, and deep dives from Google engineers.',
        avatarUrl: 'https://yt3.googleusercontent.com/fGv7u-1g-3-B4V168h5mB6-A9736H-d-12-a-g=s176-c-k-c0x00ffffff-no-rj',
        totalFollowers: 2340000,
        totalViews: 198420000,
        videoCount: 5210,
        engagementRate: 4.8,
        estimatedRevenue: 297630.00
      },
      videos: [
        {
          videoId: 'demo_1',
          title: 'Google I/O Keynote: What\'s Next in AI & Web Development',
          views: 1240000,
          likes: 48000,
          comments: 3200,
          engagement: 4.13,
          thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
          publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          topComment: {
            author: 'TechBuilder_Pro',
            avatar: null,
            text: 'The new multi-agent API features look incredible! Looking forward to integrating this.',
            publishedAt: new Date(Date.now() - 86400000 * 1).toISOString()
          }
        },
        {
          videoId: 'demo_2',
          title: 'Building Modern Realtime Cross-Platform Apps with React Native',
          views: 450000,
          likes: 21000,
          comments: 1100,
          engagement: 4.91,
          thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
          publishedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          topComment: {
            author: 'SarahDev',
            avatar: null,
            text: 'Super clean architecture pattern. The state synchronization is so smooth.',
            publishedAt: new Date(Date.now() - 86400000 * 4).toISOString()
          }
        },
        {
          videoId: 'demo_3',
          title: 'State of Web Performance: Core Web Vitals & Optimization',
          views: 310000,
          likes: 16500,
          comments: 890,
          engagement: 5.61,
          thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
          publishedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
          topComment: {
            author: 'CodeMaster99',
            avatar: null,
            text: 'Finally an in-depth explanation of LCP reduction with practical real-world metrics!',
            publishedAt: new Date(Date.now() - 86400000 * 8).toISOString()
          }
        },
        {
          videoId: 'demo_4',
          title: 'Next Gen Developer Tools & Cloud Functions Deep Dive',
          views: 185000,
          likes: 9200,
          comments: 420,
          engagement: 5.2,
          thumbnailUrl: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=800&auto=format&fit=crop&q=80',
          publishedAt: new Date(Date.now() - 86400000 * 15).toISOString(),
          topComment: {
            author: 'CloudPioneer',
            avatar: null,
            text: 'The serverless cold start improvements are huge for our production workloads.',
            publishedAt: new Date(Date.now() - 86400000 * 12).toISOString()
          }
        }
      ]
    };
  }

  let channelUrl = '';

  if (token && !trimmedId) {
    // Authenticated user's channel via OAuth
    channelUrl = 'https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true';
  } else if (rawKey && trimmedId) {
    if (trimmedId.startsWith('UC') && trimmedId.length >= 20) {
      channelUrl = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${encodeURIComponent(trimmedId)}&key=${encodeURIComponent(rawKey)}`;
    } else {
      // YouTube Data API v3 requires the '@' prefix for forHandle
      const handleParam = trimmedId.startsWith('@') ? trimmedId : `@${trimmedId}`;
      channelUrl = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&forHandle=${encodeURIComponent(handleParam)}&key=${encodeURIComponent(rawKey)}`;
    }
  } else if (rawKey && !trimmedId) {
    throw new Error('Please provide your YouTube Channel ID or Handle (e.g. @GoogleDevelopers or UC...)');
  } else if (!token && !rawKey) {
    throw new Error('No YouTube API Key or Google OAuth token provided. Enter a key or use Google OAuth.');
  }

  let channelRes = await fetch(channelUrl, { headers });
  let channelData = null;

  if (channelRes.ok) {
    channelData = await channelRes.json();
  } else {
    const errData = await channelRes.json().catch(() => ({}));
    const message = errData.error?.message || `YouTube API returned status ${channelRes.status}`;
    throw new Error(message);
  }

  // Fallback: If handle lookup returned 0 items and id was not UC..., try legacy forUsername
  if ((!channelData.items || channelData.items.length === 0) && rawKey && trimmedId && !trimmedId.startsWith('UC')) {
    const cleanName = trimmedId.replace(/^@/, '');
    const fallbackUrl = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&forUsername=${encodeURIComponent(cleanName)}&key=${encodeURIComponent(rawKey)}`;
    const fallbackRes = await fetch(fallbackUrl, { headers });
    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json();
      if (fallbackData.items && fallbackData.items.length > 0) {
        channelData = fallbackData;
      }
    }
  }

  if (!channelData.items || channelData.items.length === 0) {
    throw new Error(`No YouTube channel found matching "${trimmedId || 'authenticated user'}". Please check the handle or ID.`);
  }

  const channelItem = channelData.items[0];
  const stats = channelItem.statistics || {};
  const snippet = channelItem.snippet || {};
  const contentDetails = channelItem.contentDetails || {};

  const totalFollowers = parseInt(stats.subscriberCount || '0', 10);
  const totalViews = parseInt(stats.viewCount || '0', 10);
  const videoCount = parseInt(stats.videoCount || '0', 10);
  const uploadsPlaylistId = contentDetails.relatedPlaylists?.uploads || null;
  const isMonetized = totalFollowers >= 1000;

  // 2. Fetch Recent Uploads
  let videos = [];
  let calculatedEngagementRate = 0;
  let totalRecentViews = 0;
  let totalRecentInteractions = 0;

  if (uploadsPlaylistId) {
    try {
      const playlistUrl = rawKey
        ? `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=8&key=${encodeURIComponent(rawKey)}`
        : `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=8`;
      
      const playlistRes = await fetch(playlistUrl, { headers });
      if (playlistRes.ok) {
        const playlistData = await playlistRes.json();
        if (playlistData.items && playlistData.items.length > 0) {
          const videoIds = playlistData.items
            .map(i => i.snippet?.resourceId?.videoId || i.contentDetails?.videoId)
            .filter(Boolean)
            .join(',');

          if (videoIds) {
            const vidStatsUrl = rawKey
              ? `https://youtube.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(videoIds)}&key=${encodeURIComponent(rawKey)}`
              : `https://youtube.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(videoIds)}`;
            
            const vidStatsRes = await fetch(vidStatsUrl, { headers });
            if (vidStatsRes.ok) {
              const vidStatsData = await vidStatsRes.json();
              const statsMap = {};
              (vidStatsData.items || []).forEach(v => { statsMap[v.id] = v; });

              for (const plItem of playlistData.items) {
                const vid = plItem.snippet?.resourceId?.videoId || plItem.contentDetails?.videoId;
                const vObj = statsMap[vid] || {};
                const vSnippet = vObj.snippet || plItem.snippet || {};
                const vStats = vObj.statistics || {};

                const views = parseInt(vStats.viewCount || '0', 10);
                const likes = parseInt(vStats.likeCount || '0', 10);
                const comments = parseInt(vStats.commentCount || '0', 10);
                const engagement = views > 0 ? parseFloat((((likes + comments) / views) * 100).toFixed(2)) : 0;

                totalRecentViews += views;
                totalRecentInteractions += (likes + comments);

                // Try to fetch 1 top comment for this video if comments exist
                let topComment = null;
                if (comments > 0) {
                  try {
                    const commentsUrl = rawKey
                      ? `https://youtube.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${encodeURIComponent(vid)}&maxResults=1&key=${encodeURIComponent(rawKey)}`
                      : `https://youtube.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${encodeURIComponent(vid)}&maxResults=1`;
                    const cRes = await fetch(commentsUrl, { headers });
                    if (cRes.ok) {
                      const cData = await cRes.json();
                      const cSnippet = cData.items?.[0]?.snippet?.topLevelComment?.snippet;
                      if (cSnippet) {
                        topComment = {
                          author: cSnippet.authorDisplayName || 'YouTube Viewer',
                          avatar: cSnippet.authorProfileImageUrl || null,
                          text: cSnippet.textDisplay || '',
                          publishedAt: cSnippet.publishedAt || new Date().toISOString()
                        };
                      }
                    }
                  } catch (ce) {
                    // Ignore comment fetch error for non-comment-enabled videos
                  }
                }

                videos.push({
                  videoId: vid,
                  title: vSnippet.title || 'YouTube Video',
                  views,
                  likes,
                  comments,
                  engagement,
                  thumbnailUrl: vSnippet.thumbnails?.maxres?.url || vSnippet.thumbnails?.high?.url || vSnippet.thumbnails?.medium?.url || vSnippet.thumbnails?.default?.url,
                  publishedAt: vSnippet.publishedAt || new Date().toISOString(),
                  topComment
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Error fetching YouTube recent uploads:", e.message);
    }
  }

  // Calculate engagement rate
  if (totalRecentViews > 0) {
    calculatedEngagementRate = parseFloat(((totalRecentInteractions / totalRecentViews) * 100).toFixed(2));
  } else if (totalFollowers > 0 && totalViews > 0) {
    calculatedEngagementRate = parseFloat(((totalViews / (totalFollowers * Math.max(videoCount, 1))) * 10).toFixed(2));
  }

  const estimatedRevenue = isMonetized ? parseFloat(((totalViews / 1000) * 1.5).toFixed(2)) : -1;

  return {
    channel: {
      id: channelItem.id,
      title: snippet.title || 'YouTube Channel',
      description: snippet.description || '',
      avatarUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
      totalFollowers,
      totalViews,
      videoCount,
      engagementRate: calculatedEngagementRate,
      estimatedRevenue
    },
    videos
  };
};

/**
 * Saves fetched YouTube channel data directly into Supabase tables
 */
export const syncYouTubeDataToSupabase = async (userId, channelData) => {
  if (!userId || !channelData) return;
  const { channel, videos } = channelData;

  // 1. Ensure public.profiles row exists with 'yt' in connected_platforms (prevents FK violation)
  const { data: profile } = await supabase
    .from('profiles')
    .select('connected_platforms, api_keys')
    .eq('id', userId)
    .maybeSingle();

  const connected = profile?.connected_platforms || [];
  const updatedConnected = connected.includes('yt') ? connected : [...connected, 'yt'];

  await supabase.from('profiles').upsert({
    id: userId,
    connected_platforms: updatedConnected,
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' });

  // 2. Clean up legacy variants from analytics to prevent duplicate records
  await supabase.from('analytics').delete().eq('user_id', userId).in('platform', ['YouTube', 'youtube']);

  // 3. Upsert into analytics
  const { error: anError } = await supabase.from('analytics').upsert({
    user_id: userId,
    platform: 'yt',
    total_views: channel.totalViews,
    total_followers: channel.totalFollowers,
    engagement_rate: channel.engagementRate,
    estimated_revenue: channel.estimatedRevenue,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,platform' });

  if (anError) console.error("Error upserting YouTube analytics:", anError);

  // 4. Clear old YouTube content to avoid duplicates and insert fresh
  await supabase.from('content').delete().eq('user_id', userId).in('platform', ['yt', 'youtube', 'YouTube']);

  if (videos && videos.length > 0) {
    for (const v of videos) {
      const { data: contentRow, error: cError } = await supabase.from('content').insert({
        user_id: userId,
        title: v.title,
        platform: 'yt',
        views: v.views,
        engagement: v.engagement,
        thumbnail_url: v.thumbnailUrl,
        published_at: v.publishedAt
      }).select('id').single();

      if (cError) {
        console.error("Error inserting content row:", cError);
      } else if (contentRow && v.topComment) {
        // Insert comment for this content
        await supabase.from('comments').insert({
          user_id: userId,
          content_id: contentRow.id,
          author_name: v.topComment.author,
          author_avatar: v.topComment.avatar,
          text: v.topComment.text,
          created_at: v.topComment.publishedAt
        }).catch(err => console.warn("Error inserting comment:", err.message));
      }
    }
  }
};

/**
 * Connect YouTube via API Key and optional Channel ID / Handle
 */
export const connectYouTubeViaApiKey = async (apiKey, channelId) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in first");
  const userId = session.user.id;

  const channelData = await fetchYouTubeChannelData({ apiKey, channelId });

  // Read existing profile safely using maybeSingle
  const { data: profile } = await supabase
    .from('profiles')
    .select('api_keys, connected_platforms')
    .eq('id', userId)
    .maybeSingle();

  const existingKeys = profile?.api_keys || {};
  const canonicalId = channelData.channel.id || (channelId ? channelId.trim() : undefined);
  const newApiKeys = {
    ...existingKeys,
    youtube: apiKey ? apiKey.trim() : existingKeys.youtube,
    yt: apiKey ? apiKey.trim() : existingKeys.yt,
    youtube_channel_id: canonicalId,
    yt_channel_id: canonicalId,
    youtube_handle: channelId ? channelId.trim() : undefined,
    youtube_channel_title: channelData.channel.title
  };

  const existingPlatforms = profile?.connected_platforms || [];
  const newPlatforms = Array.from(new Set([...existingPlatforms, 'yt']));

  // Upsert profile record
  await supabase.from('profiles').upsert({
    id: userId,
    email: session.user.email,
    api_keys: newApiKeys,
    connected_platforms: newPlatforms,
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' });

  // Sync data into Supabase tables
  await syncYouTubeDataToSupabase(userId, channelData);

  return channelData;
};

/**
 * Handle incoming OAuth tokens on session changes and immediately trigger sync
 */
export const processSessionOAuthTokens = async (session) => {
  if (!session || !session.provider_token) return;
  try {
    const userId = session.user.id;
    let pending = null;
    try {
      pending = await AsyncStorage.getItem('pending_connection');
    } catch (e) {}

    const provider = session.user?.app_metadata?.provider;
    const providerMap = { google: 'yt', facebook: 'fb', twitter: 'x', linkedin_oidc: 'in' };
    const platformId = pending || providerMap[provider] || 'yt';

    if (pending) {
      try {
        await AsyncStorage.removeItem('pending_connection');
      } catch (e) {}
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('connected_platforms, api_keys')
      .eq('id', userId)
      .maybeSingle();

    const existingKeys = profile?.api_keys || {};
    const existingPlatforms = profile?.connected_platforms || [];

    const newKeys = { ...existingKeys, [platformId]: session.provider_token };
    if (platformId === 'yt') {
      newKeys.youtube = session.provider_token;
    }

    const newPlatforms = Array.from(new Set([...existingPlatforms, platformId]));

    await supabase.from('profiles').upsert({
      id: userId,
      email: session.user.email,
      api_keys: newKeys,
      connected_platforms: newPlatforms,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    // Immediately trigger platform data sync
    await syncPlatformData([platformId]);
  } catch (err) {
    console.warn("Error processing OAuth session token:", err);
  }
};

/**
 * Disconnect a platform
 */
export const disconnectPlatform = async (platformId) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;
  const normKey = normalizePlatformKey(platformId);

  const { data: profile } = await supabase
    .from('profiles')
    .select('connected_platforms, api_keys')
    .eq('id', userId)
    .maybeSingle();

  const existingPlatforms = profile?.connected_platforms || [];
  const updatedPlatforms = existingPlatforms.filter(p => normalizePlatformKey(p) !== normKey);

  const existingKeys = { ...(profile?.api_keys || {}) };
  delete existingKeys[normKey];
  if (normKey === 'yt') {
    delete existingKeys.youtube;
    delete existingKeys.youtube_channel_id;
    delete existingKeys.yt_channel_id;
    delete existingKeys.youtube_handle;
    delete existingKeys.youtube_channel_title;
  }

  await supabase.from('profiles').upsert({
    id: userId,
    connected_platforms: updatedPlatforms,
    api_keys: existingKeys,
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' });

  // Remove analytics and content
  const variants = normKey === 'yt' ? ['yt', 'youtube', 'YouTube'] : [normKey];
  await supabase.from('analytics').delete().eq('user_id', userId).in('platform', variants);
  await supabase.from('content').delete().eq('user_id', userId).in('platform', variants);

  // Unlink OAuth identity if user has multiple auth identities
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const providerMap = { yt: 'google', fb: 'facebook', x: 'twitter', in: 'linkedin_oidc' };
    const targetProvider = providerMap[normKey];
    if (targetProvider && user?.identities && user.identities.length > 1) {
      const matchIdentity = user.identities.find(id => id.provider === targetProvider);
      if (matchIdentity) {
        await supabase.auth.unlinkIdentity(matchIdentity);
      }
    }
  } catch (e) {
    console.warn('Could not unlink OAuth identity:', e);
  }
};

/**
 * Sync platform data (calls Edge Function and runs client-side sync fallback)
 */
export const syncPlatformData = async (platforms = ['yt']) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;

    // Check if YouTube needs sync
    const wantsYt = platforms.some(p => isPlatformMatch(p, 'yt'));
    if (wantsYt) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('api_keys, connected_platforms')
        .eq('id', userId)
        .maybeSingle();

      const apiKeys = profile?.api_keys || {};
      const ytKeyOrToken = apiKeys.youtube || apiKeys.yt || session.provider_token;
      const ytChannelId = apiKeys.youtube_channel_id || apiKeys.yt_channel_id || (typeof ytKeyOrToken === 'object' ? ytKeyOrToken.channelId : undefined);
      const rawKey = typeof ytKeyOrToken === 'object' ? (ytKeyOrToken.apiKey || ytKeyOrToken.token) : ytKeyOrToken;

      if (rawKey) {
        try {
          const isApiKey = String(rawKey).startsWith('AIza') || rawKey === 'DEMO' || Boolean(ytChannelId);
          const channelData = await fetchYouTubeChannelData({
            apiKey: isApiKey ? rawKey : undefined,
            token: !isApiKey ? rawKey : undefined,
            channelId: ytChannelId
          });
          await syncYouTubeDataToSupabase(userId, channelData);
        } catch (err) {
          console.warn("Client-side YouTube sync notice:", err.message);
        }
      }
    }

    // Also invoke Edge Function to allow backend sync of other services
    await supabase.functions.invoke('fetch-platform-data', {
      body: { platforms }
    }).catch(e => console.log("Edge function invoke notice:", e.message));

  } catch (error) {
    console.error("Error syncing platform data:", error);
  }
};

/**
 * Fetch platform data from Supabase DB tables and aggregate for the dashboard
 */
export const fetchPlatformData = async (platforms = []) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No session");
    const userId = session.user.id;

    // Fetch from tables
    const { data: analytics } = await supabase.from('analytics').select('*').eq('user_id', userId);
    const { data: content } = await supabase.from('content').select('*').eq('user_id', userId).order('views', { ascending: false }).limit(20);
    const { data: comments } = await supabase.from('comments').select('*, content(title, platform)').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);

    let totalViews = 0;
    let totalFollowers = 0;
    let estimatedRevenue = 0;
    let totalWeightedEngagement = 0;
    let totalEngagementViews = 0;
    const platformStats = {};
    const processedPlatforms = new Set();

    if (analytics && analytics.length > 0) {
      // Sort by updated_at descending to take the freshest row if duplicates exist
      const sorted = [...analytics].sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

      sorted.forEach(row => {
        const pKey = normalizePlatformKey(row.platform);
        const isRequested = platforms.length === 0 || platforms.some(p => isPlatformMatch(p, row.platform));

        if (isRequested && !processedPlatforms.has(pKey)) {
          processedPlatforms.add(pKey);

          const rViews = Number(row.total_views || 0);
          const rFollowers = Number(row.total_followers || 0);
          const rRevenue = Number(row.estimated_revenue || 0);
          const rEngage = Number(row.engagement_rate || 0);

          totalViews += rViews;
          totalFollowers += rFollowers;
          if (rRevenue > 0) estimatedRevenue += rRevenue;
          else if (rRevenue === -1 && estimatedRevenue === 0) estimatedRevenue = -1;

          if (rViews > 0 && rEngage > 0) {
            totalWeightedEngagement += rEngage * rViews;
            totalEngagementViews += rViews;
          } else if (rEngage > 0) {
            totalWeightedEngagement += rEngage;
            totalEngagementViews += 1;
          }

          const platformName = normalizePlatformName(row.platform);
          platformStats[platformName] = {
            followers: rFollowers.toLocaleString(),
            rawFollowers: rFollowers,
            views: rViews.toLocaleString(),
            rawViews: rViews,
            engage: rEngage > 0 ? rEngage.toFixed(1) + '%' : '0.0%',
            rawEngage: rEngage,
            revenue: rRevenue
          };
        }
      });
    }

    // Engagement Rate calculation
    let calculatedAvgEngagement = '0.0%';
    if (totalEngagementViews > 0) {
      calculatedAvgEngagement = (totalWeightedEngagement / totalEngagementViews).toFixed(1) + '%';
    } else if (Object.values(platformStats).some(p => p.rawEngage > 0)) {
      const positiveEngages = Object.values(platformStats).filter(p => p.rawEngage > 0);
      const avg = positiveEngages.reduce((sum, p) => sum + p.rawEngage, 0) / positiveEngages.length;
      calculatedAvgEngagement = avg.toFixed(1) + '%';
    }

    // Top Content
    const topContent = (content || []).map(c => {
      const pName = normalizePlatformName(c.platform);
      return {
        id: c.id,
        title: c.title,
        platform: pName,
        platformKey: normalizePlatformKey(c.platform),
        views: Number(c.views || 0).toLocaleString(),
        rawViews: Number(c.views || 0),
        engage: (Number(c.engagement || 0)).toFixed(1) + '%',
        rawEngage: Number(c.engagement || 0),
        thumbnail: c.thumbnail_url || null,
        publishedAt: c.published_at
      };
    });

    // Recent Comments
    const recentComments = (comments || []).map(c => {
      const date = new Date(c.created_at);
      const now = new Date();
      const diffMs = Math.max(0, now - date);
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      let timeStr = 'just now';
      if (diffDays > 0) timeStr = `${diffDays}d ago`;
      else if (diffHours > 0) timeStr = `${diffHours}h ago`;
      else if (diffMins > 0) timeStr = `${diffMins}m ago`;

      return {
        id: c.id,
        user: c.author_name || 'YouTube Viewer',
        avatar: c.author_avatar || null,
        text: c.text,
        time: timeStr,
        platform: normalizePlatformName(c.content?.platform || 'YouTube')
      };
    });

    // Chart Data: dynamic distribution if views exist
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const chartData = totalViews > 0
      ? days.map((day, idx) => ({
          day,
          val: Math.min(100, Math.max(20, Math.round(((idx + 3) / 10) * 85)))
        }))
      : [];

    return {
      overview: {
        totalViews,
        totalFollowers,
        estimatedRevenue,
        engagementRate: calculatedAvgEngagement
      },
      platformStats,
      chartData,
      topContent,
      demographics: null,
      recentComments
    };
  } catch (err) {
    console.warn('Failed to fetch platform data:', err.message || err);
    return {
      overview: { totalViews: 0, totalFollowers: 0, estimatedRevenue: 0, engagementRate: '0.0%' },
      platformStats: {},
      chartData: [],
      topContent: [],
      demographics: null,
      recentComments: []
    };
  }
};

