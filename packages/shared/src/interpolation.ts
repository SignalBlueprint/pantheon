/**
 * Interpolation utilities for smooth animations in Pantheon
 * Used primarily for replay viewer smooth tick transitions
 */

// ============================================================================
// EASING FUNCTIONS
// ============================================================================

/**
 * Linear interpolation (no easing)
 */
export function easeLinear(t: number): number {
  return t;
}

/**
 * Ease-in quadratic
 */
export function easeInQuad(t: number): number {
  return t * t;
}

/**
 * Ease-out quadratic
 */
export function easeOutQuad(t: number): number {
  return t * (2 - t);
}

/**
 * Ease-in-out quadratic (smooth start and end)
 */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Ease-in cubic
 */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/**
 * Ease-out cubic
 */
export function easeOutCubic(t: number): number {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}

/**
 * Ease-in-out cubic (smoother than quadratic)
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

/**
 * Ease-out elastic (bouncy overshoot)
 */
export function easeOutElastic(t: number): number {
  const p = 0.3;
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
}

/**
 * Ease-out back (slight overshoot)
 */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export type EasingFunction = (t: number) => number;

// ============================================================================
// VALUE INTERPOLATION
// ============================================================================

/**
 * Linear interpolation between two numbers
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Linear interpolation with easing function
 */
export function lerpEased(
  start: number,
  end: number,
  t: number,
  easing: EasingFunction = easeLinear
): number {
  return lerp(start, end, easing(Math.max(0, Math.min(1, t))));
}

/**
 * Interpolate between two colors (hex format)
 */
export function lerpColor(startHex: string, endHex: string, t: number): string {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);

  if (!start || !end) return startHex;

  const r = Math.round(lerp(start.r, end.r, t));
  const g = Math.round(lerp(start.g, end.g, t));
  const b = Math.round(lerp(start.b, end.b, t));

  return rgbToHex(r, g, b);
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Interpolate between two points
 */
export function lerpPoint(
  start: { x: number; y: number },
  end: { x: number; y: number },
  t: number
): { x: number; y: number } {
  return {
    x: lerp(start.x, end.x, t),
    y: lerp(start.y, end.y, t),
  };
}

// ============================================================================
// ANIMATION STATE
// ============================================================================

/**
 * State for managing smooth interpolation between ticks
 */
export interface InterpolationState {
  /** The base tick (integer) we're interpolating from */
  baseTick: number;
  /** The target tick (integer) we're interpolating to */
  targetTick: number;
  /** Current interpolation progress (0-1) */
  progress: number;
  /** Whether animation is currently running */
  isAnimating: boolean;
  /** Duration of interpolation in milliseconds */
  durationMs: number;
  /** Timestamp when animation started */
  startTime: number;
}

/**
 * Create initial interpolation state
 */
export function createInterpolationState(initialTick: number): InterpolationState {
  return {
    baseTick: initialTick,
    targetTick: initialTick,
    progress: 1,
    isAnimating: false,
    durationMs: 1000, // Default 1 second per tick
    startTime: 0,
  };
}

/**
 * Start interpolating to a new tick
 */
export function startInterpolation(
  state: InterpolationState,
  targetTick: number,
  durationMs: number = 1000
): InterpolationState {
  // If already at target, no animation needed
  if (state.targetTick === targetTick && state.progress >= 1) {
    return state;
  }

  return {
    baseTick: state.targetTick,
    targetTick,
    progress: 0,
    isAnimating: true,
    durationMs,
    startTime: Date.now(),
  };
}

/**
 * Update interpolation state based on elapsed time
 */
export function updateInterpolation(
  state: InterpolationState,
  currentTime: number
): InterpolationState {
  if (!state.isAnimating) return state;

  const elapsed = currentTime - state.startTime;
  const progress = Math.min(1, elapsed / state.durationMs);

  return {
    ...state,
    progress,
    isAnimating: progress < 1,
  };
}

/**
 * Get the current interpolated tick value (can be fractional)
 */
export function getInterpolatedTick(
  state: InterpolationState,
  easing: EasingFunction = easeOutCubic
): number {
  const easedProgress = easing(state.progress);
  return lerp(state.baseTick, state.targetTick, easedProgress);
}

/**
 * Snap to a specific tick immediately (no animation)
 */
export function snapToTick(state: InterpolationState, tick: number): InterpolationState {
  return {
    ...state,
    baseTick: tick,
    targetTick: tick,
    progress: 1,
    isAnimating: false,
  };
}

// ============================================================================
// FRAME TIMING
// ============================================================================

/**
 * Calculate frame duration based on playback speed
 * @param speed Playback speed multiplier (1x, 10x, 100x, 1000x)
 * @returns Duration per tick in milliseconds
 */
export function getTickDuration(speed: number): number {
  // Base tick rate is 1 tick per second (1000ms)
  // Higher speed = shorter duration
  return 1000 / speed;
}

/**
 * Convert frame delta time to tick progress
 */
export function deltaToTickProgress(deltaMs: number, tickDurationMs: number): number {
  return deltaMs / tickDurationMs;
}

// ============================================================================
// SMOOTH VALUE TRACKER
// ============================================================================

/**
 * Tracks a value and smoothly animates towards target
 */
export interface SmoothValue {
  current: number;
  target: number;
  velocity: number;
}

/**
 * Create a smooth value tracker
 */
export function createSmoothValue(initial: number): SmoothValue {
  return {
    current: initial,
    target: initial,
    velocity: 0,
  };
}

/**
 * Set target for smooth value
 */
export function setSmoothTarget(value: SmoothValue, target: number): SmoothValue {
  return {
    ...value,
    target,
  };
}

/**
 * Update smooth value using spring physics
 * @param value Current smooth value state
 * @param deltaMs Time since last update in milliseconds
 * @param stiffness Spring stiffness (higher = faster)
 * @param damping Spring damping (higher = less oscillation)
 */
export function updateSmoothValue(
  value: SmoothValue,
  deltaMs: number,
  stiffness: number = 0.1,
  damping: number = 0.8
): SmoothValue {
  const dt = deltaMs / 1000; // Convert to seconds
  const displacement = value.target - value.current;

  // Spring force
  const springForce = displacement * stiffness;

  // Apply force and damping
  const newVelocity = (value.velocity + springForce) * Math.pow(damping, dt * 60);
  const newCurrent = value.current + newVelocity * dt * 60;

  // Snap to target if close enough
  if (Math.abs(displacement) < 0.001 && Math.abs(newVelocity) < 0.001) {
    return {
      current: value.target,
      target: value.target,
      velocity: 0,
    };
  }

  return {
    current: newCurrent,
    target: value.target,
    velocity: newVelocity,
  };
}
