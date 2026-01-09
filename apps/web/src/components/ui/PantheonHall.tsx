'use client';

import { useState, useEffect } from 'react';
import { Legacy, REWARD_TIERS } from '@pantheon/shared';

interface PantheonHallProps {
  deityId?: string;
}

interface WinnerEntry {
  id: string;
  deity_id: string;
  season_id: string;
  faction_id: string;
  faction_name: string;
  faction_color: string | null;
  rank: number;
  title: string;
  score: number;
  stats: Record<string, unknown>;
  premium_currency_earned: number;
  created_at: string;
  season_name?: string;
}

/**
 * Get title color based on rank
 */
function getTitleColor(rank: number): string {
  if (rank === 1) return 'text-yellow-400';
  if (rank <= 3) return 'text-purple-400';
  if (rank <= 10) return 'text-blue-400';
  return 'text-gray-400';
}

/**
 * Get medal/icon for rank
 */
function getRankIcon(rank: number): string {
  if (rank === 1) return '👑';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  if (rank <= 10) return '🏅';
  return '📜';
}

export function PantheonHall({ deityId }: PantheonHallProps) {
  const [winners, setWinners] = useState<WinnerEntry[]>([]);
  const [deityLegacy, setDeityLegacy] = useState<WinnerEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'hall' | 'legacy'>('hall');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Pantheon Hall data
  useEffect(() => {
    async function fetchHall() {
      try {
        const response = await fetch('/api/pantheon-hall?limit=20');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setWinners(data.winners || []);
      } catch (err) {
        setError('Failed to load Pantheon Hall');
        console.error('[PantheonHall] Error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchHall();
  }, []);

  // Fetch deity's personal legacy
  useEffect(() => {
    if (!deityId) return;

    async function fetchLegacy() {
      try {
        const response = await fetch(`/api/legacy/${deityId}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setDeityLegacy(data.legacy || []);
      } catch (err) {
        console.error('[PantheonHall] Error fetching legacy:', err);
      }
    }

    fetchLegacy();
  }, [deityId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
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
      <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-600 to-yellow-500">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🏛️</span> Pantheon Hall
        </h2>
        <p className="text-amber-100 text-sm mt-1">
          Eternal glory to those who shaped the world
        </p>
      </div>

      {/* Tabs */}
      {deityId && (
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'hall'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('hall')}
          >
            Hall of Fame
          </button>
          <button
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'legacy'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            onClick={() => setActiveTab('legacy')}
          >
            My Legacy
          </button>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {activeTab === 'hall' ? (
          <HallOfFame winners={winners} />
        ) : (
          <PersonalLegacy legacy={deityLegacy} />
        )}
      </div>

      {/* Reward tiers info */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Season Rewards
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span>👑</span>
            <span className="text-yellow-500 font-medium">{REWARD_TIERS.first.title}</span>
            <span className="text-gray-500">({REWARD_TIERS.first.currency})</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🥈</span>
            <span className="text-purple-500 font-medium">{REWARD_TIERS.second.title}</span>
            <span className="text-gray-500">({REWARD_TIERS.second.currency})</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🏅</span>
            <span className="text-blue-500 font-medium">{REWARD_TIERS.topTen.title}</span>
            <span className="text-gray-500">({REWARD_TIERS.topTen.currency})</span>
          </div>
          <div className="flex items-center gap-1">
            <span>📜</span>
            <span className="text-gray-500 font-medium">{REWARD_TIERS.participation.title}</span>
            <span className="text-gray-500">({REWARD_TIERS.participation.currency})</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hall of Fame display - shows top winners across all seasons
 */
function HallOfFame({ winners }: { winners: WinnerEntry[] }) {
  if (winners.length === 0) {
    return (
      <div className="text-center py-8">
        <span className="text-4xl mb-4 block">🏛️</span>
        <p className="text-gray-500">No champions yet</p>
        <p className="text-gray-400 text-sm">Be the first to claim eternal glory!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {winners.map((winner) => (
        <div
          key={winner.id}
          className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
        >
          {/* Rank icon */}
          <span className="text-2xl">{getRankIcon(winner.rank)}</span>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-bold ${getTitleColor(winner.rank)}`}>
                {winner.title}
              </span>
              <span className="text-gray-900 dark:text-white font-medium">
                {winner.faction_name}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {winner.score.toLocaleString()} points
              {winner.season_name && ` • ${winner.season_name}`}
            </div>
          </div>

          {/* Color indicator */}
          {winner.faction_color && (
            <div
              className="w-4 h-4 rounded-full border border-gray-300"
              style={{ backgroundColor: winner.faction_color }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Personal legacy display - shows player's achievements across seasons
 */
function PersonalLegacy({ legacy }: { legacy: WinnerEntry[] }) {
  if (legacy.length === 0) {
    return (
      <div className="text-center py-8">
        <span className="text-4xl mb-4 block">📜</span>
        <p className="text-gray-500">No legacy yet</p>
        <p className="text-gray-400 text-sm">Complete a season to build your legacy!</p>
      </div>
    );
  }

  // Calculate total currency earned
  const totalCurrency = legacy.reduce((sum, l) => sum + (l.premium_currency_earned || 0), 0);
  const bestRank = Math.min(...legacy.map((l) => l.rank));
  const totalSeasons = legacy.length;

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg">
        <div className="text-center">
          <p className="text-2xl font-bold text-purple-600">{totalSeasons}</p>
          <p className="text-xs text-gray-500">Seasons</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-yellow-500">#{bestRank}</p>
          <p className="text-xs text-gray-500">Best Rank</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-500">{totalCurrency}</p>
          <p className="text-xs text-gray-500">Currency</p>
        </div>
      </div>

      {/* Season list */}
      <div className="space-y-2">
        {legacy.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 p-2 rounded border border-gray-100 dark:border-gray-700"
          >
            <span className="text-xl">{getRankIcon(entry.rank)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${getTitleColor(entry.rank)}`}>
                  #{entry.rank}
                </span>
                <span className="text-gray-900 dark:text-white text-sm">
                  {entry.faction_name}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {entry.score.toLocaleString()} pts • +{entry.premium_currency_earned}
              </div>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(entry.created_at).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PantheonHall;
