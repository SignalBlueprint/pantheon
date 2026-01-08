'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Highlight,
  HighlightReel,
  HighlightCategory,
  HIGHLIGHT_THRESHOLDS,
} from '@pantheon/shared';

interface EternalCanonViewProps {
  onClose?: () => void;
  onWatchHighlight?: (highlight: Highlight) => void;
}

/**
 * Format tick count to readable time
 */
function formatTicks(ticks: number): string {
  if (ticks < 60) return `${ticks}s`;
  if (ticks < 3600) return `${Math.floor(ticks / 60)}m ${ticks % 60}s`;
  const hours = Math.floor(ticks / 3600);
  const mins = Math.floor((ticks % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Get category icon
 */
function getCategoryIcon(category: HighlightCategory): string {
  const icons: Record<HighlightCategory, string> = {
    battle: '⚔️',
    conquest: '🏰',
    diplomacy: '🤝',
    divine: '✨',
    champion: '👤',
    dominance: '👑',
    elimination: '☠️',
    underdog: '🐕',
    comeback: '🔄',
    general: '📌',
  };
  return icons[category] || '📌';
}

/**
 * Get category color
 */
function getCategoryColor(category: HighlightCategory): string {
  const colors: Record<HighlightCategory, string> = {
    battle: 'text-red-400 bg-red-900/30',
    conquest: 'text-amber-400 bg-amber-900/30',
    diplomacy: 'text-blue-400 bg-blue-900/30',
    divine: 'text-purple-400 bg-purple-900/30',
    champion: 'text-emerald-400 bg-emerald-900/30',
    dominance: 'text-yellow-400 bg-yellow-900/30',
    elimination: 'text-gray-400 bg-gray-700/50',
    underdog: 'text-cyan-400 bg-cyan-900/30',
    comeback: 'text-green-400 bg-green-900/30',
    general: 'text-gray-300 bg-gray-800/50',
  };
  return colors[category] || 'text-gray-300 bg-gray-800/50';
}

/**
 * Highlight card component
 */
function HighlightCard({
  highlight,
  rank,
  onVote,
  onWatch,
  onShare,
  userVote,
}: {
  highlight: Highlight;
  rank?: number;
  onVote?: (highlightId: string, voteType: 'up' | 'down') => void;
  onWatch?: (highlight: Highlight) => void;
  onShare?: (highlight: Highlight) => void;
  userVote?: 'up' | 'down' | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`rounded-lg border transition-all ${
        highlight.isEternalCanon
          ? 'border-yellow-500/50 bg-gradient-to-br from-yellow-900/20 to-amber-900/20'
          : 'border-gray-700 bg-gray-800/50'
      } overflow-hidden`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Rank badge */}
          {rank !== undefined && (
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                rank === 1
                  ? 'bg-yellow-500 text-yellow-900'
                  : rank === 2
                  ? 'bg-gray-300 text-gray-800'
                  : rank === 3
                  ? 'bg-amber-600 text-amber-100'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              #{rank}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(highlight.category)}`}>
                {getCategoryIcon(highlight.category)} {highlight.category}
              </span>
              {highlight.isEternalCanon && (
                <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">
                  ⭐ Eternal Canon
                </span>
              )}
              {highlight.isFeatured && !highlight.isEternalCanon && (
                <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
                  Featured
                </span>
              )}
            </div>

            <h3 className="font-bold text-white text-lg">{highlight.title}</h3>

            {highlight.description && (
              <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                {highlight.description}
              </p>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className="text-gray-500">
                Tick {formatTicks(highlight.tick)}
              </span>
              <span className="text-gray-500">
                Score: {highlight.score.toFixed(1)}
              </span>
              <span className="text-gray-500">
                👁 {highlight.viewCount.toLocaleString()}
              </span>
              <span className="text-gray-500">
                🔗 {highlight.shareCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Vote buttons */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => onVote?.(highlight.id, 'up')}
              className={`p-2 rounded transition-colors ${
                userVote === 'up'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              ▲
            </button>
            <span
              className={`font-bold ${
                highlight.voteScore > 0
                  ? 'text-green-400'
                  : highlight.voteScore < 0
                  ? 'text-red-400'
                  : 'text-gray-400'
              }`}
            >
              {highlight.voteScore}
            </span>
            <button
              onClick={() => onVote?.(highlight.id, 'down')}
              className={`p-2 rounded transition-colors ${
                userVote === 'down'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              ▼
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <button
          onClick={() => onWatch?.(highlight)}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium transition-colors"
        >
          ▶ Watch
        </button>
        <button
          onClick={() => onShare?.(highlight)}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
        >
          📤 Share
        </button>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
        >
          {isExpanded ? '▲' : '▼'} Details
        </button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-700 pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Event Type:</span>
              <span className="ml-2 text-white">{highlight.eventType}</span>
            </div>
            <div>
              <span className="text-gray-500">Created:</span>
              <span className="ml-2 text-white">
                {new Date(highlight.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          {highlight.highlightData && Object.keys(highlight.highlightData).length > 0 && (
            <div className="mt-3">
              <span className="text-gray-500 text-sm">Additional Data:</span>
              <pre className="mt-1 p-2 bg-gray-900 rounded text-xs text-gray-400 overflow-x-auto">
                {JSON.stringify(highlight.highlightData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Eternal Canon View - Hall of fame for the greatest moments in Pantheon history
 */
export function EternalCanonView({
  onClose,
  onWatchHighlight,
}: EternalCanonViewProps) {
  const [eternalHighlights, setEternalHighlights] = useState<Highlight[]>([]);
  const [featuredHighlights, setFeaturedHighlights] = useState<Highlight[]>([]);
  const [recentHighlights, setRecentHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'eternal' | 'featured' | 'recent'>('eternal');
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});

  // Load highlights
  useEffect(() => {
    async function loadHighlights() {
      try {
        setLoading(true);

        // Fetch all highlight types in parallel
        const [eternalRes, featuredRes, recentRes] = await Promise.all([
          fetch('/api/highlights?eternalCanon=true'),
          fetch('/api/highlights?featured=true'),
          fetch('/api/highlights?limit=20'),
        ]);

        if (eternalRes.ok) {
          const data = await eternalRes.json();
          setEternalHighlights(data.highlights || []);
        }

        if (featuredRes.ok) {
          const data = await featuredRes.json();
          setFeaturedHighlights(data.highlights || []);
        }

        if (recentRes.ok) {
          const data = await recentRes.json();
          setRecentHighlights(data.highlights || []);
        }
      } catch (err) {
        setError('Failed to load highlights');
        console.error('[EternalCanon] Error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadHighlights();
  }, []);

  // Handle voting
  const handleVote = useCallback(
    async (highlightId: string, voteType: 'up' | 'down') => {
      try {
        const response = await fetch(`/api/highlights/${highlightId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voteType }),
        });

        if (response.ok) {
          setUserVotes((prev) => ({ ...prev, [highlightId]: voteType }));

          // Update local vote score
          const updateHighlight = (h: Highlight) =>
            h.id === highlightId
              ? { ...h, voteScore: h.voteScore + (voteType === 'up' ? 1 : -1) }
              : h;

          setEternalHighlights((prev) => prev.map(updateHighlight));
          setFeaturedHighlights((prev) => prev.map(updateHighlight));
          setRecentHighlights((prev) => prev.map(updateHighlight));
        }
      } catch (err) {
        console.error('[EternalCanon] Vote error:', err);
      }
    },
    []
  );

  // Handle share
  const handleShare = useCallback(async (highlight: Highlight) => {
    try {
      // Create spectator link
      const response = await fetch('/api/spectator-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shardId: highlight.shardId,
          startTick: highlight.tick,
          title: highlight.title,
          description: highlight.description,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const shareUrl = `${window.location.origin}/watch/${data.code}`;

        // Try native share, fall back to clipboard
        if (navigator.share) {
          await navigator.share({
            title: highlight.title,
            text: highlight.description || 'Check out this Pantheon highlight!',
            url: shareUrl,
          });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          alert('Link copied to clipboard!');
        }
      }
    } catch (err) {
      console.error('[EternalCanon] Share error:', err);
    }
  }, []);

  // Get current highlights based on active tab
  const currentHighlights =
    activeTab === 'eternal'
      ? eternalHighlights
      : activeTab === 'featured'
      ? featuredHighlights
      : recentHighlights;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p>Loading Eternal Canon...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-900/50 to-amber-900/50 border-b border-yellow-600/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🏛️</span>
            <div>
              <h1 className="text-2xl font-bold text-yellow-400">Eternal Canon</h1>
              <p className="text-yellow-200/70">The Greatest Moments in Pantheon History</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-yellow-900/50 rounded-lg transition-colors text-yellow-400"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-700 px-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('eternal')}
            className={`py-3 px-4 font-medium transition-colors border-b-2 ${
              activeTab === 'eternal'
                ? 'border-yellow-500 text-yellow-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            ⭐ Eternal Canon ({eternalHighlights.length})
          </button>
          <button
            onClick={() => setActiveTab('featured')}
            className={`py-3 px-4 font-medium transition-colors border-b-2 ${
              activeTab === 'featured'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            ✨ Featured ({featuredHighlights.length})
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`py-3 px-4 font-medium transition-colors border-b-2 ${
              activeTab === 'recent'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            🕐 Recent ({recentHighlights.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error ? (
          <div className="text-center text-red-400 py-12">{error}</div>
        ) : currentHighlights.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <span className="text-6xl block mb-4">📭</span>
            <p className="text-xl mb-2">No highlights yet</p>
            <p className="text-sm">
              {activeTab === 'eternal'
                ? 'The greatest moments will be immortalized here'
                : activeTab === 'featured'
                ? 'Featured highlights will appear here'
                : 'Recent highlights will appear here'}
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {currentHighlights.map((highlight, idx) => (
              <HighlightCard
                key={highlight.id}
                highlight={highlight}
                rank={activeTab === 'eternal' ? idx + 1 : undefined}
                onVote={handleVote}
                onWatch={onWatchHighlight}
                onShare={handleShare}
                userVote={userVotes[highlight.id]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with stats */}
      <div className="bg-gray-900 border-t border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center gap-6">
            <span>
              Vote threshold for Eternal Canon: {HIGHLIGHT_THRESHOLDS.eternalCanonVotes} votes
            </span>
            <span>
              Score threshold: {HIGHLIGHT_THRESHOLDS.eternalCanonScore} points
            </span>
          </div>
          <div>
            <span className="text-yellow-400">
              {eternalHighlights.length} moments immortalized
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EternalCanonView;
