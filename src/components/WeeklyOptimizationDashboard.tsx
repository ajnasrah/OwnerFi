'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy, TrendingUp, TrendingDown, Clock, Calendar, Hash, MessageSquare, Video } from 'lucide-react';

interface WeeklyOptimizationData {
  brand: string;
  period: {
    start: string;
    end: string;
  };
  youtube: {
    performance: {
      totalPosts: number;
      avgViews: number;
      avgEngagement: number;
    };
    captions: {
      avgLength: number;
      optimalRange: string;
      topPerformingLength: string;
      hasQuestion: number;
      hasExclamation: number;
    };
    hashtags: {
      avgCount: number;
      recommendedCount: number;
    };
  };
  instagram: {
    performance: {
      totalPosts: number;
      avgViews: number;
      avgEngagement: number;
    };
    captions: {
      avgLength: number;
      optimalRange: string;
      topPerformingLength: string;
      hasQuestion: number;
      hasExclamation: number;
    };
    hashtags: {
      avgCount: number;
      recommendedCount: number;
    };
  };
  timing: {
    bestHours: Array<{ hour: number; label: string; avgViews: number }>;
    bestDays: Array<{ day: string; avgViews: number }>;
    worstHours: Array<{ hour: number; label: string; avgViews: number }>;
  };
  recommendations: {
    captions: string[];
    hashtags: string[];
    duration: string[];
    scheduling: string[];
  };
}

export function WeeklyOptimizationDashboard() {
  const [brand, setBrand] = useState('ownerfi');
  const [days, setDays] = useState('7');
  const [data, setData] = useState<WeeklyOptimizationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOptimizationData();
  }, [brand, days]);

  const fetchOptimizationData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics/weekly-optimization?brand=${brand}&days=${days}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const copyRecommendations = () => {
    if (!data) return;

    const text = `
# Weekly Optimization Settings for ${data.brand}
# Generated: ${new Date().toLocaleDateString()}

## CAPTIONS
${data.recommendations.captions.map(r => `- ${r}`).join('\n')}

## HASHTAGS
${data.recommendations.hashtags.map(r => `- ${r}`).join('\n')}

## DURATION
${data.recommendations.duration.map(r => `- ${r}`).join('\n')}

## SCHEDULING
${data.recommendations.scheduling.map(r => `- ${r}`).join('\n')}

## CONFIGURATION
YOUTUBE_CAPTION_LENGTH="${data.youtube.captions.optimalRange}"
INSTAGRAM_CAPTION_LENGTH="${data.instagram.captions.optimalRange}"
YOUTUBE_HASHTAGS="${data.youtube.hashtags.recommendedCount}"
INSTAGRAM_HASHTAGS="${data.instagram.hashtags.recommendedCount}"
VIDEO_DURATION="15-30"
BEST_POSTING_TIMES="${data.timing.bestHours.slice(0, 3).map(h => h.hour).join(',')}"
BEST_POSTING_DAYS="${data.timing.bestDays.slice(0, 3).map(d => d.day).join(',')}"
    `.trim();

    navigator.clipboard.writeText(text);
    alert('Recommendations copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={fetchOptimizationData}>Retry</Button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Weekly Optimization Report</h1>
          <p className="text-gray-600 mt-1">
            {new Date(data.period.start).toLocaleDateString()} - {new Date(data.period.end).toLocaleDateString()}
          </p>
        </div>

        <div className="flex gap-4">
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="carz">Carz</SelectItem>
              <SelectItem value="ownerfi">OwnerFi</SelectItem>
              <SelectItem value="podcast">Podcast</SelectItem>
              <SelectItem value="vassdistro">Vass Distro</SelectItem>
              <SelectItem value="abdullah">Abdullah</SelectItem>
            </SelectContent>
          </Select>

          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={copyRecommendations} variant="outline">
            <Copy className="mr-2 h-4 w-4" />
            Copy Settings
          </Button>
        </div>
      </div>

      {/* Platform Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* YouTube */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-red-500" />
              YouTube Performance
            </CardTitle>
            <CardDescription>{data.youtube.performance.totalPosts} posts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Avg Views</p>
                <p className="text-2xl font-bold">{data.youtube.performance.avgViews.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Engagement</p>
                <p className="text-2xl font-bold">{data.youtube.performance.avgEngagement.toLocaleString()}</p>
              </div>

              <div className="pt-4 border-t">
                <p className="font-semibold mb-2">Caption Insights</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Avg Length:</span>
                    <Badge variant="secondary">{data.youtube.captions.avgLength} chars</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Optimal Range:</span>
                    <Badge variant="outline">{data.youtube.captions.optimalRange} chars</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Has Question:</span>
                    <Badge variant={data.youtube.captions.hasQuestion >= 50 ? 'default' : 'destructive'}>
                      {data.youtube.captions.hasQuestion}%
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Has Exclamation:</span>
                    <Badge variant={data.youtube.captions.hasExclamation >= 70 ? 'default' : 'destructive'}>
                      {data.youtube.captions.hasExclamation}%
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="font-semibold mb-2">Hashtags</p>
                <div className="flex items-center justify-between text-sm">
                  <span>Current Avg:</span>
                  <Badge variant="secondary">{data.youtube.hashtags.avgCount}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span>Recommended:</span>
                  <Badge variant="default">{data.youtube.hashtags.recommendedCount}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instagram */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-pink-500" />
              Instagram Performance
            </CardTitle>
            <CardDescription>{data.instagram.performance.totalPosts} posts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Avg Views</p>
                <p className="text-2xl font-bold">{data.instagram.performance.avgViews.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Engagement</p>
                <p className="text-2xl font-bold">{data.instagram.performance.avgEngagement.toLocaleString()}</p>
              </div>

              <div className="pt-4 border-t">
                <p className="font-semibold mb-2">Caption Insights</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Avg Length:</span>
                    <Badge variant="secondary">{data.instagram.captions.avgLength} chars</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Optimal Range:</span>
                    <Badge variant="outline">{data.instagram.captions.optimalRange} chars</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Has Question:</span>
                    <Badge variant={data.instagram.captions.hasQuestion >= 50 ? 'default' : 'destructive'}>
                      {data.instagram.captions.hasQuestion}%
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Has Exclamation:</span>
                    <Badge variant={data.instagram.captions.hasExclamation >= 70 ? 'default' : 'destructive'}>
                      {data.instagram.captions.hasExclamation}%
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="font-semibold mb-2">Hashtags</p>
                <div className="flex items-center justify-between text-sm">
                  <span>Current Avg:</span>
                  <Badge variant="secondary">{data.instagram.hashtags.avgCount}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span>Recommended:</span>
                  <Badge variant="default">{data.instagram.hashtags.recommendedCount}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timing Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Best Posting Times
          </CardTitle>
          <CardDescription>Based on average views</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Best Hours
              </p>
              <div className="space-y-2">
                {data.timing.bestHours.map((hour, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded">
                    <span className="font-medium">{hour.label}</span>
                    <span className="text-sm text-gray-600">{hour.avgViews.toLocaleString()} avg views</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                Best Days
              </p>
              <div className="space-y-2">
                {data.timing.bestDays.map((day, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                    <span className="font-medium">{day.day}</span>
                    <span className="text-sm text-gray-600">{day.avgViews.toLocaleString()} avg views</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {data.timing.worstHours.length > 0 && (
            <div className="mt-6">
              <p className="font-semibold mb-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Avoid These Times
              </p>
              <div className="grid grid-cols-3 gap-2">
                {data.timing.worstHours.map((hour, idx) => (
                  <div key={idx} className="p-2 bg-red-50 rounded text-center">
                    <p className="font-medium text-sm">{hour.label}</p>
                    <p className="text-xs text-gray-600">{hour.avgViews.toLocaleString()} avg views</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Caption Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.captions.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">•</span>
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Hashtag Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.hashtags.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Duration Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.duration.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Scheduling Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.scheduling.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-orange-500 mt-1">•</span>
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
