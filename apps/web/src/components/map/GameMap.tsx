'use client';

import { useState, useMemo } from 'react';
import { Territory, hexesInRadius, hexId } from '@pantheon/shared';
import { HexGrid } from './HexGrid';

/**
 * Generate a demo map with sample territories
 */
function generateDemoMap(): Territory[] {
  const coords = hexesInRadius({ q: 0, r: 0 }, 4);

  return coords.map((coord) => ({
    id: hexId(coord),
    q: coord.q,
    r: coord.r,
    owner: getDemoOwner(coord.q, coord.r),
    population: Math.floor(Math.random() * 100),
    food: Math.floor(Math.random() * 100),
    production: Math.floor(Math.random() * 50),
  }));
}

/**
 * Assign demo owners based on position
 */
function getDemoOwner(q: number, r: number): string | null {
  // Simple faction distribution for demo
  if (q >= 2 && r <= 0) return 'faction1';
  if (q <= -2 && r >= 0) return 'faction2';
  if (Math.abs(q) <= 1 && Math.abs(r) <= 1) return null; // Center unclaimed
  if (Math.random() > 0.7) return null; // Some random unclaimed
  return Math.random() > 0.5 ? 'faction1' : 'faction2';
}

interface TerritoryPanelProps {
  territory: Territory | null;
}

function TerritoryPanel({ territory }: TerritoryPanelProps) {
  if (!territory) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-500">Click a territory to view details</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg space-y-2">
      <h3 className="font-bold text-lg">Territory {territory.id}</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>Position:</div>
        <div>({territory.q}, {territory.r})</div>
        <div>Owner:</div>
        <div>{territory.owner || 'Unclaimed'}</div>
        <div>Population:</div>
        <div>{territory.population}</div>
        <div>Food:</div>
        <div>{territory.food}</div>
        <div>Production:</div>
        <div>{territory.production}</div>
      </div>
    </div>
  );
}

export function GameMap() {
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);

  // Generate demo territories
  const territories = useMemo(() => generateDemoMap(), []);

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full max-w-6xl">
      {/* Map container */}
      <div className="flex-1 aspect-square max-h-[600px] border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
        <HexGrid
          territories={territories}
          onTerritoryClick={setSelectedTerritory}
          selectedTerritoryId={selectedTerritory?.id}
        />
      </div>

      {/* Info panel */}
      <div className="w-full lg:w-64">
        <TerritoryPanel territory={selectedTerritory} />
      </div>
    </div>
  );
}

export default GameMap;
