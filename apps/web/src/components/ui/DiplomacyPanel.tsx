'use client';

import { useState, useCallback } from 'react';
import {
  Faction,
  DiplomaticRelation,
  RelationStatus,
  DIPLOMACY_WAR_COST,
  DIPLOMACY_PEACE_COST,
  DIPLOMACY_ALLIANCE_COST,
  DIPLOMACY_BREAK_ALLIANCE_COST,
} from '@pantheon/shared';

interface DiplomacyPanelProps {
  playerFactionId: string;
  factions: Record<string, Faction>;
  relations: Record<string, DiplomaticRelation>;
  onDeclareWar: (targetId: string) => void;
  onOfferPeace: (targetId: string) => void;
  onProposeAlliance: (targetId: string) => void;
  onBreakAlliance: (targetId: string) => void;
  onRespondProposal: (proposerId: string, accept: boolean, type: 'peace' | 'alliance') => void;
}

/**
 * Get relation status between player and another faction
 */
function getRelationToPlayer(
  playerFactionId: string,
  otherFactionId: string,
  relations: Record<string, DiplomaticRelation>
): DiplomaticRelation | null {
  const [a, b] = playerFactionId < otherFactionId
    ? [playerFactionId, otherFactionId]
    : [otherFactionId, playerFactionId];

  for (const relation of Object.values(relations)) {
    if (relation.factionA === a && relation.factionB === b) {
      return relation;
    }
  }
  return null;
}

/**
 * Get CSS classes for relation status badge
 */
function getStatusStyle(status: RelationStatus): string {
  switch (status) {
    case 'war':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'alliance':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'truce':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

/**
 * Get icon for relation status
 */
function getStatusIcon(status: RelationStatus): string {
  switch (status) {
    case 'war':
      return '⚔️';
    case 'alliance':
      return '🤝';
    case 'truce':
      return '🕊️';
    default:
      return '⚪';
  }
}

export function DiplomacyPanel({
  playerFactionId,
  factions,
  relations,
  onDeclareWar,
  onOfferPeace,
  onProposeAlliance,
  onBreakAlliance,
  onRespondProposal,
}: DiplomacyPanelProps) {
  const [expandedFaction, setExpandedFaction] = useState<string | null>(null);

  const playerFaction = factions[playerFactionId];
  if (!playerFaction) return null;

  const otherFactions = Object.values(factions).filter(f => f.id !== playerFactionId);

  // Check for pending proposals
  const getPendingProposal = (relation: DiplomaticRelation | null, factionId: string): { type: 'peace' | 'alliance'; fromUs: boolean } | null => {
    if (!relation || !relation.proposalType) return null;
    // Only handle peace and alliance proposals in UI
    if (relation.proposalType !== 'peace' && relation.proposalType !== 'alliance') return null;

    if (relation.proposedBy === playerFactionId) {
      return { type: relation.proposalType, fromUs: true };
    } else {
      return { type: relation.proposalType, fromUs: false };
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <span>🏛️</span> Diplomacy
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Divine Power: {playerFaction.divinePower}
        </p>
      </div>

      {/* Faction list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-80 overflow-y-auto">
        {otherFactions.map((faction) => {
          const relation = getRelationToPlayer(playerFactionId, faction.id, relations);
          const status: RelationStatus = relation?.status ?? 'neutral';
          const proposal = getPendingProposal(relation, faction.id);
          const isExpanded = expandedFaction === faction.id;

          return (
            <div key={faction.id} className="p-3">
              {/* Faction header */}
              <button
                onClick={() => setExpandedFaction(isExpanded ? null : faction.id)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: faction.color }}
                  />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {faction.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${getStatusStyle(status)}`}>
                    {getStatusIcon(status)} {status}
                  </span>
                  <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                </div>
              </button>

              {/* Pending proposal alert */}
              {proposal && !proposal.fromUs && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                  <p className="text-blue-800 dark:text-blue-300 mb-2">
                    {faction.name} offers {proposal.type}!
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onRespondProposal(faction.id, true, proposal.type)}
                      className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => onRespondProposal(faction.id, false, proposal.type)}
                      className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded actions */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="grid grid-cols-2 gap-2">
                    {/* War actions */}
                    {status === 'neutral' && (
                      <button
                        onClick={() => onDeclareWar(faction.id)}
                        disabled={playerFaction.divinePower < DIPLOMACY_WAR_COST}
                        className="px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ⚔️ Declare War ({DIPLOMACY_WAR_COST})
                      </button>
                    )}

                    {/* Peace actions */}
                    {status === 'war' && !proposal && (
                      <button
                        onClick={() => onOfferPeace(faction.id)}
                        disabled={playerFaction.divinePower < DIPLOMACY_PEACE_COST}
                        className="px-3 py-1.5 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        🕊️ Offer Peace ({DIPLOMACY_PEACE_COST})
                      </button>
                    )}

                    {/* Alliance actions */}
                    {(status === 'neutral' || status === 'truce') && !proposal && (
                      <button
                        onClick={() => onProposeAlliance(faction.id)}
                        disabled={playerFaction.divinePower < DIPLOMACY_ALLIANCE_COST}
                        className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        🤝 Propose Alliance ({DIPLOMACY_ALLIANCE_COST})
                      </button>
                    )}

                    {status === 'alliance' && (
                      <button
                        onClick={() => onBreakAlliance(faction.id)}
                        disabled={playerFaction.divinePower < DIPLOMACY_BREAK_ALLIANCE_COST}
                        className="px-3 py-1.5 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed col-span-2"
                      >
                        💔 Break Alliance ({DIPLOMACY_BREAK_ALLIANCE_COST})
                      </button>
                    )}

                    {/* Pending status */}
                    {proposal?.fromUs && (
                      <p className="col-span-2 text-xs text-gray-500 text-center">
                        Awaiting response to {proposal.type} offer...
                      </p>
                    )}
                  </div>

                  {/* Faction stats */}
                  <div className="mt-3 text-xs text-gray-500 grid grid-cols-2 gap-2">
                    <span>Territories: {faction.territories.length}</span>
                    <span>Reputation: {faction.reputation}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {otherFactions.length === 0 && (
          <div className="p-4 text-center text-gray-500">
            No other factions
          </div>
        )}
      </div>
    </div>
  );
}

export default DiplomacyPanel;
