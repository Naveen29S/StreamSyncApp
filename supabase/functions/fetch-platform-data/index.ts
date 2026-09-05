import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { platforms } = await req.json()
    const authHeader = req.headers.get('Authorization')!
    
    // Create Supabase client as the authenticated user
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // Fetch API Keys
    const { data: profile } = await supabase
      .from('profiles')
      .select('api_keys')
      .eq('id', user.id)
      .maybeSingle()
      
    const apiKeys = profile?.api_keys || {}

    // We will clear existing content/comments for the requested platforms and insert the latest batch
    // to avoid duplicates since we don't have an external_id unique constraint.
    // Normalize platforms to update and variants
    const platformsToUpdate = platforms.map((p: string) => p.toLowerCase());
    const platformDeleteVariants: string[] = [];
    for (const p of platformsToUpdate) {
      platformDeleteVariants.push(p);
      if (p === 'yt' || p === 'youtube') {
        platformDeleteVariants.push('yt', 'youtube', 'YouTube');
      } else if (p === 'fb' || p === 'facebook') {
        platformDeleteVariants.push('fb', 'facebook', 'Facebook');
      } else if (p === 'ig' || p === 'instagram') {
        platformDeleteVariants.push('ig', 'instagram', 'Instagram');
      } else if (p === 'x' || p === 'twitter') {
        platformDeleteVariants.push('x', 'twitter', 'X', 'X (Twitter)');
      } else if (p === 'in' || p === 'linkedin') {
        platformDeleteVariants.push('in', 'linkedin', 'LinkedIn');
      }
    }

    if (platformDeleteVariants.length > 0) {
      await supabase.from('content').delete().eq('user_id', user.id).in('platform', platformDeleteVariants);
    }

    // ==========================================
    // YOUTUBE INTEGRATION (OAuth or API Key)
    // ==========================================
    const ytKeyEntry = apiKeys['youtube'] || apiKeys['yt'];
    if ((platformsToUpdate.includes('yt') || platformsToUpdate.includes('youtube')) && ytKeyEntry) {
      try {
        const rawKeyOrToken = typeof ytKeyEntry === 'object' ? (ytKeyEntry.apiKey || ytKeyEntry.token) : ytKeyEntry;
        const channelId = apiKeys['youtube_channel_id'] || apiKeys['yt_channel_id'] || (typeof ytKeyEntry === 'object' ? ytKeyEntry.channelId : undefined);
        const isApiKey = String(rawKeyOrToken).startsWith('AIza') || Boolean(channelId);

        let channelData: any = null;

        if (isApiKey && channelId) {
          // Fetch via API Key + Channel ID / Handle
          let channelUrl = '';
          if (channelId.startsWith('UC') && channelId.length >= 20) {
            channelUrl = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(rawKeyOrToken)}`;
          } else {
            const handleParam = channelId.startsWith('@') ? channelId : `@${channelId}`;
            channelUrl = `https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&forHandle=${encodeURIComponent(handleParam)}&key=${encodeURIComponent(rawKeyOrToken)}`;
          }
          const channelRes = await fetch(channelUrl);
          if (channelRes.ok) {
            channelData = await channelRes.json();
          }

          // Fallback to forUsername if handle returned no items
          if ((!channelData?.items || channelData.items.length === 0) && !channelId.startsWith('UC')) {
            const cleanName = channelId.replace(/^@/, '');
            const fallbackRes = await fetch(`https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&forUsername=${encodeURIComponent(cleanName)}&key=${encodeURIComponent(rawKeyOrToken)}`);
            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json();
              if (fallbackData?.items && fallbackData.items.length > 0) {
                channelData = fallbackData;
              }
            }
          }
        } else {
          // Fetch via OAuth Token
          const channelRes = await fetch(`https://youtube.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true`, {
            headers: { Authorization: `Bearer ${rawKeyOrToken}` }
          });
          if (channelRes.ok) {
            channelData = await channelRes.json();
          }
        }
        
        let uploadsPlaylistId: string | null = null;
        let channelTitle = 'YouTube Channel';

        if (channelData?.items && channelData.items.length > 0) {
          const item = channelData.items[0];
          const stats = item.statistics || {};
          const snippet = item.snippet || {};
          channelTitle = snippet.title || channelTitle;
          uploadsPlaylistId = item.contentDetails?.relatedPlaylists?.uploads || null;
          
          const subs = parseInt(stats.subscriberCount || '0', 10);
          const totalViews = parseInt(stats.viewCount || '0', 10);
          const videoCount = parseInt(stats.videoCount || '0', 10);
          const isMonetized = subs >= 1000;
          let calculatedEngagementRate = 0;
          let totalRecentInteractions = 0;
          let totalRecentViews = 0;

          // 2. Recent Videos & Comments
          if (uploadsPlaylistId) {
            const playlistUrl = isApiKey
              ? `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=8&key=${encodeURIComponent(rawKeyOrToken)}`
              : `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=8`;
            
            const playlistRes = await fetch(playlistUrl, !isApiKey ? { headers: { Authorization: `Bearer ${rawKeyOrToken}` } } : undefined);
            const playlistData = await playlistRes.json();
            
            if (playlistData.items && playlistData.items.length > 0) {
              const videoIds = playlistData.items
                .map((i: any) => i.snippet?.resourceId?.videoId || i.contentDetails?.videoId)
                .filter(Boolean)
                .join(',');
              
              if (videoIds) {
                const vidStatsUrl = isApiKey
                  ? `https://youtube.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(videoIds)}&key=${encodeURIComponent(rawKeyOrToken)}`
                  : `https://youtube.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(videoIds)}`;
                
                const vidStatsRes = await fetch(vidStatsUrl, !isApiKey ? { headers: { Authorization: `Bearer ${rawKeyOrToken}` } } : undefined);
                const vidStatsData = await vidStatsRes.json();
                const statsMap: any = {};
                if (vidStatsData.items) {
                  vidStatsData.items.forEach((v: any) => { statsMap[v.id] = v; });
                }

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

                  // Insert Content
                  const { data: contentRow } = await supabase.from('content').insert({
                    user_id: user.id,
                    title: vSnippet.title || 'YouTube Video',
                    platform: 'yt',
                    views: views,
                    engagement: engagement,
                    thumbnail_url: vSnippet.thumbnails?.high?.url || vSnippet.thumbnails?.medium?.url || vSnippet.thumbnails?.default?.url,
                    published_at: vSnippet.publishedAt || new Date().toISOString()
                  }).select('id').single();

                  // Fetch 1 recent comment for this video if available
                  if (contentRow && comments > 0) {
                    try {
                      const commentsUrl = isApiKey
                        ? `https://youtube.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${encodeURIComponent(vid)}&maxResults=1&key=${encodeURIComponent(rawKeyOrToken)}`
                        : `https://youtube.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${encodeURIComponent(vid)}&maxResults=1`;
                      
                      const commentsRes = await fetch(commentsUrl, !isApiKey ? { headers: { Authorization: `Bearer ${rawKeyOrToken}` } } : undefined);
                      const commentsData = await commentsRes.json();
                      if (commentsData.items && commentsData.items.length > 0) {
                        const topSnippet = commentsData.items[0].snippet?.topLevelComment?.snippet;
                        if (topSnippet) {
                          await supabase.from('comments').insert({
                            user_id: user.id,
                            content_id: contentRow.id,
                            author_name: topSnippet.authorDisplayName || 'YouTube Viewer',
                            author_avatar: topSnippet.authorProfileImageUrl || null,
                            text: topSnippet.textDisplay || '',
                            created_at: topSnippet.publishedAt || new Date().toISOString()
                          });
                        }
                      }
                    } catch (ce) {
                      console.error("YT Comments Error:", ce);
                    }
                  }
                }
              }
            }
          }

          if (totalRecentViews > 0) {
            calculatedEngagementRate = parseFloat(((totalRecentInteractions / totalRecentViews) * 100).toFixed(2));
          } else if (subs > 0 && totalViews > 0) {
            calculatedEngagementRate = parseFloat(((totalViews / (subs * Math.max(videoCount, 1))) * 10).toFixed(2));
          }

          const estimatedRevenue = isMonetized ? parseFloat(((totalViews / 1000) * 1.5).toFixed(2)) : -1;

          await supabase.from('analytics').delete().eq('user_id', user.id).in('platform', ['YouTube', 'youtube']);

          await supabase.from('analytics').upsert({
            user_id: user.id,
            platform: 'yt',
            total_views: totalViews,
            total_followers: subs,
            engagement_rate: calculatedEngagementRate,
            estimated_revenue: estimatedRevenue,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,platform' });
        }
      } catch (e) {
        console.error("YouTube Error:", e);
      }
    }

    // ==========================================
    // FACEBOOK GRAPH API INTEGRATION
    // ==========================================
    if ((platformsToUpdate.includes('fb') || platformsToUpdate.includes('facebook')) && apiKeys['fb']) {
      try {
        const token = apiKeys['fb'];
        const res = await fetch(`https://graph.facebook.com/v19.0/me?fields=followers_count,feed.limit(3){message,created_time,full_picture,shares,comments.summary(true),likes.summary(true)}&access_token=${token}`);
        const fbData = await res.json();
        
        if (fbData.followers_count !== undefined) {
          await supabase.from('analytics').upsert({
            user_id: user.id,
            platform: 'fb',
            total_views: 0, // FB basic API doesn't give total page views easily
            total_followers: parseInt(fbData.followers_count || '0'),
            engagement_rate: 0, 
            estimated_revenue: -1,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,platform' });
        }

        if (fbData.feed && fbData.feed.data) {
          for (const post of fbData.feed.data) {
            const likes = post.likes?.summary?.total_count || 0;
            const comments = post.comments?.summary?.total_count || 0;
            
            const { data: contentRow } = await supabase.from('content').insert({
              user_id: user.id,
              title: post.message ? (post.message.substring(0, 50) + '...') : 'Facebook Post',
              platform: 'fb',
              views: likes * 10, // Mocked views since FB doesn't provide impression data without insights scope
              engagement: likes + comments,
              thumbnail_url: post.full_picture,
              published_at: post.created_time
            }).select('id').single();

            // Insert mock comment if there are comments
            if (contentRow && comments > 0 && post.comments?.data?.[0]) {
              const c = post.comments.data[0];
              await supabase.from('comments').insert({
                user_id: user.id,
                content_id: contentRow.id,
                author_name: c.from?.name || 'Facebook User',
                text: c.message,
                created_at: c.created_time
              });
            }
          }
        }
      } catch (e) {
        console.error("Facebook Error:", e);
      }
    }

    // ==========================================
    // INSTAGRAM INTEGRATION
    // ==========================================
    if ((platformsToUpdate.includes('ig') || platformsToUpdate.includes('instagram')) && apiKeys['ig']) {
       try {
        const token = apiKeys['ig'];
        const res = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account{followers_count,media.limit(3){caption,media_url,timestamp,comments_count,like_count}}&access_token=${token}`);
        const igData = await res.json();
        
        if (igData.data && igData.data.length > 0) {
          for (const page of igData.data) {
            if (page.instagram_business_account) {
              const igAccount = page.instagram_business_account;
              await supabase.from('analytics').upsert({
                user_id: user.id,
                platform: 'ig',
                total_views: 0, 
                total_followers: parseInt(igAccount.followers_count || '0'),
                engagement_rate: 0, 
                estimated_revenue: -1,
                updated_at: new Date().toISOString()
              }, { onConflict: 'user_id,platform' });

              if (igAccount.media && igAccount.media.data) {
                 for (const media of igAccount.media.data) {
                    const likes = media.like_count || 0;
                    const comments = media.comments_count || 0;

                    await supabase.from('content').insert({
                      user_id: user.id,
                      title: media.caption ? (media.caption.substring(0, 50) + '...') : 'Instagram Post',
                      platform: 'ig',
                      views: likes * 15,
                      engagement: likes + comments,
                      thumbnail_url: media.media_url,
                      published_at: media.timestamp
                    });
                 }
              }
            }
          }
        }
       } catch(e) {
         console.error("Instagram Error:", e);
       }
    }

    // ==========================================
    // X (TWITTER) INTEGRATION
    // ==========================================
    if ((platformsToUpdate.includes('x') || platformsToUpdate.includes('x (twitter)')) && apiKeys['x']) {
      try {
        const token = apiKeys['x'];
        const res = await fetch(`https://api.twitter.com/2/users/me?user.fields=public_metrics`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const xData = await res.json();
        
        let userIdStr = '';
        if (xData.data) {
          userIdStr = xData.data.id;
          const metrics = xData.data.public_metrics;
          await supabase.from('analytics').upsert({
            user_id: user.id,
            platform: 'x',
            total_views: 0,
            total_followers: parseInt(metrics.followers_count || '0'),
            engagement_rate: 0, 
            estimated_revenue: -1,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,platform' });
        }

        if (userIdStr) {
          const tweetsRes = await fetch(`https://api.twitter.com/2/users/${userIdStr}/tweets?tweet.fields=public_metrics,created_at&max_results=5`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const tweetsData = await tweetsRes.json();
          if (tweetsData.data) {
             for (const tweet of tweetsData.data) {
               const metrics = tweet.public_metrics;
               await supabase.from('content').insert({
                  user_id: user.id,
                  title: tweet.text.substring(0, 60) + '...',
                  platform: 'x',
                  views: parseInt(metrics.impression_count || '0'),
                  engagement: parseInt(metrics.like_count || '0') + parseInt(metrics.reply_count || '0') + parseInt(metrics.retweet_count || '0'),
                  thumbnail_url: null,
                  published_at: tweet.created_at
               });
             }
          }
        }
      } catch (e) {
        console.error("X Error:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Sync complete" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
