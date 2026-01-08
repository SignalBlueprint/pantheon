/**
 * Hex coordinate system using axial coordinates (q, r)
 * Based on https://www.redblobgames.com/grids/hexagons/
 */

// Axial coordinates for hex grid
export interface HexCoord {
  q: number;
  r: number;
}

// Cube coordinates (useful for distance calculations)
export interface CubeCoord {
  x: number;
  y: number;
  z: number;
}

// Pixel position
export interface Point {
  x: number;
  y: number;
}

// Hex size configuration
export interface HexLayout {
  size: number;       // Distance from center to corner
  origin: Point;      // Origin point for pixel conversion
  flat: boolean;      // true = flat-top, false = pointy-top
}

// Default layout: pointy-top hexes with size 30
export const DEFAULT_HEX_LAYOUT: HexLayout = {
  size: 30,
  origin: { x: 0, y: 0 },
  flat: false,
};

// Direction vectors for the 6 neighbors (pointy-top orientation)
const AXIAL_DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 },   // East
  { q: 1, r: -1 },  // Northeast
  { q: 0, r: -1 },  // Northwest
  { q: -1, r: 0 },  // West
  { q: -1, r: 1 },  // Southwest
  { q: 0, r: 1 },   // Southeast
];

/**
 * Convert axial coordinates to cube coordinates
 */
export function axialToCube(hex: HexCoord): CubeCoord {
  const x = hex.q;
  const z = hex.r;
  const y = -x - z;
  return { x, y, z };
}

/**
 * Convert cube coordinates to axial coordinates
 */
export function cubeToAxial(cube: CubeCoord): HexCoord {
  return { q: cube.x, r: cube.z };
}

/**
 * Calculate distance between two hexes (in hex steps)
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  return Math.max(
    Math.abs(ac.x - bc.x),
    Math.abs(ac.y - bc.y),
    Math.abs(ac.z - bc.z)
  );
}

/**
 * Get all 6 neighboring hex coordinates
 */
export function hexNeighbors(hex: HexCoord): HexCoord[] {
  return AXIAL_DIRECTIONS.map(dir => ({
    q: hex.q + dir.q,
    r: hex.r + dir.r,
  }));
}

/**
 * Get a specific neighbor by direction index (0-5)
 */
export function hexNeighbor(hex: HexCoord, direction: number): HexCoord {
  const dir = AXIAL_DIRECTIONS[direction % 6];
  return {
    q: hex.q + dir.q,
    r: hex.r + dir.r,
  };
}

/**
 * Convert hex coordinates to pixel position (center of hex)
 */
export function hexToPixel(hex: HexCoord, layout: HexLayout = DEFAULT_HEX_LAYOUT): Point {
  const { size, origin, flat } = layout;

  let x: number, y: number;

  if (flat) {
    // Flat-top hexes
    x = size * (3/2 * hex.q);
    y = size * (Math.sqrt(3)/2 * hex.q + Math.sqrt(3) * hex.r);
  } else {
    // Pointy-top hexes
    x = size * (Math.sqrt(3) * hex.q + Math.sqrt(3)/2 * hex.r);
    y = size * (3/2 * hex.r);
  }

  return {
    x: x + origin.x,
    y: y + origin.y,
  };
}

/**
 * Convert pixel position to hex coordinates (may need rounding)
 */
export function pixelToHex(point: Point, layout: HexLayout = DEFAULT_HEX_LAYOUT): HexCoord {
  const { size, origin, flat } = layout;

  const px = point.x - origin.x;
  const py = point.y - origin.y;

  let q: number, r: number;

  if (flat) {
    // Flat-top hexes
    q = (2/3 * px) / size;
    r = (-1/3 * px + Math.sqrt(3)/3 * py) / size;
  } else {
    // Pointy-top hexes
    q = (Math.sqrt(3)/3 * px - 1/3 * py) / size;
    r = (2/3 * py) / size;
  }

  return hexRound({ q, r });
}

/**
 * Round fractional hex coordinates to nearest hex
 */
export function hexRound(hex: HexCoord): HexCoord {
  const cube = axialToCube(hex);

  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);

  const xDiff = Math.abs(rx - cube.x);
  const yDiff = Math.abs(ry - cube.y);
  const zDiff = Math.abs(rz - cube.z);

  // Reset the component with largest rounding error
  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
}

/**
 * Get all hexes within a given radius from center (inclusive)
 */
export function hexesInRadius(center: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];

  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      results.push({
        q: center.q + q,
        r: center.r + r,
      });
    }
  }

  return results;
}

/**
 * Generate unique ID for a hex coordinate
 */
export function hexId(hex: HexCoord): string {
  return `${hex.q},${hex.r}`;
}

/**
 * Parse hex ID back to coordinates
 */
export function parseHexId(id: string): HexCoord {
  const [q, r] = id.split(',').map(Number);
  return { q, r };
}
