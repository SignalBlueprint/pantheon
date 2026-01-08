'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Champion,
  ChampionType,
  ChampionStats,
  CHAMPION_BLESS_COST,
  CHAMPION_GENERAL_COMBAT_BONUS,
} from '@pantheon/shared';

interface ChampionPanelProps {
  factionId: string;
  factionName?: string;
  isOwnFaction?: boolean;
  currentDivinePower?: number;
  onBless?: (championId: string) => void;
}

/**
 * Get icon for champion type
 */
function getChampionIcon(type: ChampionType): string {
  const icons: Record<ChampionType, string> = {
    general: '⚔️',
  };
  return icons[type] || '👤';
}

/**
 * Get color class for champion status
 */
function getStatusColor(champion: Champion): string {
  if (!champion.isAlive) return 'text-gray-400';
  if (champion.blessed) return 'text-amber-500';
  return 'text-blue-500';
}

/**
 * Format age as readable time
 */
function formatAge(age: number): string {
  if (age < 60) return `${age}s`;
  if (age < 3600) return `${Math.floor(age / 60)}m`;
  return `${Math.floor(age / 3600)}h ${Math.floor((age % 3600) / 60)}m`;
}

/**
 * Format lifespan remaining
 */
function formatLifespanRemaining(champion: Champion): string {
  const remaining = champion.maxLifespan - champion.age;
  if (remaining <= 0) return 'dying';
  return formatAge(remaining);
}

/**
 * Get progress bar color based on remaining lifespan
 */
function getLifespanColor(champion: Champion): string {
  const percentage = ((champion.maxLifespan - champion.age) / champion.maxLifespan) * 100;
  if (percentage > 50) return 'bg-green-500';
  if (percentage > 25) return 'bg-yellow-500';
  return 'bg-red-500';
}

/**
 * Champion Panel - displays faction's champions
 */
export function ChampionPanel({
  factionId,
  factionName = 'Unknown Faction',
  isOwnFaction = false,
  currentDivinePower = 0,
  onBless,
}: ChampionPanelProps) {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Fetch champions for the faction
  useEffect(() => {
    async function fetchChampions() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/champions/faction/${factionId}?aliveOnly=${!showAll}`
        );
        if (!response.ok) throw new Error('Failed to fetch champions');
        const data = await response.json();
        setChampions(data.champions || []);
      } catch (err) {
        setError('Failed to load champions');
        console.error('[ChampionPanel] Error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchChampions();
    // Refresh every 10 seconds
    const interval = setInterval(fetchChampions, 10000);
    return () => clearInterval(interval);
  }, [factionId, showAll]);

  // Handle blessing a champion
  const handleBless = useCallback(async (champion: Champion) => {
    if (!isOwnFaction || champion.blessed) return;
    if (currentDivinePower < CHAMPION_BLESS_COST) {
      alert(`Not enough divine power (need ${CHAMPION_BLESS_COST})`);
      return;
    }

    try {
      const response = await fetch(`/api/champions/${champion.id}/bless`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to bless champion');
      }

      // Update local state
      setChampions(prev =>
        prev.map(c =>
          c.id === champion.id
            ? { ...c, blessed: true }
            : c
        )
      );

      onBless?.(champion.id);
    } catch (err) {
      console.error('[ChampionPanel] Bless error:', err);
      alert(err instanceof Error ? err.message : 'Failed to bless champion');
    }
  }, [factionId, isOwnFaction, currentDivinePower, onBless]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-red-500 text-center">{error}</p>
      </div>
    );
  }

  const aliveChampions = champions.filter(c => c.isAlive);
  const deadChampions = champions.filter(c => !c.isAlive);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>⚔️</span> Champions of {factionName}
          </h2>
          <span className="text-white/80 text-sm">
            {aliveChampions.length} alive
          </span>
        </div>
      </div>

      {/* Toggle dead champions */}
      {deadChampions.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded"
            />
            Show fallen champions ({deadChampions.length})
          </label>
        </div>
      )}

      {/* Champions list */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        {champions.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-4xl mb-4 block">👤</span>
            <p className="text-gray-500">No champions yet</p>
            <p className="text-gray-400 text-sm">
              Champions emerge from territories with 1000+ population
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {champions.map((champion) => (
              <ChampionCard
                key={champion.id}
                champion={champion}
                isOwnFaction={isOwnFaction}
                canBless={isOwnFaction && !champion.blessed && champion.isAlive && currentDivinePower >= CHAMPION_BLESS_COST}
                onBless={() => handleBless(champion)}
                onClick={() => setSelectedChampion(champion)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Champion detail modal */}
      {selectedChampion && (
        <ChampionDetailModal
          champion={selectedChampion}
          factionName={factionName}
          isOwnFaction={isOwnFaction}
          canBless={isOwnFaction && !selectedChampion.blessed && selectedChampion.isAlive && currentDivinePower >= CHAMPION_BLESS_COST}
          onBless={() => handleBless(selectedChampion)}
          onClose={() => setSelectedChampion(null)}
        />
      )}
    </div>
  );
}

/**
 * Individual champion card
 */
function ChampionCard({
  champion,
  isOwnFaction,
  canBless,
  onBless,
  onClick,
}: {
  champion: Champion;
  isOwnFaction: boolean;
  canBless: boolean;
  onBless: () => void;
  onClick: () => void;
}) {
  const lifespanPercentage = Math.max(0, Math.min(100,
    ((champion.maxLifespan - champion.age) / champion.maxLifespan) * 100
  ));

  return (
    <div
      className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
        !champion.isAlive
          ? 'border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 opacity-60'
          : champion.blessed
          ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`text-2xl ${getStatusColor(champion)}`}>
          {getChampionIcon(champion.type)}
          {champion.blessed && <span className="text-xs">✨</span>}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {champion.name}
            </h3>
            {champion.blessed && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
                Blessed
              </span>
            )}
            {!champion.isAlive && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                Fallen
              </span>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <span title="Combat">⚔️ {champion.stats.combat}</span>
            <span title="Leadership">👑 {champion.stats.leadership}</span>
            <span title="Battles won">{champion.battlesWon}W / {champion.battlesFought}B</span>
          </div>

          {/* Lifespan bar */}
          {champion.isAlive && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Lifespan</span>
                <span>{formatLifespanRemaining(champion)} remaining</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getLifespanColor(champion)} transition-all`}
                  style={{ width: `${lifespanPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Bless button */}
        {canBless && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBless();
            }}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition-colors"
            title={`Bless champion (${CHAMPION_BLESS_COST} divine power)`}
          >
            ✨ Bless
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Champion detail modal
 */
function ChampionDetailModal({
  champion,
  factionName,
  isOwnFaction,
  canBless,
  onBless,
  onClose,
}: {
  champion: Champion;
  factionName: string;
  isOwnFaction: boolean;
  canBless: boolean;
  onBless: () => void;
  onClose: () => void;
}) {
  const lifespanPercentage = Math.max(0, Math.min(100,
    ((champion.maxLifespan - champion.age) / champion.maxLifespan) * 100
  ));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 ${
          champion.blessed
            ? 'bg-gradient-to-r from-amber-600 to-orange-500'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">
              {getChampionIcon(champion.type)}
              {champion.blessed && <span className="text-sm">✨</span>}
            </span>
            <div>
              <h2 className="text-xl font-bold text-white">{champion.name}</h2>
              <p className="text-white/80 text-sm">
                General of {factionName}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Status badges */}
          <div className="flex items-center gap-2 mb-4">
            {champion.blessed && (
              <span className="px-2 py-1 text-sm rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                ✨ Divinely Blessed
              </span>
            )}
            {!champion.isAlive && (
              <span className="px-2 py-1 text-sm rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                💀 Fallen Hero
              </span>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatBox label="Combat" value={champion.stats.combat} icon="⚔️" />
            <StatBox label="Leadership" value={champion.stats.leadership} icon="👑" />
            <StatBox label="Loyalty" value={champion.stats.loyalty} icon="❤️" />
          </div>

          {/* Combat bonus info */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 mb-4">
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              <strong>Combat Bonus:</strong> +{Math.round(CHAMPION_GENERAL_COMBAT_BONUS * 100)}%
              army strength when leading
              {champion.blessed && (
                <span className="text-amber-600 dark:text-amber-400">
                  {' '}(+{Math.round((champion.stats.combat / 100) * 10)}% from stats)
                </span>
              )}
            </p>
          </div>

          {/* Battle record */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatBox label="Battles" value={champion.battlesFought} />
            <StatBox label="Victories" value={champion.battlesWon} />
            <StatBox label="Kills" value={champion.kills} />
          </div>

          {/* Lifespan */}
          {champion.isAlive ? (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span>Lifespan</span>
                <span>
                  {formatAge(champion.age)} / {formatAge(champion.maxLifespan)}
                  {' '}({formatLifespanRemaining(champion)} remaining)
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getLifespanColor(champion)} transition-all`}
                  style={{ width: `${lifespanPercentage}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 mb-4">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                <strong>Cause of Death:</strong> {champion.deathCause?.replace('_', ' ') || 'Unknown'}
                <br />
                <strong>Age at Death:</strong> {formatAge(champion.age)}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Close
          </button>
          {canBless && (
            <button
              onClick={onBless}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <span>✨</span> Bless Champion ({CHAMPION_BLESS_COST} DP)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Stat display box
 */
function StatBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: string;
}) {
  return (
    <div className="text-center p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
      {icon && <span className="text-lg">{icon}</span>}
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default ChampionPanel;
