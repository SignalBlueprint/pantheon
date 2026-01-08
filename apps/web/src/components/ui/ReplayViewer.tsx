'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReplayStateInfo,
  ReplayMetadata,
  PLAYBACK_SPEEDS,
  PlaybackSpeed,
  GameEvent,
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
  if (ticks < 60) return `${ticks}s`;
  if (ticks < 3600) return `${Math.floor(ticks / 60)}m ${ticks % 60}s`;
  const hours = Math.floor(ticks / 3600);
  const mins = Math.floor((ticks % 3600) / 60);
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

  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      const response = await fetch(`/api/replay/${shardId}/events?tick=${tick}&range=100`);
      if (!response.ok) return;
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('[ReplayViewer] Failed to fetch events:', err);
    }
  }, [shardId]);

  // Handle playback
  useEffect(() => {
    if (isPlaying && metadata) {
      playbackRef.current = setInterval(() => {
        setCurrentTick(prev => {
          const next = prev + PLAYBACK_SPEEDS[playbackSpeed];
          if (next >= metadata.endTick) {
            setIsPlaying(false);
            return metadata.endTick;
          }
          return next;
        });
      }, 1000);
    } else {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
        playbackRef.current = null;
      }
    }

    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, metadata]);

  // Fetch events when tick changes
  useEffect(() => {
    fetchEventsForTick(currentTick);
  }, [currentTick, fetchEventsForTick]);

  // Seek to tick
  const seekToTick = useCallback((tick: number) => {
    if (!metadata) return;
    const clampedTick = Math.max(metadata.startTick, Math.min(metadata.endTick, tick));
    setCurrentTick(clampedTick);
  }, [metadata]);

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
    setIsPlaying(prev => !prev);
  }, []);

  // Progress percentage
  const progress = metadata
    ? Math.round(((currentTick - metadata.startTick) / (metadata.endTick - metadata.startTick)) * 100)
    : 0;

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
            <p className="text-sm">Tick: {currentTick.toLocaleString()}</p>
            <p className="text-sm">Progress: {progress}%</p>
          </div>

          {/* Current tick display */}
          <div className="absolute top-4 left-4 bg-black/70 px-4 py-2 rounded-lg">
            <span className="text-white font-mono text-lg">
              {formatTicks(currentTick)} / {formatTicks(metadata.endTick)}
            </span>
          </div>
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
                      className="p-2 bg-gray-800 rounded text-sm"
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
        {/* Progress bar with interesting moments */}
        <div className="relative mb-4">
          <input
            type="range"
            min={metadata.startTick}
            max={metadata.endTick}
            value={currentTick}
            onChange={(e) => seekToTick(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${progress}%, #374151 ${progress}%, #374151 100%)`,
            }}
          />
          {/* Interesting moment markers */}
          <div className="absolute top-0 left-0 right-0 h-2 pointer-events-none">
            {interestingMoments.map((tick, idx) => {
              const pos = ((tick - metadata.startTick) / (metadata.endTick - metadata.startTick)) * 100;
              return (
                <div
                  key={idx}
                  className="absolute w-1 h-3 bg-amber-400 -top-0.5 rounded-full"
                  style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
                  title={`Interesting moment at tick ${tick}`}
                />
              );
            })}
          </div>
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
              className="p-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors text-xl"
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
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  playbackSpeed === speed
                    ? 'bg-blue-600 text-white'
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
