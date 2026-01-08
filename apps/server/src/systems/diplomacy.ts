/**
 * Diplomacy System for Pantheon
 * Handles war, peace, alliances, and diplomatic relations
 */

import {
  GameState,
  Faction,
  DiplomaticRelation,
  RelationStatus,
  ProposalType,
  DiplomaticEventType,
  DIPLOMACY_WAR_COST,
  DIPLOMACY_PEACE_COST,
  DIPLOMACY_ALLIANCE_COST,
  DIPLOMACY_BREAK_ALLIANCE_COST,
  DIPLOMACY_REPUTATION_LOSS_BREAK,
  DIPLOMACY_TRUCE_DURATION_TICKS,
} from '@pantheon/shared';
import { v4 as uuidv4 } from 'uuid';

/**
 * Result of a diplomatic action
 */
export interface DiplomacyResult {
  success: boolean;
  error?: string;
  relation?: DiplomaticRelation;
  eventType?: DiplomaticEventType;
}

/**
 * Get relation between two factions
 * Returns neutral if no relation exists
 */
export function getRelation(
  state: GameState,
  factionAId: string,
  factionBId: string
): DiplomaticRelation | null {
  // Ensure consistent ordering
  const [a, b] = factionAId < factionBId ? [factionAId, factionBId] : [factionBId, factionAId];

  for (const relation of state.relations.values()) {
    if (relation.factionA === a && relation.factionB === b) {
      return relation;
    }
  }
  return null;
}

/**
 * Get relation status between two factions
 * Returns 'neutral' if no relation exists
 */
export function getRelationStatus(
  state: GameState,
  factionAId: string,
  factionBId: string
): RelationStatus {
  const relation = getRelation(state, factionAId, factionBId);
  return relation?.status ?? 'neutral';
}

/**
 * Create or update a relation between two factions
 */
function setRelation(
  state: GameState,
  factionAId: string,
  factionBId: string,
  status: RelationStatus,
  proposedBy?: string,
  proposalType?: ProposalType
): DiplomaticRelation {
  // Ensure consistent ordering
  const [a, b] = factionAId < factionBId ? [factionAId, factionBId] : [factionBId, factionAId];

  const existingRelation = getRelation(state, a, b);

  if (existingRelation) {
    existingRelation.status = status;
    existingRelation.sinceTick = state.tick;
    existingRelation.proposedBy = proposedBy;
    existingRelation.proposalType = proposalType;
    return existingRelation;
  }

  // Create new relation
  const relation: DiplomaticRelation = {
    id: uuidv4(),
    factionA: a,
    factionB: b,
    status,
    sinceTick: state.tick,
    proposedBy,
    proposalType,
  };

  state.relations.set(relation.id, relation);
  return relation;
}

/**
 * Declare war on another faction
 */
export function declareWar(
  state: GameState,
  attackerId: string,
  targetId: string
): DiplomacyResult {
  const attacker = state.factions.get(attackerId);
  const target = state.factions.get(targetId);

  if (!attacker || !target) {
    return { success: false, error: 'Faction not found' };
  }

  if (attackerId === targetId) {
    return { success: false, error: 'Cannot declare war on yourself' };
  }

  // Check current relation
  const currentStatus = getRelationStatus(state, attackerId, targetId);

  if (currentStatus === 'war') {
    return { success: false, error: 'Already at war' };
  }

  if (currentStatus === 'alliance') {
    return { success: false, error: 'Must break alliance first' };
  }

  if (currentStatus === 'truce') {
    return { success: false, error: 'Cannot declare war during truce' };
  }

  // Check divine power cost
  if (attacker.divinePower < DIPLOMACY_WAR_COST) {
    return { success: false, error: `Requires ${DIPLOMACY_WAR_COST} divine power` };
  }

  // Deduct divine power
  attacker.divinePower -= DIPLOMACY_WAR_COST;

  // Set relation to war
  const relation = setRelation(state, attackerId, targetId, 'war');

  console.log(`[Diplomacy] ${attacker.name} declared war on ${target.name}`);

  return { success: true, relation, eventType: 'war_declared' };
}

/**
 * Offer peace to another faction
 */
export function offerPeace(
  state: GameState,
  offerId: string,
  targetId: string
): DiplomacyResult {
  const offerer = state.factions.get(offerId);
  const target = state.factions.get(targetId);

  if (!offerer || !target) {
    return { success: false, error: 'Faction not found' };
  }

  // Check current relation
  const currentStatus = getRelationStatus(state, offerId, targetId);

  if (currentStatus !== 'war') {
    return { success: false, error: 'Can only offer peace during war' };
  }

  // Check divine power cost
  if (offerer.divinePower < DIPLOMACY_PEACE_COST) {
    return { success: false, error: `Requires ${DIPLOMACY_PEACE_COST} divine power` };
  }

  // Deduct divine power
  offerer.divinePower -= DIPLOMACY_PEACE_COST;

  // Set proposal on relation
  const relation = setRelation(state, offerId, targetId, 'war', offerId, 'peace');

  console.log(`[Diplomacy] ${offerer.name} offered peace to ${target.name}`);

  return { success: true, relation, eventType: 'peace_offered' };
}

/**
 * Respond to a peace offer
 */
export function respondToPeace(
  state: GameState,
  responderId: string,
  offererId: string,
  accept: boolean
): DiplomacyResult {
  const responder = state.factions.get(responderId);
  const offerer = state.factions.get(offererId);

  if (!responder || !offerer) {
    return { success: false, error: 'Faction not found' };
  }

  const relation = getRelation(state, responderId, offererId);

  if (!relation || relation.proposalType !== 'peace' || relation.proposedBy !== offererId) {
    return { success: false, error: 'No peace offer pending' };
  }

  if (accept) {
    // Accept peace - set truce
    relation.status = 'truce';
    relation.sinceTick = state.tick;
    relation.proposedBy = undefined;
    relation.proposalType = undefined;

    console.log(`[Diplomacy] ${responder.name} accepted peace with ${offerer.name}`);

    return { success: true, relation, eventType: 'peace_accepted' };
  } else {
    // Reject peace - clear proposal
    relation.proposedBy = undefined;
    relation.proposalType = undefined;

    console.log(`[Diplomacy] ${responder.name} rejected peace with ${offerer.name}`);

    return { success: true, relation, eventType: 'peace_rejected' };
  }
}

/**
 * Propose an alliance to another faction
 */
export function proposeAlliance(
  state: GameState,
  proposerId: string,
  targetId: string
): DiplomacyResult {
  const proposer = state.factions.get(proposerId);
  const target = state.factions.get(targetId);

  if (!proposer || !target) {
    return { success: false, error: 'Faction not found' };
  }

  if (proposerId === targetId) {
    return { success: false, error: 'Cannot ally with yourself' };
  }

  // Check current relation
  const currentStatus = getRelationStatus(state, proposerId, targetId);

  if (currentStatus === 'war') {
    return { success: false, error: 'Cannot propose alliance during war' };
  }

  if (currentStatus === 'alliance') {
    return { success: false, error: 'Already allied' };
  }

  // Check divine power cost
  if (proposer.divinePower < DIPLOMACY_ALLIANCE_COST) {
    return { success: false, error: `Requires ${DIPLOMACY_ALLIANCE_COST} divine power` };
  }

  // Deduct divine power
  proposer.divinePower -= DIPLOMACY_ALLIANCE_COST;

  // Set proposal on relation
  const relation = setRelation(state, proposerId, targetId, currentStatus, proposerId, 'alliance');

  console.log(`[Diplomacy] ${proposer.name} proposed alliance to ${target.name}`);

  return { success: true, relation, eventType: 'alliance_proposed' };
}

/**
 * Respond to an alliance proposal
 */
export function respondToAlliance(
  state: GameState,
  responderId: string,
  proposerId: string,
  accept: boolean
): DiplomacyResult {
  const responder = state.factions.get(responderId);
  const proposer = state.factions.get(proposerId);

  if (!responder || !proposer) {
    return { success: false, error: 'Faction not found' };
  }

  const relation = getRelation(state, responderId, proposerId);

  if (!relation || relation.proposalType !== 'alliance' || relation.proposedBy !== proposerId) {
    return { success: false, error: 'No alliance proposal pending' };
  }

  if (accept) {
    // Accept alliance
    relation.status = 'alliance';
    relation.sinceTick = state.tick;
    relation.proposedBy = undefined;
    relation.proposalType = undefined;

    console.log(`[Diplomacy] ${responder.name} formed alliance with ${proposer.name}`);

    return { success: true, relation, eventType: 'alliance_formed' };
  } else {
    // Reject alliance - clear proposal
    relation.proposedBy = undefined;
    relation.proposalType = undefined;

    console.log(`[Diplomacy] ${responder.name} rejected alliance with ${proposer.name}`);

    return { success: true, relation };
  }
}

/**
 * Break an existing alliance
 */
export function breakAlliance(
  state: GameState,
  breakerId: string,
  allyId: string
): DiplomacyResult {
  const breaker = state.factions.get(breakerId);
  const ally = state.factions.get(allyId);

  if (!breaker || !ally) {
    return { success: false, error: 'Faction not found' };
  }

  // Check current relation
  const currentStatus = getRelationStatus(state, breakerId, allyId);

  if (currentStatus !== 'alliance') {
    return { success: false, error: 'Not allied' };
  }

  // Check divine power cost
  if (breaker.divinePower < DIPLOMACY_BREAK_ALLIANCE_COST) {
    return { success: false, error: `Requires ${DIPLOMACY_BREAK_ALLIANCE_COST} divine power` };
  }

  // Deduct divine power
  breaker.divinePower -= DIPLOMACY_BREAK_ALLIANCE_COST;

  // Apply reputation penalty
  breaker.reputation = Math.max(0, breaker.reputation - DIPLOMACY_REPUTATION_LOSS_BREAK);

  // Set relation to neutral
  const relation = setRelation(state, breakerId, allyId, 'neutral');

  console.log(`[Diplomacy] ${breaker.name} broke alliance with ${ally.name} (reputation: ${breaker.reputation})`);

  return { success: true, relation, eventType: 'alliance_broken' };
}

/**
 * Check if two factions can attack each other
 */
export function canAttack(
  state: GameState,
  attackerId: string,
  defenderId: string
): boolean {
  const status = getRelationStatus(state, attackerId, defenderId);
  return status === 'war';
}

/**
 * Check if two factions are allied
 */
export function areAllied(
  state: GameState,
  factionAId: string,
  factionBId: string
): boolean {
  return getRelationStatus(state, factionAId, factionBId) === 'alliance';
}

/**
 * Get all allies of a faction
 */
export function getAllies(
  state: GameState,
  factionId: string
): string[] {
  const allies: string[] = [];

  for (const relation of state.relations.values()) {
    if (relation.status === 'alliance') {
      if (relation.factionA === factionId) {
        allies.push(relation.factionB);
      } else if (relation.factionB === factionId) {
        allies.push(relation.factionA);
      }
    }
  }

  return allies;
}

/**
 * Get all enemies (at war) of a faction
 */
export function getEnemies(
  state: GameState,
  factionId: string
): string[] {
  const enemies: string[] = [];

  for (const relation of state.relations.values()) {
    if (relation.status === 'war') {
      if (relation.factionA === factionId) {
        enemies.push(relation.factionB);
      } else if (relation.factionB === factionId) {
        enemies.push(relation.factionA);
      }
    }
  }

  return enemies;
}

/**
 * Process truce expirations
 * Called each tick to end truces that have expired
 */
export function processTruces(state: GameState): void {
  for (const relation of state.relations.values()) {
    if (relation.status === 'truce') {
      const truceDuration = state.tick - relation.sinceTick;
      if (truceDuration >= DIPLOMACY_TRUCE_DURATION_TICKS) {
        relation.status = 'neutral';
        relation.sinceTick = state.tick;
        console.log(`[Diplomacy] Truce ended between factions ${relation.factionA} and ${relation.factionB}`);
      }
    }
  }
}

/**
 * Get all relations for a faction
 */
export function getRelationsForFaction(
  state: GameState,
  factionId: string
): DiplomaticRelation[] {
  const relations: DiplomaticRelation[] = [];

  for (const relation of state.relations.values()) {
    if (relation.factionA === factionId || relation.factionB === factionId) {
      relations.push(relation);
    }
  }

  return relations;
}

/**
 * Get pending proposals for a faction
 */
export function getPendingProposals(
  state: GameState,
  factionId: string
): DiplomaticRelation[] {
  const proposals: DiplomaticRelation[] = [];

  for (const relation of state.relations.values()) {
    if (relation.proposalType && relation.proposedBy !== factionId) {
      // Check if this faction is the target of the proposal
      if (relation.factionA === factionId || relation.factionB === factionId) {
        proposals.push(relation);
      }
    }
  }

  return proposals;
}
