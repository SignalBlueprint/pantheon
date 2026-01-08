'use client';

import { useState } from 'react';
import {
  SpecializationType,
  Specialization,
  SPECIALIZATIONS,
} from '@pantheon/shared';

interface SpecializationIndicatorProps {
  specialization: SpecializationType;
  unlockAvailable?: boolean;
  onUnlockClick?: () => void;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
  showLockedPaths?: boolean;
}

/**
 * Displays the faction's current specialization or unlock availability
 */
export function SpecializationIndicator({
  specialization,
  unlockAvailable = false,
  onUnlockClick,
  size = 'medium',
  showDetails = false,
  showLockedPaths = false,
}: SpecializationIndicatorProps) {
  // If no specialization and unlock is available
  if (!specialization && unlockAvailable) {
    return (
      <button
        onClick={onUnlockClick}
        className={`flex items-center gap-2 rounded-lg transition-all ${
          size === 'small'
            ? 'px-2 py-1 text-xs'
            : size === 'large'
            ? 'px-4 py-3 text-base'
            : 'px-3 py-2 text-sm'
        } bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 animate-pulse`}
      >
        <span>✨</span>
        <span className="font-medium">Choose Specialization</span>
      </button>
    );
  }

  // If no specialization and no unlock available
  if (!specialization) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg ${
          size === 'small'
            ? 'px-2 py-1 text-xs'
            : size === 'large'
            ? 'px-4 py-3 text-base'
            : 'px-3 py-2 text-sm'
        } bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400`}
      >
        <span>🔒</span>
        <span>No Specialization</span>
      </div>
    );
  }

  // Get specialization data
  const spec = SPECIALIZATIONS[specialization];
  if (!spec) return null;

  // Compact view
  if (!showDetails) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg ${
          size === 'small'
            ? 'px-2 py-1 text-xs'
            : size === 'large'
            ? 'px-4 py-3 text-base'
            : 'px-3 py-2 text-sm'
        } ${getSpecializationColors(specialization)}`}
      >
        <span className={size === 'small' ? 'text-sm' : size === 'large' ? 'text-2xl' : 'text-xl'}>
          {spec.icon}
        </span>
        <span className="font-medium">{spec.name}</span>
      </div>
    );
  }

  // Detailed view
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className={`px-4 py-3 ${getSpecializationGradient(specialization)}`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{spec.icon}</span>
          <div>
            <h3 className="font-bold text-white">{spec.name}</h3>
            <p className="text-sm text-white/80">{spec.description}</p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white dark:bg-gray-900 space-y-4">
        {/* Active Bonuses */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Active Bonuses
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(spec.bonuses).map(([key, value]) => {
              if (value === undefined) return null;
              const label = formatBonusLabel(key, value);
              if (!label) return null;
              return (
                <span
                  key={key}
                  className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Abilities */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Abilities
          </h4>
          <div className="space-y-2">
            {spec.abilities.map((ability) => (
              <div
                key={ability.id}
                className="flex items-start gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800"
              >
                <span className={ability.isPassive ? 'text-blue-500' : 'text-orange-500'}>
                  {ability.isPassive ? '◆' : '◈'}
                </span>
                <div>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {ability.name}
                  </span>
                  {!ability.isPassive && (
                    <span className="ml-2 text-xs text-orange-600">
                      {ability.cost} DP
                    </span>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {ability.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Unique Buildings */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Unique Buildings
          </h4>
          <div className="flex flex-wrap gap-1">
            {spec.uniqueBuildings.map((building) => (
              <span
                key={building}
                className="px-2 py-1 text-xs rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
              >
                {formatBuildingName(building)}
              </span>
            ))}
          </div>
        </div>

        {/* Locked Paths - show other specializations that weren't chosen */}
        {showLockedPaths && (
          <LockedPathsSection currentSpecialization={specialization} />
        )}
      </div>
    </div>
  );
}

/**
 * Get background colors for specialization badge
 */
function getSpecializationColors(type: Exclude<SpecializationType, null>): string {
  const colors: Record<Exclude<SpecializationType, null>, string> = {
    maritime: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    fortress: 'bg-stone-100 dark:bg-stone-900/30 text-stone-700 dark:text-stone-400',
    plains: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    nomadic: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  };
  return colors[type] || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
}

/**
 * Get gradient colors for specialization header
 */
function getSpecializationGradient(type: Exclude<SpecializationType, null>): string {
  const gradients: Record<Exclude<SpecializationType, null>, string> = {
    maritime: 'bg-gradient-to-r from-blue-600 to-cyan-500',
    fortress: 'bg-gradient-to-r from-stone-600 to-amber-600',
    plains: 'bg-gradient-to-r from-green-600 to-emerald-500',
    nomadic: 'bg-gradient-to-r from-amber-600 to-orange-500',
  };
  return gradients[type] || 'bg-gradient-to-r from-gray-600 to-gray-500';
}

/**
 * Format a bonus key/value into a human-readable label
 */
function formatBonusLabel(key: string, value: unknown): string | null {
  if (typeof value === 'boolean') {
    if (!value) return null;
    const labels: Record<string, string> = {
      canBuildShips: 'Ships',
      canSettleIslands: 'Islands',
      canRaidWithoutSiege: 'Raids',
      useCampsInsteadOfCities: 'Camps',
    };
    return labels[key] || key;
  }

  if (typeof value === 'number') {
    const labels: Record<string, string> = {
      defenseMultiplier: 'Def',
      populationCapMultiplier: 'Pop',
      movementSpeedMultiplier: 'Speed',
      foodProductionMultiplier: 'Food',
      productionMultiplier: 'Prod',
      navalCombatBonus: 'Naval',
      miningBonus: 'Mining',
      tradeBonus: 'Trade',
      raidDamageMultiplier: 'Raid',
    };

    const label = labels[key] || key;

    if (value > 1) {
      return `+${Math.round((value - 1) * 100)}% ${label}`;
    } else if (value > 0 && value <= 1) {
      return `+${Math.round(value * 100)}% ${label}`;
    }
  }

  return null;
}

/**
 * Format a building name for display
 */
function formatBuildingName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Component showing locked specialization paths that weren't chosen
 */
function LockedPathsSection({
  currentSpecialization,
}: {
  currentSpecialization: Exclude<SpecializationType, null>;
}) {
  // Get all other specializations that weren't chosen
  const lockedSpecs = Object.values(SPECIALIZATIONS).filter(
    (spec) => spec.id !== currentSpecialization
  );

  if (lockedSpecs.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1">
        <span>Paths Not Taken</span>
        <span className="text-gray-400">(Permanently Locked)</span>
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {lockedSpecs.map((spec) => (
          <LockedSpecCard key={spec.id} spec={spec} />
        ))}
      </div>
    </div>
  );
}

/**
 * Card displaying a locked specialization that wasn't chosen
 */
function LockedSpecCard({ spec }: { spec: Specialization }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 overflow-hidden opacity-60 hover:opacity-80 transition-opacity"
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400">🔒</span>
          <span className="text-lg grayscale">{spec.icon}</span>
          <span className="font-medium text-gray-600 dark:text-gray-400 text-sm">
            {spec.name}
          </span>
        </div>
        <span className="text-gray-400 text-xs">
          {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-3 text-xs text-gray-500 dark:text-gray-400 space-y-2">
          <p className="italic">{spec.description}</p>

          {/* What you missed */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="font-medium text-gray-600 dark:text-gray-400">
              Missed bonuses:
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(spec.bonuses).map(([key, value]) => {
                if (value === undefined) return null;
                const label = formatBonusLabel(key, value);
                if (!label) return null;
                return (
                  <span
                    key={key}
                    className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 line-through"
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Missed abilities */}
          <div>
            <span className="font-medium text-gray-600 dark:text-gray-400">
              Missed abilities:
            </span>
            <div className="mt-1 space-y-1">
              {spec.abilities.map((ability) => (
                <div key={ability.id} className="flex items-center gap-1 line-through">
                  <span className="text-gray-400">{ability.isPassive ? '◆' : '◈'}</span>
                  <span>{ability.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Missed buildings */}
          <div>
            <span className="font-medium text-gray-600 dark:text-gray-400">
              Missed buildings:
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {spec.uniqueBuildings.map((building) => (
                <span
                  key={building}
                  className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 line-through"
                >
                  {formatBuildingName(building)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SpecializationIndicator;
