'use client';

import { DIVINE_POWER_MAX } from '@pantheon/shared';

interface DivinePowerBarProps {
  current: number;
  max?: number;
  regenRate?: number;
}

export function DivinePowerBar({
  current,
  max = DIVINE_POWER_MAX,
  regenRate = 1,
}: DivinePowerBarProps) {
  const percentage = Math.min(100, (current / max) * 100);

  // Color based on power level
  const getBarColor = () => {
    if (percentage > 66) return 'bg-purple-500';
    if (percentage > 33) return 'bg-purple-400';
    return 'bg-purple-300';
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
          Divine Power
        </span>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {current} / {max}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full ${getBarColor()} transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Regen rate indicator */}
      <div className="flex justify-end mt-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          +{regenRate}/tick
        </span>
      </div>
    </div>
  );
}

export default DivinePowerBar;
