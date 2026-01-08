'use client';

import { useState, useEffect } from 'react';
import { Season, SeasonRanking, REWARD_TIERS } from '@pantheon/shared';

interface SeasonCountdownProps {
  season: Season | null;
  rankings?: SeasonRanking[];
}

/**
 * Format time remaining in human-readable form
 */
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Season Ended';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get progress percentage
 */
function getProgress(startedAt: number, endsAt: number): number {
  const now = Date.now();
  const total = endsAt - startedAt;
  const elapsed = now - startedAt;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

export function SeasonCountdown({ season, rankings = [] }: SeasonCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (!season) return;

    const updateTime = () => {
      setTimeRemaining(Math.max(0, season.endsAt - Date.now()));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [season]);

  if (!season) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-gray-500 text-center">No active season</p>
      </div>
    );
  }

  const progress = getProgress(season.startedAt, season.endsAt);
  const isEnded = season.status === 'ended';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-600 to-indigo-600">
        <h3 className="font-bold text-white flex items-center gap-2">
          <span>🏆</span> {season.name}
        </h3>
      </div>

      {/* Countdown */}
      <div className="p-4">
        {isEnded ? (
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Season Complete!
            </p>
            {season.victoryType && (
              <p className="text-sm text-gray-500">
                {season.victoryType.charAt(0).toUpperCase() + season.victoryType.slice(1)} Victory
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="text-center mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Time Remaining</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatTimeRemaining(timeRemaining)}
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
              <div
                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-gray-500">
              <span>Started {new Date(season.startedAt).toLocaleDateString()}</span>
              <span>Ends {new Date(season.endsAt).toLocaleDateString()}</span>
            </div>
          </>
        )}
      </div>

      {/* Rankings preview */}
      {rankings.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            {isEnded ? 'Final Standings' : 'Current Standings'}
          </h4>
          <div className="space-y-2">
            {rankings.slice(0, 5).map((ranking) => (
              <div
                key={ranking.factionId}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${
                    ranking.rank === 1 ? 'text-yellow-500' :
                    ranking.rank === 2 ? 'text-gray-400' :
                    ranking.rank === 3 ? 'text-orange-400' :
                    'text-gray-600 dark:text-gray-400'
                  }`}>
                    #{ranking.rank}
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {ranking.factionName}
                  </span>
                </div>
                <span className="text-gray-500">
                  {ranking.score.toLocaleString()} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Victory conditions info */}
      {!isEnded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Victory Conditions
          </h4>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Control 60% of territories for 48 hours</li>
            <li>• Eliminate all other factions</li>
            <li>• Highest score when time expires</li>
          </ul>
        </div>
      )}

      {/* Rewards info */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Season Rewards
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-yellow-500">🥇</span>
            <span className="text-gray-600 dark:text-gray-400">
              {REWARD_TIERS.first.title} ({REWARD_TIERS.first.currency})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">🥈</span>
            <span className="text-gray-600 dark:text-gray-400">
              {REWARD_TIERS.second.title} ({REWARD_TIERS.second.currency})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-orange-400">🥉</span>
            <span className="text-gray-600 dark:text-gray-400">
              {REWARD_TIERS.third.title} ({REWARD_TIERS.third.currency})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span>🏅</span>
            <span className="text-gray-600 dark:text-gray-400">
              Top 10: {REWARD_TIERS.topTen.title}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SeasonCountdown;
