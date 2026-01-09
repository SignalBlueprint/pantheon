'use client';

import { useState, useCallback } from 'react';
import {
  Specialization,
  SPECIALIZATIONS,
  SpecializationType,
} from '@pantheon/shared';

interface SpecializationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChoose: (specializationType: Exclude<SpecializationType, null>) => void;
  factionName?: string;
}

/**
 * Modal for choosing a faction specialization
 * Displayed when a faction meets the unlock requirements
 */
export function SpecializationModal({
  isOpen,
  onClose,
  onChoose,
  factionName = 'Your faction',
}: SpecializationModalProps) {
  const [selectedSpec, setSelectedSpec] = useState<Exclude<SpecializationType, null> | null>(null);
  const [isChoosing, setIsChoosing] = useState(false);

  const specializations = Object.values(SPECIALIZATIONS);

  const handleChoose = useCallback(async () => {
    if (!selectedSpec) return;

    setIsChoosing(true);
    try {
      onChoose(selectedSpec);
    } finally {
      setIsChoosing(false);
    }
  }, [selectedSpec, onChoose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-600 to-indigo-600">
          <h2 className="text-2xl font-bold text-white">Choose Your Path</h2>
          <p className="text-purple-100 mt-1">
            {factionName} has unlocked the ability to specialize. This choice is permanent!
          </p>
        </div>

        {/* Specialization Grid */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {specializations.map((spec) => (
              <SpecializationCard
                key={spec.id}
                spec={spec}
                isSelected={selectedSpec === spec.id}
                onSelect={() => setSelectedSpec(spec.id as Exclude<SpecializationType, null>)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Decide Later
          </button>
          <button
            onClick={handleChoose}
            disabled={!selectedSpec || isChoosing}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              selectedSpec && !isChoosing
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isChoosing ? 'Choosing...' : 'Confirm Choice'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Card displaying a single specialization option
 */
function SpecializationCard({
  spec,
  isSelected,
  onSelect,
}: {
  spec: Specialization;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`text-left p-4 rounded-lg border-2 transition-all ${
        isSelected
          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{spec.icon}</span>
        <div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">
            {spec.name}
          </h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {spec.description}
      </p>

      {/* Bonuses */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase">Bonuses</h4>
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
      <div className="mt-3 space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase">Abilities</h4>
        {spec.abilities.map((ability) => (
          <div
            key={ability.id}
            className="text-xs text-gray-600 dark:text-gray-400"
          >
            <span className="font-medium text-gray-800 dark:text-gray-300">
              {ability.name}
            </span>
            {ability.isPassive ? (
              <span className="ml-1 text-blue-600">(Passive)</span>
            ) : (
              <span className="ml-1 text-orange-600">({ability.cost} DP)</span>
            )}
            <span className="block text-xs text-gray-500">{ability.description}</span>
          </div>
        ))}
      </div>

      {/* Unique Buildings */}
      <div className="mt-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase">Unique Buildings</h4>
        <div className="flex flex-wrap gap-1 mt-1">
          {spec.uniqueBuildings.map((building) => (
            <span
              key={building}
              className="px-2 py-0.5 text-xs rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
            >
              {formatBuildingName(building)}
            </span>
          ))}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="mt-4 text-center text-purple-600 dark:text-purple-400 font-medium">
          Selected
        </div>
      )}
    </button>
  );
}

/**
 * Format a bonus key/value into a human-readable label
 */
function formatBonusLabel(key: string, value: unknown): string | null {
  if (typeof value === 'boolean') {
    if (!value) return null;
    // Format boolean abilities
    const labels: Record<string, string> = {
      canBuildShips: 'Build Ships',
      canSettleIslands: 'Settle Islands',
      canRaidWithoutSiege: 'Raid Without Siege',
      useCampsInsteadOfCities: 'Mobile Camps',
    };
    return labels[key] || key;
  }

  if (typeof value === 'number') {
    // Format multiplier bonuses
    const labels: Record<string, string> = {
      defenseMultiplier: 'Defense',
      populationCapMultiplier: 'Population Cap',
      movementSpeedMultiplier: 'Movement Speed',
      foodProductionMultiplier: 'Food Production',
      productionMultiplier: 'Production',
      navalCombatBonus: 'Naval Combat',
      miningBonus: 'Mining',
      tradeBonus: 'Trade',
      raidDamageMultiplier: 'Raid Damage',
    };

    const label = labels[key] || key;

    // Format as percentage
    if (value > 1) {
      return `+${Math.round((value - 1) * 100)}% ${label}`;
    } else if (value < 1) {
      return `${Math.round((value - 1) * 100)}% ${label}`;
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

export default SpecializationModal;
