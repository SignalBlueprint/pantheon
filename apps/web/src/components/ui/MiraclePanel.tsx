'use client';

import { useState } from 'react';
import { MIRACLE_LIST, Miracle, canAffordMiracle } from '@pantheon/shared';

interface MiraclePanelProps {
  divinePower: number;
  selectedMiracle: string | null;
  onSelectMiracle: (miracleId: string | null) => void;
  onCastMiracle: (miracleId: string, targetId: string) => void;
  cooldowns?: Record<string, number>; // miracleId -> ticks until available
}

export function MiraclePanel({
  divinePower,
  selectedMiracle,
  onSelectMiracle,
  onCastMiracle,
  cooldowns = {},
}: MiraclePanelProps) {
  const handleMiracleClick = (miracle: Miracle) => {
    if (selectedMiracle === miracle.id) {
      // Deselect if already selected
      onSelectMiracle(null);
    } else if (canAffordMiracle(divinePower, miracle.id)) {
      // Select for targeting
      onSelectMiracle(miracle.id);
    }
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
      <h3 className="font-bold text-lg mb-3 text-purple-700 dark:text-purple-300">
        Miracles
      </h3>

      {selectedMiracle && (
        <div className="mb-3 p-2 bg-purple-100 dark:bg-purple-900/30 rounded text-sm text-purple-700 dark:text-purple-300">
          Click a territory on the map to cast
          <button
            className="ml-2 text-purple-500 hover:text-purple-700 underline"
            onClick={() => onSelectMiracle(null)}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="space-y-2">
        {MIRACLE_LIST.map((miracle) => {
          const canAfford = canAffordMiracle(divinePower, miracle.id);
          const cooldownRemaining = cooldowns[miracle.id] || 0;
          const isOnCooldown = cooldownRemaining > 0;
          const isSelected = selectedMiracle === miracle.id;
          const isDisabled = !canAfford || isOnCooldown;

          return (
            <MiracleButton
              key={miracle.id}
              miracle={miracle}
              canAfford={canAfford}
              isOnCooldown={isOnCooldown}
              cooldownRemaining={cooldownRemaining}
              isSelected={isSelected}
              isDisabled={isDisabled}
              onClick={() => handleMiracleClick(miracle)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface MiracleButtonProps {
  miracle: Miracle;
  canAfford: boolean;
  isOnCooldown: boolean;
  cooldownRemaining: number;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
}

function MiracleButton({
  miracle,
  canAfford,
  isOnCooldown,
  cooldownRemaining,
  isSelected,
  isDisabled,
  onClick,
}: MiracleButtonProps) {
  return (
    <button
      className={`w-full text-left p-3 rounded-lg transition-all ${
        isSelected
          ? 'bg-purple-500 text-white ring-2 ring-purple-300'
          : isDisabled
          ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          : 'bg-white dark:bg-gray-700 hover:bg-purple-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100'
      }`}
      onClick={onClick}
      disabled={isDisabled}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium">{miracle.name}</div>
          <div className="text-sm opacity-75">{miracle.description}</div>
        </div>
        <div className="text-right">
          <div
            className={`font-bold ${
              canAfford ? 'text-purple-600 dark:text-purple-400' : 'text-red-500'
            }`}
          >
            {miracle.cost}
          </div>
          {isOnCooldown && (
            <div className="text-xs text-orange-500">{cooldownRemaining} ticks</div>
          )}
        </div>
      </div>
    </button>
  );
}

export default MiraclePanel;
