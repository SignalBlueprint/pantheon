'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReplayStateInfo,
  ReplayMetadata,
  PLAYBACK_SPEEDS,
  PlaybackSpeed,
  GameEvent,
  lerp,
  lerpEased,
  easeOutCubic,
  easeInOutCubic,
  createInterpolationState,
  InterpolationState,
  updateInterpolation,
  getInterpolatedTick,
  startInterpolation,
  snapToTick,
} from '@pantheon/shared';

interface ReplayViewerProps {
  shardId: string;
  seasonId?: string;
  onClose?: () => void;
}

/**
 * Format tick count to readable time
 */
function formatTicks(ticks: number): string {
  const roundedTicks = Math.floor(ticks);
  if (roundedTicks < 60) return `${roundedTicks}s`;
  if (roundedTicks < 3600) return `${Math.floor(roundedTicks / 60)}m ${roundedTicks % 60}s`;
  const hours = Math.floor(roundedTicks / 3600);
  const mins = Math.floor((roundedTicks % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Format bytes to readable size
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get event type icon
 */
function getEventIcon(eventType: string): string {
  const icons: Record<string, string> = {
    territory_captured: '🏰',
    siege_started: '⚔️',
    siege_completed: '🚩',
    miracle_cast: '✨',
    war_declared: '🔥',
    alliance_formed: '🤝',
    champion_spawned: '👤',
    champion_died: '💀',
    myth_created: '📜',
    faction_eliminated: '☠️',
  };
  return icons[eventType] || '📌';
}

/**
 * Replay Viewer - time-scrubbing spectator mode for archived seasons
 * Features smooth interpolation between ticks for visual clarity
 */
export function ReplayViewer({
  shardId,
  seasonId,
  onClose,
}: ReplayViewerProps) {
  const [metadata, setMetadata] = useState<ReplayMetadata | null>(null);
  const [replayState, setReplayState] = useState<ReplayStateInfo | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>('1x');
  const [currentTick, setCurrentTick] = useState(0);
  const [showEvents, setShowEvents] = useState(true);
  const [interestingMoments, setInterestingMoments] = useState<number[]>([]);

  // Smooth interpolation state
  const [interpState, setInterpState] = useState<InterpolationState>(() =>
    createInterpolationState(0)
  );
  const [displayTick, setDisplayTick] = useState(0);
  const [smoothProgress, setSmoothProgress] = useState(0);

  // Animation frame refs
  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const accumulatedTimeRef = useRef<number>(0);

  // Load replay metadata
  useEffect(() => {
    async function loadMetadata() {
      try {
        setLoading(true);
        const response = await fetch(`/api/replay/${shardId}/metadata`);
        if (!response.ok) throw new Error('Failed to fetch replay metadata');
        const data = await response.json();
        setMetadata(data.metadata);

        if (data.interestingMoments) {
          setInterestingMoments(data.interestingMoments);
        }
      } catch (err) {
        setError('Failed to load replay data');
        console.error('[ReplayViewer] Error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadMetadata();
  }, [shardId]);

  // Fetch events for current tick range
  const fetchEventsForTick = useCallback(async (tick: number) => {
    try {
      const roundedTick = Math.floor(tick);
      const response = await fetch(`/api/replay/${shardId}/events?tick=${roundedTick}&range=100`);
      if (!response.ok) return;
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('[ReplayViewer] Failed to fetch events:', err);
    }
  }, [shardId]);

  // Animation loop for smooth rendering
  useEffect(() => {
    function animate(timestamp: number) {
      if (!metadata) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Calculate delta time
      const deltaTime = lastFrameTimeRef.current ? timestamp - lastFrameTimeRef.current : 0;
      lastFrameTimeRef.current = timestamp;

      // Update interpolation state
      const updatedInterpState = updateInterpolation(interpState, timestamp);
      if (updatedInterpState !== interpState) {
        setInterpState(updatedInterpState);
      }

      // Get smoothly interpolated tick for display
      const interpolatedTick = getInterpolatedTick(updatedInterpState, easeOutCubic);
      setDisplayTick(interpolatedTick);

      // Smoothly animate progress bar
      const totalTicks = metadata.endTick - metadata.startTick;
      const targetProgress = totalTicks > 0
        ? ((interpolatedTick - metadata.startTick) / totalTicks) * 100
        : 0;

      // Smooth progress with easing
      setSmoothProgress(prev => {
        const diff = targetProgress - prev;
        // Quick snap if difference is large (seeking), smooth otherwise
        if (Math.abs(diff) > 5) {
          return lerpEased(prev, targetProgress, 0.3, easeInOutCubic);
        }
        return lerp(prev, targetProgress, 0.15);
      });

      // Accumulate time for tick advancement during playback
      if (isPlaying) {
        accumulatedTimeRef.current += deltaTime;
        const ticksPerSecond = PLAYBACK_SPEEDS[playbackSpeed];
        const msPerTick = 1000 / ticksPerSecond;

        while (accumulatedTimeRef.current >= msPerTick) {
          accumulatedTimeRef.current -= msPerTick;
          setCurrentTick(prev => {
            const next = prev + 1;
            if (next >= metadata.endTick) {
              setIsPlaying(false);
              return metadata.endTick;
            }
            return next;
          });
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    }

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [metadata, interpState, isPlaying, playbackSpeed]);

  // Start interpolation when currentTick changes
  useEffect(() => {
    if (metadata) {
      // Calculate interpolation duration based on playback speed
      const ticksPerSecond = PLAYBACK_SPEEDS[playbackSpeed];
      const durationMs = 1000 / ticksPerSecond;

      setInterpState(prev =>
        startInterpolation(prev, currentTick, durationMs)
      );
    }
  }, [currentTick, metadata, playbackSpeed]);

  // Fetch events when display tick changes significantly
  useEffect(() => {
    const roundedTick = Math.floor(displayTick);
    fetchEventsForTick(roundedTick);
  }, [Math.floor(displayTick), fetchEventsForTick]);

  // Seek to tick (with smooth animation)
  const seekToTick = useCallback((tick: number) => {
    if (!metadata) return;
    const clampedTick = Math.max(metadata.startTick, Math.min(metadata.endTick, tick));

    // For large jumps, use faster interpolation
    const distance = Math.abs(clampedTick - currentTick);
    const totalRange = metadata.endTick - metadata.startTick;
    const jumpRatio = distance / totalRange;

    if (jumpRatio > 0.1) {
      // Large jump - snap immediately for responsiveness
      setInterpState(prev => snapToTick(prev, clampedTick));
      setDisplayTick(clampedTick);
    }

    setCurrentTick(clampedTick);
    accumulatedTimeRef.current = 0;
  }, [metadata, currentTick]);

  // Skip to interesting moment
  const skipToMoment = useCallback((direction: 'prev' | 'next') => {
    const moments = interestingMoments.filter(m =>
      direction === 'next' ? m > currentTick : m < currentTick
    );
    if (moments.length === 0) return;

    const target = direction === 'next'
      ? Math.min(...moments)
      : Math.max(...moments);
    seekToTick(target);
  }, [currentTick, interestingMoments, seekToTick]);

  // Toggle play/pause
  const togglePlayback = useCallback(() => {
    setIsPlaying(prev => {
      if (!prev) {
        // Starting playback - reset accumulated time
        accumulatedTimeRef.current = 0;
        lastFrameTimeRef.current = 0;
      }
      return !prev;
    });
  }, []);

  // Clean up old interval-based playback (no longer needed)
  useEffect(() => {
    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
        playbackRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p>Loading replay data...</p>
        </div>
      </div>
    );
  }

  if (error || !metadata) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-red-400 mb-4">{error || 'No replay data available'}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-2xl">🎬</span>
          <div>
            <h2 className="text-lg font-bold text-white">Replay Viewer</h2>
            <p className="text-gray-400 text-sm">
              {formatTicks(metadata.totalTicks)} total • {metadata.totalEvents.toLocaleString()} events
              • {formatBytes(metadata.compressedSizeBytes)}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Main content area - map placeholder */}
      <div className="flex-1 flex">
        {/* Map area */}
        <div className="flex-1 bg-gray-800 flex items-center justify-center relative">
          <div className="text-center text-gray-400">
            <span className="text-6xl mb-4 block">🗺️</span>
            <p className="text-xl mb-2">Map View</p>
            <p className="text-sm">Tick: {Math.floor(displayTick).toLocaleString()}</p>
            <p className="text-sm">Progress: {smoothProgress.toFixed(1)}%</p>
            {isPlaying && (
              <p className="text-xs text-blue-400 mt-2 animate-pulse">
                Playing at {playbackSpeed}
              </p>
            )}
          </div>

          {/* Current tick display with smooth animation */}
          <div className="absolute top-4 left-4 bg-black/70 px-4 py-2 rounded-lg">
            <span className="text-white font-mono text-lg transition-all duration-150">
              {formatTicks(displayTick)} / {formatTicks(metadata.endTick)}
            </span>
          </div>

          {/* Interpolation indicator */}
          {interpState.isAnimating && (
            <div className="absolute top-4 right-4 bg-blue-500/30 px-3 py-1 rounded text-blue-300 text-xs">
              Interpolating... {(interpState.progress * 100).toFixed(0)}%
            </div>
          )}
        </div>

        {/* Event log sidebar */}
        {showEvents && (
          <div className="w-80 bg-gray-900 border-l border-gray-700 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-white font-semibold">Events</h3>
              <button
                onClick={() => setShowEvents(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {events.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No events at this tick</p>
              ) : (
                <div className="space-y-2">
                  {events.slice(0, 50).map((event, idx) => (
                    <div
                      key={event.id || idx}
                      className="p-2 bg-gray-800 rounded text-sm transition-all duration-200 hover:bg-gray-750"
                      style={{
                        opacity: event.tick <= Math.floor(displayTick) ? 1 : 0.5,
                        transform: event.tick === Math.floor(displayTick) ? 'scale(1.02)' : 'scale(1)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{getEventIcon(event.eventType)}</span>
                        <span className="text-white font-medium">
                          {event.eventType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-gray-400 text-xs mt-1">
                        Tick {event.tick}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Timeline controls */}
      <div className="bg-gray-900 border-t border-gray-700 p-4">
        {/* Progress bar with smooth animation and interesting moments */}
        <div className="relative mb-4">
          <input
            type="range"
            min={metadata.startTick}
            max={metadata.endTick}
            value={currentTick}
            onChange={(e) => seekToTick(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${smoothProgress}%, #374151 ${smoothProgress}%, #374151 100%)`,
            }}
          />
          {/* Smooth progress overlay (for visual smoothness) */}
          <div
            className="absolute top-0 left-0 h-2 bg-blue-500 rounded-l-lg pointer-events-none transition-all duration-75"
            style={{ width: `${smoothProgress}%` }}
          />
          {/* Interesting moment markers */}
          <div className="absolute top-0 left-0 right-0 h-2 pointer-events-none">
            {interestingMoments.map((tick, idx) => {
              const pos = ((tick - metadata.startTick) / (metadata.endTick - metadata.startTick)) * 100;
              return (
                <div
                  key={idx}
                  className="absolute w-1 h-3 bg-amber-400 -top-0.5 rounded-full transition-all duration-200"
                  style={{
                    left: `${pos}%`,
                    transform: 'translateX(-50%)',
                    opacity: Math.abs(pos - smoothProgress) < 2 ? 1 : 0.6,
                    scale: Math.abs(pos - smoothProgress) < 2 ? '1.2' : '1',
                  }}
                  title={`Interesting moment at tick ${tick}`}
                />
              );
            })}
          </div>
          {/* Current position indicator */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none transition-all duration-100"
            style={{
              left: `calc(${smoothProgress}% - 8px)`,
            }}
          />
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Skip to previous moment */}
            <button
              onClick={() => skipToMoment('prev')}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              title="Previous moment"
            >
              ⏮️
            </button>

            {/* Rewind 10s */}
            <button
              onClick={() => seekToTick(currentTick - 10)}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              title="Rewind 10s"
            >
              ⏪
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlayback}
              className={`p-3 rounded-lg text-white transition-all text-xl ${
                isPlaying
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            {/* Forward 10s */}
            <button
              onClick={() => seekToTick(currentTick + 10)}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              title="Forward 10s"
            >
              ⏩
            </button>

            {/* Skip to next moment */}
            <button
              onClick={() => skipToMoment('next')}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              title="Next moment"
            >
              ⏭️
            </button>
          </div>

          {/* Speed controls */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Speed:</span>
            {(Object.keys(PLAYBACK_SPEEDS) as PlaybackSpeed[]).map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-3 py-1 rounded text-sm transition-all ${
                  playbackSpeed === speed
                    ? 'bg-blue-600 text-white scale-105'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {speed}
              </button>
            ))}
          </div>

          {/* Toggle events */}
          <button
            onClick={() => setShowEvents(!showEvents)}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              showEvents
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            📋 Events
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReplayViewer;
