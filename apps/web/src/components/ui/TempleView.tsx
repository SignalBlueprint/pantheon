'use client';

import { useState, useEffect, useCallback } from 'react';
import { Myth, MythEventType } from '@pantheon/shared';

interface TempleViewProps {
  factionId: string;
  factionName?: string;
  factionColor?: string;
  isOwnFaction?: boolean;
}

/**
 * Get icon for myth event type
 */
function getMythIcon(eventType: MythEventType): string {
  const icons: Record<MythEventType, string> = {
    great_battle: '⚔️',
    divine_intervention: '✨',
    hero_death: '💀',
    city_founding: '🏛️',
    betrayal: '🗡️',
    siege_victory: '🏰',
    dominance_achieved: '👑',
    miracle_smite: '⚡',
  };
  return icons[eventType] || '📜';
}

/**
 * Get color class for myth event type
 */
function getMythColor(eventType: MythEventType): string {
  const colors: Record<MythEventType, string> = {
    great_battle: 'text-red-600 dark:text-red-400',
    divine_intervention: 'text-purple-600 dark:text-purple-400',
    hero_death: 'text-gray-600 dark:text-gray-400',
    city_founding: 'text-green-600 dark:text-green-400',
    betrayal: 'text-orange-600 dark:text-orange-400',
    siege_victory: 'text-blue-600 dark:text-blue-400',
    dominance_achieved: 'text-yellow-600 dark:text-yellow-400',
    miracle_smite: 'text-indigo-600 dark:text-indigo-400',
  };
  return colors[eventType] || 'text-gray-600';
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Temple View - displays faction myths/lore
 */
export function TempleView({
  factionId,
  factionName = 'Unknown Faction',
  factionColor,
  isOwnFaction = false,
}: TempleViewProps) {
  const [myths, setMyths] = useState<Myth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMyth, setSelectedMyth] = useState<Myth | null>(null);
  const [filterType, setFilterType] = useState<MythEventType | 'all'>('all');

  // Fetch myths for the faction
  useEffect(() => {
    async function fetchMyths() {
      try {
        setLoading(true);
        const response = await fetch(`/api/myths/faction/${factionId}`);
        if (!response.ok) throw new Error('Failed to fetch myths');
        const data = await response.json();
        setMyths(data.myths || []);
      } catch (err) {
        setError('Failed to load myths');
        console.error('[TempleView] Error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMyths();
  }, [factionId]);

  // Handle myth share
  const handleShare = useCallback(async (myth: Myth) => {
    try {
      // Record share
      await fetch(`/api/myths/${myth.id}/share`, { method: 'POST' });

      // Copy to clipboard
      const shareText = `${myth.title}\n\n${myth.generatedText}\n\n- From the chronicles of ${factionName}`;
      await navigator.clipboard.writeText(shareText);

      alert('Myth copied to clipboard!');
    } catch (err) {
      console.error('[TempleView] Share error:', err);
    }
  }, [factionName]);

  // Filter myths by type
  const filteredMyths = filterType === 'all'
    ? myths
    : myths.filter(m => m.eventType === filterType);

  // Event type filter options
  const eventTypes: (MythEventType | 'all')[] = [
    'all',
    'great_battle',
    'divine_intervention',
    'siege_victory',
    'city_founding',
    'betrayal',
    'dominance_achieved',
    'hero_death',
    'miracle_smite',
  ];

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
        <p className="text-red-500 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-4 border-b border-gray-200 dark:border-gray-700"
        style={{
          background: factionColor
            ? `linear-gradient(135deg, ${factionColor}cc, ${factionColor}88)`
            : 'linear-gradient(135deg, #8B5CF6, #6366F1)',
        }}
      >
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🏛️</span> Temple of {factionName}
        </h2>
        <p className="text-white/80 text-sm mt-1">
          {myths.length} {myths.length === 1 ? 'myth' : 'myths'} recorded
        </p>
      </div>

      {/* Filter tabs */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-x-auto">
        <div className="flex gap-2">
          {eventTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                filterType === type
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {type === 'all' ? 'All' : (
                <>
                  {getMythIcon(type)} {formatEventType(type)}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Myths list */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {filteredMyths.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-4xl mb-4 block">📜</span>
            <p className="text-gray-500">No myths recorded yet</p>
            <p className="text-gray-400 text-sm">Great deeds shall be remembered here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMyths.map((myth) => (
              <MythCard
                key={myth.id}
                myth={myth}
                onClick={() => setSelectedMyth(myth)}
                onShare={() => handleShare(myth)}
                isOwnFaction={isOwnFaction}
              />
            ))}
          </div>
        )}
      </div>

      {/* Myth detail modal */}
      {selectedMyth && (
        <MythDetailModal
          myth={selectedMyth}
          factionName={factionName}
          onClose={() => setSelectedMyth(null)}
          onShare={() => handleShare(selectedMyth)}
        />
      )}
    </div>
  );
}

/**
 * Individual myth card
 */
function MythCard({
  myth,
  onClick,
  onShare,
  isOwnFaction,
}: {
  myth: Myth;
  onClick: () => void;
  onShare: () => void;
  isOwnFaction: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
        myth.isNotable
          ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className={`text-2xl ${getMythColor(myth.eventType)}`}>
          {getMythIcon(myth.eventType)}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {myth.title}
            </h3>
            {myth.isNotable && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
                Notable
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
            {myth.generatedText}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>{formatDate(myth.createdAt)}</span>
            <span>{myth.views} views</span>
            {myth.shares > 0 && <span>{myth.shares} shares</span>}
          </div>
        </div>

        {/* Share button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Share myth"
        >
          <span className="text-gray-400">📤</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Full myth detail modal
 */
function MythDetailModal({
  myth,
  factionName,
  onClose,
  onShare,
}: {
  myth: Myth;
  factionName: string;
  onClose: () => void;
  onShare: () => void;
}) {
  // Record view on mount
  useEffect(() => {
    fetch(`/api/myths/${myth.id}/view`, { method: 'POST' }).catch(() => {});
  }, [myth.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-600 to-orange-500">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getMythIcon(myth.eventType)}</span>
            <div>
              <h2 className="text-xl font-bold text-white">{myth.title}</h2>
              <p className="text-amber-100 text-sm">
                From the chronicles of {factionName}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed whitespace-pre-wrap">
            {myth.generatedText}
          </p>

          {myth.isNotable && (
            <div className="mt-4 p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-amber-800 dark:text-amber-200 text-sm font-medium">
                This myth is of particular significance in the annals of history.
              </p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <span>Recorded at tick {myth.tickCreated}</span>
              <span>{myth.views + 1} views</span>
              {myth.shares > 0 && <span>{myth.shares} shares</span>}
            </div>
            <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
              {formatEventType(myth.eventType)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onShare}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <span>📤</span> Share Myth
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Format event type for display
 */
function formatEventType(type: MythEventType): string {
  const labels: Record<MythEventType, string> = {
    great_battle: 'Battle',
    divine_intervention: 'Divine',
    hero_death: 'Hero',
    city_founding: 'Founding',
    betrayal: 'Betrayal',
    siege_victory: 'Siege',
    dominance_achieved: 'Dominance',
    miracle_smite: 'Smite',
  };
  return labels[type] || type;
}

export default TempleView;
