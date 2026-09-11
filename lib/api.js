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
  if (low === 'twitch') return 'Twitch';
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
  if (low === 'twitch') return 'twitch';
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
export const fetchYouTubeChannelData = async ({ apiKey, token, channelId } = {}) => {
  const envKey = (process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '').trim();
  const rawInput = (token || apiKey || envKey || '').trim();
  const trimmedId = channelId ? channelId.trim() : '';

  // Built-in verified demo dataset for testing without a live Google Cloud key
  if (rawInput.toUpperCase() === 'DEMO' || (!rawInput && (trimmedId === '@GoogleDevelopers' || trimmedId === 'demo'))) {
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

  // Determine whether this is an OAuth Bearer token or API key
  const isOAuth = Boolean(token) || rawInput.startsWith('ya29.');
  const oauthToken = isOAuth ? (token || rawInput) : null;
  const apiKeyToUse = !isOAuth ? rawInput : null;

  const headers = {};
  if (isOAuth && oauthToken) {
    headers['Authorization'] = `Bearer ${oauthToken}`;
  }

  let channelUrl = '';

  if (isOAuth) {
    // Authenticated user's channel via OAuth: MUST call mine=true with Bearer token, NO &key=
    channelUrl = 'https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true';
  } else if (apiKeyToUse && trimmedId) {
    if (trimmedId.startsWith('UC') && trimmedId.length >= 20) {
      channelUrl = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${encodeURIComponent(trimmedId)}&key=${encodeURIComponent(apiKeyToUse)}`;
    } else {
      // YouTube Data API v3 requires the '@' prefix for forHandle
      const handleParam = trimmedId.startsWith('@') ? trimmedId : `@${trimmedId}`;
      channelUrl = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&forHandle=${encodeURIComponent(handleParam)}&key=${encodeURIComponent(apiKeyToUse)}`;
    }
  } else if (apiKeyToUse && !trimmedId) {
    throw new Error('Please provide your YouTube Channel ID or Handle (e.g. @GoogleDevelopers or UC...)');
  } else if (!isOAuth && !apiKeyToUse) {
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

  // Fallback: If handle lookup returned 0 items and id was not UC..., try legacy forUsername (API Key only)
  if (!isOAuth && (!channelData.items || channelData.items.length === 0) && apiKeyToUse && trimmedId && !trimmedId.startsWith('UC')) {
    const cleanName = trimmedId.replace(/^@/, '');
    const fallbackUrl = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&forUsername=${encodeURIComponent(cleanName)}&key=${encodeURIComponent(apiKeyToUse)}`;
    const fallbackRes = await fetch(fallbackUrl, { headers });
    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json();
      if (fallbackData.items && fallbackData.items.length > 0) {
        channelData = fallbackData;
      }
    }
  }

  if (!channelData.items || channelData.items.length === 0) {
    if (isOAuth) {
      throw new Error("No YouTube channel found for the signed-in Google account. Please ensure your Google account has a YouTube channel created.");
    }
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
      const playlistUrl = isOAuth
        ? `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=8`
        : `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=8&key=${encodeURIComponent(apiKeyToUse)}`;
      
      const playlistRes = await fetch(playlistUrl, { headers });
      if (playlistRes.ok) {
        const playlistData = await playlistRes.json();
        if (playlistData.items && playlistData.items.length > 0) {
          const videoIds = playlistData.items
            .map(i => i.snippet?.resourceId?.videoId || i.contentDetails?.videoId)
            .filter(Boolean)
            .join(',');

          if (videoIds) {
            const vidStatsUrl = isOAuth
              ? `https://youtube.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(videoIds)}`
              : `https://youtube.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(videoIds)}&key=${encodeURIComponent(apiKeyToUse)}`;
            
            const vidStatsRes = await fetch(vidStatsUrl, { headers });
            if (vidStatsRes.ok) {
              const vidStatsData = await vidStatsRes.json();
              const statsMap = {};
              (vidStatsData.items || []).forEach(v => { statsMap[v.id] = v; });

              const parsedVideos = [];
              for (const plItem of playlistData.items) {
                const vid = plItem.snippet?.resourceId?.videoId || plItem.contentDetails?.videoId;
                if (!vid) continue;
                const vObj = statsMap[vid] || {};
                const vSnippet = vObj.snippet || plItem.snippet || {};
                const vStats = vObj.statistics || {};

                const views = parseInt(vStats.viewCount || '0', 10);
                const likes = parseInt(vStats.likeCount || '0', 10);
                const comments = parseInt(vStats.commentCount || '0', 10);
                const engagement = views > 0 ? parseFloat((((likes + comments) / views) * 100).toFixed(2)) : 0;

                totalRecentViews += views;
                totalRecentInteractions += (likes + comments);

                parsedVideos.push({
                  videoId: vid,
                  title: vSnippet.title || 'YouTube Video',
                  views,
                  likes,
                  comments,
                  engagement,
                  thumbnailUrl: vSnippet.thumbnails?.maxres?.url || vSnippet.thumbnails?.high?.url || vSnippet.thumbnails?.medium?.url || vSnippet.thumbnails?.default?.url,
                  publishedAt: vSnippet.publishedAt || new Date().toISOString(),
                  topComment: null
                });
              }

              // Parallelize comments fetch for top 3 videos with comments (sub-second timeout)
              const commentCandidates = parsedVideos.filter(v => v.comments > 0).slice(0, 3);
              if (commentCandidates.length > 0) {
                await Promise.all(
                  commentCandidates.map(async (v) => {
                    try {
                      const controller = new AbortController();
                      const timeoutId = setTimeout(() => controller.abort(), 1000);
                      const commentsUrl = isOAuth
                        ? `https://youtube.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${encodeURIComponent(v.videoId)}&maxResults=1`
                        : `https://youtube.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${encodeURIComponent(v.videoId)}&maxResults=1&key=${encodeURIComponent(apiKeyToUse)}`;
                      
                      const cRes = await fetch(commentsUrl, { headers, signal: controller.signal });
                      clearTimeout(timeoutId);
                      if (cRes && cRes.ok) {
                        const cData = await cRes.json();
                        const cSnippet = cData.items?.[0]?.snippet?.topLevelComment?.snippet;
                        if (cSnippet) {
                          v.topComment = {
                            author: cSnippet.authorDisplayName || 'YouTube Viewer',
                            avatar: cSnippet.authorProfileImageUrl || null,
                            text: cSnippet.textDisplay || '',
                            publishedAt: cSnippet.publishedAt || new Date().toISOString()
                          };
                        }
                      }
                    } catch (ce) {
                      // Non-blocking timeout/error fallback
                    }
                  })
                );
              }

              videos = parsedVideos;
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
  console.time('syncYouTubeDataToSupabase');
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

  const existingKeys = profile?.api_keys || {};
  const updatedKeys = {
    ...existingKeys,
    youtube_channel_id: channel.id || existingKeys.youtube_channel_id,
    yt_channel_id: channel.id || existingKeys.yt_channel_id,
    youtube_channel_title: channel.title || existingKeys.youtube_channel_title,
  };

  await supabase.from('profiles').upsert({
    id: userId,
    connected_platforms: updatedConnected,
    api_keys: updatedKeys
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

  // 4. Batch delete and batch insert content & comments
  const { data: oldContent } = await supabase
    .from('content')
    .select('id')
    .eq('user_id', userId)
    .in('platform', ['yt', 'youtube', 'YouTube']);

  if (oldContent && oldContent.length > 0) {
    const oldIds = oldContent.map(c => c.id);
    await supabase.from('comments').delete().eq('user_id', userId).in('content_id', oldIds);
  }
  await supabase.from('content').delete().eq('user_id', userId).in('platform', ['yt', 'youtube', 'YouTube']);

  if (videos && videos.length > 0) {
    const contentRows = videos.map(v => ({
      user_id: userId,
      title: v.title,
      platform: 'yt',
      views: v.views,
      engagement: v.engagement,
      thumbnail_url: v.thumbnailUrl,
      published_at: v.publishedAt
    }));

    const { data: insertedRows, error: cError } = await supabase
      .from('content')
      .insert(contentRows)
      .select('id, title');

    if (cError) {
      console.error("Error batch inserting content rows:", cError);
    } else if (insertedRows && insertedRows.length > 0) {
      const commentsRows = [];
      insertedRows.forEach((row, idx) => {
        const v = videos[idx];
        if (v && v.topComment) {
          commentsRows.push({
            user_id: userId,
            content_id: row.id,
            author_name: v.topComment.author,
            author_avatar: v.topComment.avatar,
            text: v.topComment.text,
            created_at: v.topComment.publishedAt
          });
        }
      });

      if (commentsRows.length > 0) {
        const { error: comError } = await supabase.from('comments').insert(commentsRows);
        if (comError) {
          console.warn("Error batch inserting comments:", comError.message);
        }
      }
    }
  }

  console.timeEnd('syncYouTubeDataToSupabase');
  return { channel, videos };
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
    connected_platforms: newPlatforms
  }, { onConflict: 'id' });

  // Sync data into Supabase tables
  await syncYouTubeDataToSupabase(userId, channelData);

  return channelData;
};

/**
 * Fetch Twitch Channel & Stream Data directly via Twitch Helix API
 * Supports both Twitch Client ID + Client Secret and Built-in Quick Demo streamers.
 */
export const fetchTwitchChannelData = async ({ username, clientId, clientSecret } = {}) => {
  const envClientId = (process.env.EXPO_PUBLIC_TWITCH_CLIENT_ID || '').trim();
  const envClientSecret = (process.env.EXPO_PUBLIC_TWITCH_CLIENT_SECRET || '').trim();

  const cId = (clientId || envClientId || '').trim();
  const cSec = (clientSecret || envClientSecret || '').trim();
  const rawUser = (username || '').trim().replace(/^@/, '');
  const lowUser = rawUser.toLowerCase();

  // Built-in verified demo streamers (e.g. shroud, ninja) or demo mode
  const isDemo = cId.toUpperCase() === 'DEMO' || !cId || lowUser === 'shroud' || lowUser === 'ninja' || lowUser === 'demo' || !rawUser;
  if (isDemo && (!cId || cId.toUpperCase() === 'DEMO' || !cSec)) {
    const isNinja = lowUser === 'ninja';
    const streamerName = isNinja ? 'Ninja' : (rawUser && lowUser !== 'demo' ? rawUser : 'shroud');
    const streamerLogin = streamerName.toLowerCase();

    return {
      channel: {
        id: isNinja ? '19571641' : '37402112',
        login: streamerLogin,
        title: streamerName,
        description: isNinja 
          ? 'Professional gamer, streamer and content creator. Playing variety, shooters & battle royales.'
          : 'Former CS:GO Pro. Human Aimbot. Playing shooters, survival and variety games.',
        avatarUrl: isNinja 
          ? 'https://static-cdn.jtvnw.net/jtv_user_pictures/34f40f06-ea78-433b-ab1e-05572e4eb66f-profile_image-300x300.png'
          : 'https://static-cdn.jtvnw.net/jtv_user_pictures/7ed5e0c6-0191-4eab-832f-a6d138b85069-profile_image-300x300.png',
        totalFollowers: isNinja ? 19100000 : 10840000,
        totalViews: isNinja ? 578000000 : 421500000,
        videoCount: 1420,
        isLive: true,
        currentViewers: isNinja ? 18450 : 22100,
        currentGame: isNinja ? 'Fortnite' : 'VALORANT',
        streamTitle: isNinja ? 'CHILL WEEKEND GAMES | !sub !merch' : 'GRINDING RANKED RADIANT LOBBY | !gear !mouse',
        engagementRate: 5.4,
        estimatedRevenue: isNinja ? 38500.00 : 32400.00
      },
      videos: [
        {
          videoId: 'twitch_clip_1',
          title: isNinja ? '1v4 CLUTCH FOR THE VICTORY ROYALE!' : 'INSANE 1v5 ACE CLUTCH IN RADIANT LOBBY',
          views: isNinja ? 412000 : 385000,
          likes: isNinja ? 32000 : 28400,
          comments: isNinja ? 2400 : 1950,
          engagement: 6.2,
          thumbnailUrl: isNinja
            ? 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80'
            : 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop&q=80',
          publishedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          topComment: {
            author: 'AimbotGod',
            avatar: null,
            text: 'That flick on the third guy was unbelievable, peak gameplay!',
            publishedAt: new Date(Date.now() - 86400000 * 1).toISOString()
          }
        },
        {
          videoId: 'twitch_clip_2',
          title: isNinja ? 'NEW FORTNITE SEASON IS ACTUALLY INSANE' : 'Testing the New Agent: Broken or Balanced?',
          views: isNinja ? 289000 : 245000,
          likes: isNinja ? 18900 : 16200,
          comments: isNinja ? 1120 : 980,
          engagement: 5.8,
          thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80',
          publishedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          topComment: {
            author: 'StreamSniperX',
            avatar: null,
            text: 'The utility usage in this match was next level.',
            publishedAt: new Date(Date.now() - 86400000 * 2).toISOString()
          }
        },
        {
          videoId: 'twitch_clip_3',
          title: 'HIGHLIGHTS & FUNNY MOMENTS OF THE WEEK #42',
          views: 198000,
          likes: 12500,
          comments: 760,
          engagement: 5.1,
          thumbnailUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
          publishedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
          topComment: {
            author: 'PogChamp44',
            avatar: null,
            text: 'The jump scare reaction at 4:15 had me laughing so hard.',
            publishedAt: new Date(Date.now() - 86400000 * 5).toISOString()
          }
        }
      ]
    };
  }

  // Live Twitch Helix API call using Client Credentials
  if (!cId || !cSec) {
    throw new Error('Please enter both Twitch Client ID and Client Secret (or click "Quick Demo Channel" to test).');
  }
  if (!rawUser) {
    throw new Error('Please enter a Twitch username/channel handle.');
  }

  // 1. Get OAuth App Access Token from Twitch
  const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(cId)}&client_secret=${encodeURIComponent(cSec)}&grant_type=client_credentials`, {
    method: 'POST'
  });
  if (!tokenRes.ok) {
    const errJson = await tokenRes.json().catch(() => ({}));
    throw new Error(errJson.message || `Twitch authentication failed: HTTP ${tokenRes.status}. Check your Client ID & Secret.`);
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  const headers = {
    'Client-Id': cId,
    'Authorization': `Bearer ${accessToken}`
  };

  // 2. Fetch User Profile
  const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(lowUser)}`, { headers });
  if (!userRes.ok) {
    throw new Error(`Failed to fetch Twitch user: HTTP ${userRes.status}`);
  }
  const userData = await userRes.json();
  const userItem = userData.data?.[0];
  if (!userItem) {
    throw new Error(`Twitch channel "${rawUser}" not found.`);
  }

  // 3. Fetch Followers Count
  let totalFollowers = 0;
  try {
    const folRes = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(userItem.id)}`, { headers });
    if (folRes.ok) {
      const folData = await folRes.json();
      totalFollowers = folData.total || 0;
    }
  } catch (e) {
    console.warn("Could not fetch Twitch followers:", e);
  }

  // 4. Fetch Live Stream Status
  let isLive = false;
  let currentViewers = 0;
  let streamTitle = '';
  let currentGame = '';
  try {
    const streamRes = await fetch(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(userItem.id)}`, { headers });
    if (streamRes.ok) {
      const streamData = await streamRes.json();
      if (streamData.data && streamData.data.length > 0) {
        isLive = true;
        currentViewers = streamData.data[0].viewer_count || 0;
        streamTitle = streamData.data[0].title || '';
        currentGame = streamData.data[0].game_name || '';
      }
    }
  } catch (e) {
    console.warn("Could not fetch Twitch stream status:", e);
  }

  // 5. Fetch Recent Videos / Clips
  const videos = [];
  try {
    const vidRes = await fetch(`https://api.twitch.tv/helix/videos?user_id=${encodeURIComponent(userItem.id)}&first=5`, { headers });
    if (vidRes.ok) {
      const vidData = await vidRes.json();
      (vidData.data || []).forEach(v => {
        videos.push({
          videoId: v.id,
          title: v.title || 'Twitch Stream / VOD',
          views: v.view_count || 0,
          likes: Math.round((v.view_count || 0) * 0.05),
          comments: Math.round((v.view_count || 0) * 0.008),
          engagement: 4.5,
          thumbnailUrl: (v.thumbnail_url || '').replace('%{width}', '640').replace('%{height}', '360'),
          publishedAt: v.created_at,
          topComment: null
        });
      });
    }
  } catch (e) {
    console.warn("Could not fetch Twitch videos:", e);
  }

  const calculatedEngagementRate = totalFollowers > 0 && currentViewers > 0 
    ? parseFloat(((currentViewers / totalFollowers) * 100).toFixed(2))
    : 4.8;

  return {
    channel: {
      id: userItem.id,
      login: userItem.login,
      title: userItem.display_name || userItem.login,
      description: userItem.description || '',
      avatarUrl: userItem.profile_image_url || '',
      totalFollowers,
      totalViews: userItem.view_count || 0,
      videoCount: videos.length,
      isLive,
      currentViewers,
      currentGame,
      streamTitle,
      engagementRate: calculatedEngagementRate,
      estimatedRevenue: totalFollowers > 1000 ? parseFloat(((totalFollowers * 0.015) + (currentViewers * 2.5)).toFixed(2)) : 0
    },
    videos
  };
};

/**
 * Saves fetched Twitch channel data directly into Supabase tables
 */
export const syncTwitchDataToSupabase = async (userId, channelData) => {
  if (!userId || !channelData) return;
  const { channel, videos } = channelData;

  // 1. Ensure profiles row exists with 'twitch' in connected_platforms
  const { data: profile } = await supabase
    .from('profiles')
    .select('connected_platforms, api_keys')
    .eq('id', userId)
    .maybeSingle();

  const connected = (profile?.connected_platforms || []).map(p => normalizePlatformKey(p));
  const updatedConnected = connected.includes('twitch') ? connected : [...connected, 'twitch'];

  const existingKeys = profile?.api_keys || {};
  const updatedKeys = {
    ...existingKeys,
    twitch_channel_id: channel.id || existingKeys.twitch_channel_id,
    twitch_login: channel.login || existingKeys.twitch_login,
    twitch_title: channel.title || existingKeys.twitch_title
  };

  await supabase.from('profiles').upsert({
    id: userId,
    connected_platforms: updatedConnected,
    api_keys: updatedKeys
  }, { onConflict: 'id' });

  // 2. Clean up legacy variants from analytics to prevent duplicate records
  await supabase.from('analytics').delete().eq('user_id', userId).in('platform', ['Twitch', 'twitch']);

  // 3. Upsert into analytics
  const { error: anError } = await supabase.from('analytics').upsert({
    user_id: userId,
    platform: 'twitch',
    total_views: channel.totalViews,
    total_followers: channel.totalFollowers,
    engagement_rate: channel.engagementRate,
    estimated_revenue: channel.estimatedRevenue,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,platform' });

  if (anError) console.error("Error upserting Twitch analytics:", anError);

  // 4. Batch delete and batch insert content & comments
  const { data: oldContent } = await supabase
    .from('content')
    .select('id')
    .eq('user_id', userId)
    .in('platform', ['twitch', 'Twitch']);

  if (oldContent && oldContent.length > 0) {
    const oldIds = oldContent.map(c => c.id);
    await supabase.from('comments').delete().eq('user_id', userId).in('content_id', oldIds);
  }
  await supabase.from('content').delete().eq('user_id', userId).in('platform', ['twitch', 'Twitch']);

  if (videos && videos.length > 0) {
    const contentRows = videos.map(v => ({
      user_id: userId,
      title: v.title,
      platform: 'twitch',
      views: v.views,
      engagement: v.engagement,
      thumbnail_url: v.thumbnailUrl,
      published_at: v.publishedAt
    }));

    const { data: insertedContent, error: contentError } = await supabase
      .from('content')
      .insert(contentRows)
      .select('id, title');

    if (contentError) {
      console.warn("Error batch inserting Twitch content:", contentError.message);
    } else if (insertedContent && insertedContent.length > 0) {
      const commentsRows = [];
      insertedContent.forEach((ins, idx) => {
        const v = videos[idx];
        if (v && v.topComment) {
          commentsRows.push({
            user_id: userId,
            content_id: ins.id,
            author_name: v.topComment.author,
            author_avatar: v.topComment.avatar,
            text: v.topComment.text,
            created_at: v.topComment.publishedAt
          });
        }
      });

      if (commentsRows.length > 0) {
        await supabase.from('comments').insert(commentsRows);
      }
    }
  }

  return { channel, videos };
};

/**
 * Connect Twitch via Client ID, Client Secret & Username
 */
export const connectTwitchViaApiKey = async (clientId, clientSecret, username) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in first");
  const userId = session.user.id;

  const channelData = await fetchTwitchChannelData({ username, clientId, clientSecret });

  // Read existing profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('api_keys, connected_platforms')
    .eq('id', userId)
    .maybeSingle();

  const existingKeys = profile?.api_keys || {};
  const newApiKeys = {
    ...existingKeys,
    twitch_client_id: clientId ? clientId.trim() : existingKeys.twitch_client_id,
    twitch_client_secret: clientSecret ? clientSecret.trim() : existingKeys.twitch_client_secret,
    twitch_username: username ? username.trim() : existingKeys.twitch_username,
    twitch_channel_id: channelData.channel.id,
    twitch_channel_title: channelData.channel.title
  };

  const existingPlatforms = profile?.connected_platforms || [];
  const newPlatforms = Array.from(new Set([...existingPlatforms.map(p => normalizePlatformKey(p)), 'twitch']));

  await supabase.from('profiles').upsert({
    id: userId,
    email: session.user.email,
    api_keys: newApiKeys,
    connected_platforms: newPlatforms
  }, { onConflict: 'id' });

  await syncTwitchDataToSupabase(userId, channelData);

  return channelData;
};

/**
 * Fetch X (Twitter) Account & Tweet Data
 * Supports live Bearer Token (X API v2) and built-in verified demo accounts (@TwitterDev, @X, @elonmusk).
 */
export const fetchXChannelData = async ({ username, bearerToken, apiKey } = {}) => {
  const envBearer = (process.env.EXPO_PUBLIC_X_BEARER_TOKEN || process.env.EXPO_PUBLIC_TWITTER_BEARER_TOKEN || '').trim();
  const tokenToUse = (bearerToken || apiKey || envBearer || '').trim();
  const rawUser = (username || '').trim().replace(/^@/, '');
  const lowUser = rawUser.toLowerCase();

  const isDemo = tokenToUse.toUpperCase() === 'DEMO' || !tokenToUse || lowUser === 'twitterdev' || lowUser === 'x' || lowUser === 'elonmusk' || lowUser === 'demo' || !rawUser;

  if (isDemo && (!tokenToUse || tokenToUse.toUpperCase() === 'DEMO')) {
    const isElon = lowUser === 'elonmusk';
    const isX = lowUser === 'x';
    const handle = isElon ? 'elonmusk' : (isX ? 'X' : (rawUser && lowUser !== 'demo' ? rawUser : 'TwitterDev'));
    const displayName = isElon ? 'Elon Musk' : (isX ? 'X' : 'X Dev');
    const followers = isElon ? 198500000 : (isX ? 67400000 : 542000);
    const tweetsCount = isElon ? 48500 : (isX ? 18900 : 4210);
    const impressions = isElon ? 845000000 : (isX ? 412000000 : 8950000);

    return {
      channel: {
        id: isElon ? '44196397' : (isX ? '783214' : '2244994945'),
        username: handle,
        title: displayName,
        description: isElon
          ? ''
          : (isX ? 'What’s happening in the world and what people are talking about right now.' : 'The voice of the X Developer Platform team. Updates, tools, and resources.'),
        avatarUrl: isElon
          ? 'https://pbs.twimg.com/profile_images/1874558273619550208/wfA9eTI-_400x400.jpg'
          : 'https://pbs.twimg.com/profile_images/1683899100922511360/5TkOtStE_400x400.jpg',
        totalFollowers: followers,
        totalViews: impressions,
        videoCount: tweetsCount,
        engagementRate: isElon ? 6.2 : (isX ? 5.8 : 4.6),
        estimatedRevenue: parseFloat(((impressions / 1000000) * 8.5).toFixed(2))
      },
      videos: [
        {
          videoId: 'x_post_1',
          title: isElon 
            ? 'Starship Flight 7 launch preparation is progressing rapidly at Starbase.' 
            : (isX ? 'Introducing video and audio calling on X, available on iOS, Android, and Web.' : 'Announcing the latest updates to the X API v2: enhanced endpoints and real-time streaming.'),
          views: isElon ? 18400000 : (isX ? 8200000 : 194000),
          likes: isElon ? 342000 : (isX ? 124000 : 8900),
          comments: isElon ? 24500 : (isX ? 12100 : 940),
          engagement: isElon ? 6.8 : (isX ? 5.9 : 5.1),
          thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
          publishedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          topComment: {
            author: 'TechExplorer',
            avatar: null,
            text: 'Incredible progress! Looking forward to seeing the live broadcast.',
            publishedAt: new Date(Date.now() - 86400000 * 1).toISOString()
          }
        },
        {
          videoId: 'x_post_2',
          title: isElon 
            ? 'Grok 3 will be released soon. It is something truly special.' 
            : (isX ? 'Creators on X have now received over $45M in ad revenue sharing.' : 'Explore our new developer tutorials on building AI-assisted integrations on X.'),
          views: isElon ? 24600000 : (isX ? 5400000 : 128000),
          likes: isElon ? 418000 : (isX ? 98000 : 5400),
          comments: isElon ? 31200 : (isX ? 7600 : 620),
          engagement: isElon ? 7.1 : (isX ? 5.2 : 4.7),
          thumbnailUrl: 'https://images.unsplash.com/photo-1618172193763-c511deb635ca?w=800&auto=format&fit=crop&q=80',
          publishedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          topComment: {
            author: 'AI_Insider',
            avatar: null,
            text: 'Can’t wait to benchmark this against other leading models!',
            publishedAt: new Date(Date.now() - 86400000 * 2).toISOString()
          }
        },
        {
          videoId: 'x_post_3',
          title: isElon 
            ? 'Optimism is the only way to build an exciting future.' 
            : (isX ? 'Community Notes are now live for contributors globally across 70+ countries.' : 'Tip: Use user.fields and tweet.fields in your queries to minimize payload latency.'),
          views: isElon ? 14200000 : (isX ? 3900000 : 96000),
          likes: isElon ? 285000 : (isX ? 65000 : 4100),
          comments: isElon ? 18400 : (isX ? 4300 : 380),
          engagement: isElon ? 5.9 : (isX ? 4.9 : 4.4),
          thumbnailUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80',
          publishedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
          topComment: {
            author: 'CodeCrafter',
            avatar: null,
            text: 'Very helpful documentation, streamlined our workflow.',
            publishedAt: new Date(Date.now() - 86400000 * 5).toISOString()
          }
        }
      ]
    };
  }

  // Live X API v2 call
  if (!tokenToUse) {
    throw new Error('Please provide an X API Bearer Token (or click "Quick Demo" to test).');
  }
  if (!rawUser) {
    throw new Error('Please enter an X username / handle.');
  }

  const headers = {
    'Authorization': `Bearer ${tokenToUse}`,
    'Content-Type': 'application/json'
  };

  // 1. Fetch User Profile by Username
  const userUrl = `https://api.twitter.com/2/users/by/username/${encodeURIComponent(lowUser)}?user.fields=public_metrics,profile_image_url,description,verified`;
  const userRes = await fetch(userUrl, { headers });
  if (!userRes.ok) {
    const errJson = await userRes.json().catch(() => ({}));
    throw new Error(errJson.detail || errJson.title || `X API request failed with HTTP ${userRes.status}.`);
  }
  const userData = await userRes.json();
  const userObj = userData.data;
  if (!userObj) {
    throw new Error(`X user @${rawUser} not found.`);
  }

  const metrics = userObj.public_metrics || {};
  const totalFollowers = parseInt(metrics.followers_count || '0', 10);
  const tweetCount = parseInt(metrics.tweet_count || '0', 10);

  // 2. Fetch User Recent Tweets
  let tweets = [];
  let totalImpressions = 0;
  let totalInteractions = 0;
  try {
    const tweetsUrl = `https://api.twitter.com/2/users/${encodeURIComponent(userObj.id)}/tweets?tweet.fields=public_metrics,created_at&max_results=5`;
    const tweetsRes = await fetch(tweetsUrl, { headers });
    if (tweetsRes.ok) {
      const tweetsData = await tweetsRes.json();
      (tweetsData.data || []).forEach(t => {
        const pm = t.public_metrics || {};
        const impressions = parseInt(pm.impression_count || '0', 10);
        const likes = parseInt(pm.like_count || '0', 10);
        const retweets = parseInt(pm.retweet_count || '0', 10);
        const replies = parseInt(pm.reply_count || '0', 10);
        const interactions = likes + retweets + replies;
        const postEngage = impressions > 0 ? parseFloat(((interactions / impressions) * 100).toFixed(2)) : 4.5;

        totalImpressions += impressions;
        totalInteractions += interactions;

        tweets.push({
          videoId: t.id,
          title: t.text || 'X Post',
          views: impressions,
          likes,
          comments: replies,
          engagement: postEngage,
          thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
          publishedAt: t.created_at || new Date().toISOString(),
          topComment: null
        });
      });
    }
  } catch (err) {
    console.warn("Could not fetch X user tweets:", err);
  }

  if (totalImpressions === 0 && totalFollowers > 0) {
    totalImpressions = Math.round(totalFollowers * Math.max(1, Math.min(tweetCount, 15)) * 1.8);
  }

  const calculatedEngagementRate = totalImpressions > 0 && totalInteractions > 0
    ? parseFloat(((totalInteractions / totalImpressions) * 100).toFixed(2))
    : 4.8;

  return {
    channel: {
      id: userObj.id,
      username: userObj.username,
      title: userObj.name || userObj.username,
      description: userObj.description || '',
      avatarUrl: userObj.profile_image_url || 'https://img.icons8.com/ios-filled/512/twitterx--v1.png',
      totalFollowers,
      totalViews: totalImpressions,
      videoCount: tweetCount,
      engagementRate: calculatedEngagementRate,
      estimatedRevenue: totalFollowers > 500 ? parseFloat(((totalImpressions / 1000000) * 8.5).toFixed(2)) : 0
    },
    videos: tweets
  };
};

/**
 * Saves fetched X (Twitter) account data directly into Supabase tables
 */
export const syncXDataToSupabase = async (userId, xData) => {
  if (!userId || !xData) return;
  const { channel, videos } = xData;

  // 1. Ensure profiles row exists with 'x' in connected_platforms
  const { data: profile } = await supabase
    .from('profiles')
    .select('connected_platforms, api_keys')
    .eq('id', userId)
    .maybeSingle();

  const connected = (profile?.connected_platforms || []).map(p => normalizePlatformKey(p));
  const updatedConnected = connected.includes('x') ? connected : [...connected, 'x'];

  const existingKeys = profile?.api_keys || {};
  const updatedKeys = {
    ...existingKeys,
    x_username: channel.username || existingKeys.x_username,
    twitter_username: channel.username || existingKeys.twitter_username,
    x_user_id: channel.id || existingKeys.x_user_id,
    x_title: channel.title || existingKeys.x_title,
  };

  await supabase.from('profiles').upsert({
    id: userId,
    connected_platforms: updatedConnected,
    api_keys: updatedKeys
  }, { onConflict: 'id' });

  // 2. Clean up legacy variants from analytics to prevent duplicate records
  await supabase.from('analytics').delete().eq('user_id', userId).in('platform', ['X', 'x', 'twitter', 'Twitter', 'X (Twitter)']);

  // 3. Upsert into analytics
  const { error: anError } = await supabase.from('analytics').upsert({
    user_id: userId,
    platform: 'x',
    total_views: channel.totalViews,
    total_followers: channel.totalFollowers,
    engagement_rate: channel.engagementRate,
    estimated_revenue: channel.estimatedRevenue,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,platform' });

  if (anError) console.error("Error upserting X analytics:", anError);

  // 4. Batch delete and batch insert content & comments
  const { data: oldContent } = await supabase
    .from('content')
    .select('id')
    .eq('user_id', userId)
    .in('platform', ['x', 'twitter', 'X', 'X (Twitter)']);

  if (oldContent && oldContent.length > 0) {
    const oldIds = oldContent.map(c => c.id);
    await supabase.from('comments').delete().eq('user_id', userId).in('content_id', oldIds);
  }
  await supabase.from('content').delete().eq('user_id', userId).in('platform', ['x', 'twitter', 'X', 'X (Twitter)']);

  if (videos && videos.length > 0) {
    const contentRows = videos.map(v => ({
      user_id: userId,
      title: v.title,
      platform: 'x',
      views: v.views,
      engagement: v.engagement,
      thumbnail_url: v.thumbnailUrl,
      published_at: v.publishedAt
    }));

    const { data: insertedContent, error: contentError } = await supabase
      .from('content')
      .insert(contentRows)
      .select('id, title');

    if (contentError) {
      console.warn("Error batch inserting X content:", contentError.message);
    } else if (insertedContent && insertedContent.length > 0) {
      const commentsRows = [];
      insertedContent.forEach((ins, idx) => {
        const v = videos[idx];
        if (v && v.topComment) {
          commentsRows.push({
            user_id: userId,
            content_id: ins.id,
            author_name: v.topComment.author,
            author_avatar: v.topComment.avatar,
            text: v.topComment.text,
            created_at: v.topComment.publishedAt
          });
        }
      });

      if (commentsRows.length > 0) {
        await supabase.from('comments').insert(commentsRows);
      }
    }
  }

  return { channel, videos };
};

/**
 * Connect X (Twitter) via Bearer Token / API Key & Username
 */
export const connectXViaApiKey = async (bearerToken, username) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in first");
  const userId = session.user.id;

  const xData = await fetchXChannelData({ username, bearerToken });

  const { data: profile } = await supabase
    .from('profiles')
    .select('api_keys, connected_platforms')
    .eq('id', userId)
    .maybeSingle();

  const existingKeys = profile?.api_keys || {};
  const newApiKeys = {
    ...existingKeys,
    x: bearerToken ? bearerToken.trim() : existingKeys.x,
    x_token: bearerToken ? bearerToken.trim() : existingKeys.x_token,
    x_bearer_token: bearerToken ? bearerToken.trim() : existingKeys.x_bearer_token,
    x_username: username ? username.trim() : existingKeys.x_username,
    twitter_username: username ? username.trim() : existingKeys.twitter_username,
    x_user_id: xData.channel.id,
    x_title: xData.channel.title
  };

  const existingPlatforms = profile?.connected_platforms || [];
  const newPlatforms = Array.from(new Set([...existingPlatforms.map(p => normalizePlatformKey(p)), 'x']));

  await supabase.from('profiles').upsert({
    id: userId,
    email: session.user.email,
    api_keys: newApiKeys,
    connected_platforms: newPlatforms
  }, { onConflict: 'id' });

  await syncXDataToSupabase(userId, xData);

  return xData;
};

/**
 * Handle incoming OAuth tokens on session changes and immediately trigger sync
 */
export const processSessionOAuthTokens = async (session) => {
  if (!session || !session.provider_token) return null;
  try {
    let pending = null;
    try {
      pending = await AsyncStorage.getItem('pending_connection');
    } catch (e) {}

    // CRITICAL: Only process OAuth token if user explicitly triggered a connection flow
    if (!pending) {
      return null;
    }

    // Clear pending flag immediately to avoid repeat/stale processing
    try {
      await AsyncStorage.removeItem('pending_connection');
    } catch (e) {}

    const userId = session.user.id;
    const provider = session.user?.app_metadata?.provider;
    const providerMap = { google: 'yt', facebook: 'fb', twitter: 'x', linkedin_oidc: 'in' };
    const isGoogleToken = String(session.provider_token).startsWith('ya29.');
    const platformId = pending || (isGoogleToken ? 'yt' : providerMap[provider]) || 'yt';

    const { data: profile } = await supabase
      .from('profiles')
      .select('connected_platforms, api_keys')
      .eq('id', userId)
      .maybeSingle();

    const existingKeys = profile?.api_keys || {};
    const existingPlatforms = (profile?.connected_platforms || []).map(p => normalizePlatformKey(p));

    const newKeys = {
      ...existingKeys,
      [platformId]: session.provider_token,
      [`${platformId}_token`]: session.provider_token,
    };

    if (session.provider_refresh_token) {
      newKeys[`${platformId}_refresh_token`] = session.provider_refresh_token;
    }

    if (platformId === 'yt') {
      newKeys.youtube = session.provider_token;
      newKeys.yt = session.provider_token;
      newKeys.youtube_token = session.provider_token;
      newKeys.google_provider_token = session.provider_token;
      if (session.provider_refresh_token) {
        newKeys.youtube_refresh_token = session.provider_refresh_token;
        newKeys.yt_refresh_token = session.provider_refresh_token;
        newKeys.google_provider_refresh_token = session.provider_refresh_token;
      }
    }

    // Direct channel data extraction with the OAuth token
    let channelData = null;
    if (platformId === 'yt') {
      try {
        channelData = await fetchYouTubeChannelData({ token: session.provider_token });
        if (channelData?.channel) {
          newKeys.youtube_channel_id = channelData.channel.id;
          newKeys.yt_channel_id = channelData.channel.id;
          newKeys.youtube_channel_title = channelData.channel.title;
        }
      } catch (err) {
        console.warn("Could not fetch YouTube channel data with provider token:", err.message);
      }
    } else if (platformId === 'x') {
      const twitterMeta = session.user?.user_metadata || {};
      const twitterIdentity = (session.user?.identities || []).find(i => i.provider === 'twitter')?.identity_data || {};
      const twitterUsername = twitterMeta.user_name || twitterMeta.preferred_username || twitterIdentity.user_name || twitterIdentity.screen_name || 'TwitterDev';

      newKeys.x = session.provider_token;
      newKeys.x_token = session.provider_token;
      newKeys.x_bearer_token = session.provider_token;
      newKeys.x_username = twitterUsername;
      newKeys.twitter_username = twitterUsername;

      try {
        channelData = await fetchXChannelData({ username: twitterUsername, bearerToken: session.provider_token });
        if (channelData?.channel) {
          newKeys.x_user_id = channelData.channel.id;
          newKeys.x_title = channelData.channel.title;
        }
      } catch (err) {
        console.warn("Could not fetch X channel data with provider token:", err.message);
      }
    }

    const newPlatforms = Array.from(new Set([...existingPlatforms, platformId]));

    await supabase.from('profiles').upsert({
      id: userId,
      email: session.user.email,
      api_keys: newKeys,
      connected_platforms: newPlatforms
    }, { onConflict: 'id' });

    // If channelData was successfully fetched, sync to DB immediately
    if (channelData) {
      if (platformId === 'yt') {
        await syncYouTubeDataToSupabase(userId, channelData);
      } else if (platformId === 'x') {
        await syncXDataToSupabase(userId, channelData);
      }
    } else {
      await syncPlatformData([platformId]);
    }

    return { platformId, channelData };
  } catch (err) {
    console.warn("Error processing OAuth session token:", err);
    return null;
  }
};

/**
 * Disconnect a platform cleanly
 */
export const disconnectPlatform = async (platformId) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;
  const normKey = normalizePlatformKey(platformId);

  // 1. Fetch current profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('connected_platforms, api_keys')
    .eq('id', userId)
    .maybeSingle();

  const existingPlatforms = profile?.connected_platforms || [];
  const updatedPlatforms = existingPlatforms
    .map(p => normalizePlatformKey(p))
    .filter(p => p !== normKey);

  const existingKeys = { ...(profile?.api_keys || {}) };

  // Keys to purge per platform
  const keysToRemoveByPlatform = {
    yt: [
      'yt', 'youtube', 'youtube_token', 'yt_token', 'youtube_refresh_token',
      'yt_refresh_token', 'google_provider_token', 'google_provider_refresh_token',
      'youtube_channel_id', 'yt_channel_id', 'youtube_handle', 'youtube_channel_title'
    ],
    ig: ['ig', 'instagram', 'ig_token', 'instagram_token', 'ig_refresh_token', 'instagram_refresh_token'],
    x: ['x', 'twitter', 'x_token', 'twitter_token', 'x_bearer_token', 'x_refresh_token', 'twitter_refresh_token', 'x_username', 'twitter_username', 'x_user_id', 'x_title'],
    fb: ['fb', 'facebook', 'fb_token', 'facebook_token', 'fb_refresh_token', 'facebook_refresh_token'],
    in: ['in', 'linkedin', 'in_token', 'linkedin_token', 'in_refresh_token', 'linkedin_refresh_token'],
    twitch: ['twitch', 'twitch_token', 'twitch_refresh_token', 'twitch_client_id', 'twitch_client_secret', 'twitch_username', 'twitch_channel_id', 'twitch_channel_title', 'twitch_login']
  };

  const specificKeys = keysToRemoveByPlatform[normKey] || [normKey, `${normKey}_token`, `${normKey}_refresh_token`];
  specificKeys.forEach(k => {
    delete existingKeys[k];
  });

  // Also remove prefixed keys
  Object.keys(existingKeys).forEach(k => {
    if (k.startsWith(`${normKey}_`) || (normKey === 'yt' && k.startsWith('youtube_'))) {
      delete existingKeys[k];
    }
  });

  // Upsert profile with platform removed and keys purged
  await supabase.from('profiles').upsert({
    id: userId,
    connected_platforms: updatedPlatforms,
    api_keys: existingKeys
  }, { onConflict: 'id' });

  // 2. Delete platform's records from comments, content, and analytics
  const variants = normKey === 'yt' 
    ? ['yt', 'youtube', 'YouTube'] 
    : normKey === 'ig' 
    ? ['ig', 'instagram', 'Instagram']
    : normKey === 'x'
    ? ['x', 'twitter', 'Twitter', 'X', 'X (Twitter)']
    : normKey === 'fb'
    ? ['fb', 'facebook', 'Facebook']
    : normKey === 'in'
    ? ['in', 'linkedin', 'LinkedIn']
    : normKey === 'twitch'
    ? ['twitch', 'Twitch']
    : [normKey];

  // First delete comments associated with content for this platform to satisfy FK constraints
  try {
    const { data: contentRows } = await supabase
      .from('content')
      .select('id')
      .eq('user_id', userId)
      .in('platform', variants);

    if (contentRows && contentRows.length > 0) {
      const cIds = contentRows.map(c => c.id);
      await supabase.from('comments').delete().eq('user_id', userId).in('content_id', cIds);
    }
  } catch (err) {
    console.warn("Notice deleting comments for disconnected platform:", err.message);
  }

  // Delete content and analytics
  await supabase.from('content').delete().eq('user_id', userId).in('platform', variants);
  await supabase.from('analytics').delete().eq('user_id', userId).in('platform', variants);

  // 3. Clear any cached tokens or flags in AsyncStorage
  try {
    const asyncKeys = [
      'pending_connection',
      `${normKey}_token`,
      `${normKey}_refresh_token`,
      normKey === 'yt' ? 'youtube_token' : '',
      normKey === 'yt' ? 'youtube_api_key' : '',
      normKey === 'yt' ? 'youtube_channel_id' : '',
    ].filter(Boolean);
    await AsyncStorage.multiRemove(asyncKeys);
  } catch (err) {
    console.warn("Notice clearing AsyncStorage on disconnect:", err.message);
  }

  // 4. Unlink OAuth identity if user has multiple auth identities
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

  return { success: true, updatedPlatforms };
};

/**
 * Sync platform data (runs client-side sync and non-blocking backend fallback)
 */
export const syncPlatformData = async (platforms = ['yt']) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const userId = session.user.id;

    let syncedChannelData = null;

    // Check if YouTube needs sync
    const wantsYt = platforms.some(p => isPlatformMatch(p, 'yt'));
    if (wantsYt) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('api_keys, connected_platforms')
        .eq('id', userId)
        .maybeSingle();

      const connectedList = (profile?.connected_platforms || []).map(p => normalizePlatformKey(p));
      const isYtConnected = connectedList.includes('yt');

      if (isYtConnected) {
        const apiKeys = profile?.api_keys || {};
        const ytKeyOrToken = apiKeys.youtube || apiKeys.yt || apiKeys.youtube_token || apiKeys.google_provider_token || session.provider_token;
        const ytChannelId = apiKeys.youtube_channel_id || apiKeys.yt_channel_id || (typeof ytKeyOrToken === 'object' ? ytKeyOrToken.channelId : undefined);
        const rawKey = typeof ytKeyOrToken === 'object' ? (ytKeyOrToken.apiKey || ytKeyOrToken.token) : ytKeyOrToken;

        if (rawKey) {
          try {
            const isOAuth = String(rawKey).startsWith('ya29.') || Boolean(apiKeys.youtube_token && rawKey === apiKeys.youtube_token);
            syncedChannelData = await fetchYouTubeChannelData({
              apiKey: !isOAuth ? rawKey : undefined,
              token: isOAuth ? rawKey : undefined,
              channelId: ytChannelId
            });
            if (syncedChannelData) {
              await syncYouTubeDataToSupabase(userId, syncedChannelData);
            }
          } catch (err) {
            console.warn("Client-side YouTube sync notice:", err.message);
          }
        }
      }
    }

    // Check if Twitch needs sync
    const wantsTwitch = platforms.some(p => isPlatformMatch(p, 'twitch'));
    if (wantsTwitch) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('api_keys, connected_platforms')
        .eq('id', userId)
        .maybeSingle();

      const connectedList = (profile?.connected_platforms || []).map(p => normalizePlatformKey(p));
      const isTwitchConnected = connectedList.includes('twitch');

      if (isTwitchConnected) {
        const apiKeys = profile?.api_keys || {};
        const twitchUsername = apiKeys.twitch_username || apiKeys.twitch_login || 'shroud';
        const twitchClientId = apiKeys.twitch_client_id || 'DEMO';
        const twitchClientSecret = apiKeys.twitch_client_secret || '';

        try {
          const syncedTwitch = await fetchTwitchChannelData({
            username: twitchUsername,
            clientId: twitchClientId,
            clientSecret: twitchClientSecret
          });
          if (syncedTwitch) {
            await syncTwitchDataToSupabase(userId, syncedTwitch);
            if (!syncedChannelData) syncedChannelData = syncedTwitch;
          }
        } catch (err) {
          console.warn("Client-side Twitch sync notice:", err.message);
        }
      }
    }

    // Check if X needs sync
    const wantsX = platforms.some(p => isPlatformMatch(p, 'x'));
    if (wantsX) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('api_keys, connected_platforms')
        .eq('id', userId)
        .maybeSingle();

      const connectedList = (profile?.connected_platforms || []).map(p => normalizePlatformKey(p));
      const isXConnected = connectedList.includes('x');

      if (isXConnected) {
        const apiKeys = profile?.api_keys || {};
        const xUser = apiKeys.x_username || apiKeys.twitter_username || 'TwitterDev';
        const xToken = apiKeys.x || apiKeys.x_token || apiKeys.x_bearer_token || 'DEMO';

        try {
          const syncedX = await fetchXChannelData({
            username: xUser,
            bearerToken: xToken
          });
          if (syncedX) {
            await syncXDataToSupabase(userId, syncedX);
            if (!syncedChannelData) syncedChannelData = syncedX;
          }
        } catch (err) {
          console.warn("Client-side X sync notice:", err.message);
        }
      }
    }

    // Fire-and-forget Edge Function asynchronously without blocking the client response
    supabase.functions.invoke('fetch-platform-data', {
      body: { platforms }
    }).catch(e => console.log("Edge function invoke notice:", e.message));

    // Return immediately to frontend
    return syncedChannelData;
  } catch (error) {
    console.error("Error syncing platform data:", error);
    return null;
  }
};

/**
 * Fetch platform data from Supabase DB tables and aggregate for the dashboard
 */
export const fetchPlatformData = async (platforms = null) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No session");
    const userId = session.user.id;

    // Normalize requested platforms filter: filter only if a non-empty array is passed
    const activeKeys = Array.isArray(platforms) && platforms.length > 0 
      ? platforms.map(p => normalizePlatformKey(p)).filter(Boolean) 
      : null;

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
        const isRequested = !activeKeys || activeKeys.includes(pKey);

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
          const statObj = {
            followers: rFollowers.toLocaleString(),
            rawFollowers: rFollowers,
            views: rViews.toLocaleString(),
            rawViews: rViews,
            engage: rEngage > 0 ? rEngage.toFixed(1) + '%' : '0.0%',
            rawEngage: rEngage,
            revenue: rRevenue
          };

          platformStats[platformName] = statObj;
          platformStats[pKey] = statObj;
          if (pKey === 'yt') {
            platformStats['YouTube'] = statObj;
            platformStats['youtube'] = statObj;
          }
          if (pKey === 'twitch') {
            platformStats['Twitch'] = statObj;
            platformStats['twitch'] = statObj;
          }
          if (pKey === 'x') {
            platformStats['X'] = statObj;
            platformStats['X (Twitter)'] = statObj;
            platformStats['twitter'] = statObj;
            platformStats['x'] = statObj;
          }
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

    // Top Content filtered by active platforms
    const topContent = (content || [])
      .filter(c => !activeKeys || activeKeys.includes(normalizePlatformKey(c.platform)))
      .map(c => {
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

    // Recent Comments filtered by active platforms
    const recentComments = (comments || [])
      .filter(c => {
        const plat = c.content?.platform || c.platform;
        return !activeKeys || activeKeys.includes(normalizePlatformKey(plat));
      })
      .map(c => {
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

    // Chart Data: dynamic distribution if views or followers exist
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const chartData = (totalViews > 0 || totalFollowers > 0)
      ? days.map((day, idx) => ({
          day,
          val: totalViews > 0
            ? Math.min(100, Math.max(20, Math.round(((idx + 3) / 10) * 85)))
            : Math.min(100, Math.max(15, Math.round(((idx + 2) / 8) * 45)))
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

