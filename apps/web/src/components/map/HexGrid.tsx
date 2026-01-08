'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Territory, hexToPixel, HexLayout, DEFAULT_HEX_LAYOUT } from '@pantheon/shared';

// Faction colors - mapping factionId to hex color
const FACTION_COLORS: Record<string, string> = {
  faction1: '#e63946', // Red
  faction2: '#457b9d', // Blue
  faction3: '#2a9d8f', // Teal
  faction4: '#e9c46a', // Yellow
};

// Default color for unclaimed territory
const UNCLAIMED_COLOR = '#d4d4d4';

// Zoom constraints
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_SENSITIVITY = 0.001;

interface HexGridProps {
  territories: Territory[];
  layout?: HexLayout;
  onTerritoryClick?: (territory: Territory) => void;
  selectedTerritoryId?: string | null;
}

/**
 * Generate SVG path for a pointy-top hexagon
 */
function hexPath(centerX: number, centerY: number, size: number): string {
  const angles = [30, 90, 150, 210, 270, 330];
  const points = angles.map((angle) => {
    const rad = (Math.PI / 180) * angle;
    const x = centerX + size * Math.cos(rad);
    const y = centerY + size * Math.sin(rad);
    return `${x},${y}`;
  });
  return `M ${points.join(' L ')} Z`;
}

/**
 * Get fill color for a territory based on owner
 */
function getTerritoryColor(territory: Territory): string {
  if (!territory.owner) {
    return UNCLAIMED_COLOR;
  }
  return FACTION_COLORS[territory.owner] || UNCLAIMED_COLOR;
}

/**
 * HexGrid component - renders hex territories using SVG with pan and zoom
 */
export function HexGrid({
  territories,
  layout = DEFAULT_HEX_LAYOUT,
  onTerritoryClick,
  selectedTerritoryId,
}: HexGridProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Calculate base viewBox bounds based on territories
  const baseViewBox = useMemo(() => {
    if (territories.length === 0) {
      return { minX: -200, minY: -200, width: 400, height: 400 };
    }

    const positions = territories.map((t) => hexToPixel({ q: t.q, r: t.r }, layout));
    const padding = layout.size * 2;

    const minX = Math.min(...positions.map((p) => p.x)) - padding;
    const maxX = Math.max(...positions.map((p) => p.x)) + padding;
    const minY = Math.min(...positions.map((p) => p.y)) - padding;
    const maxY = Math.max(...positions.map((p) => p.y)) + padding;

    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [territories, layout]);

  // Calculate actual viewBox with zoom and pan applied
  const viewBox = useMemo(() => {
    const centerX = baseViewBox.minX + baseViewBox.width / 2;
    const centerY = baseViewBox.minY + baseViewBox.height / 2;

    const scaledWidth = baseViewBox.width / zoom;
    const scaledHeight = baseViewBox.height / zoom;

    // Clamp pan to keep map in bounds
    const maxPanX = (baseViewBox.width - scaledWidth) / 2;
    const maxPanY = (baseViewBox.height - scaledHeight) / 2;

    const clampedPanX = Math.max(-maxPanX, Math.min(maxPanX, pan.x));
    const clampedPanY = Math.max(-maxPanY, Math.min(maxPanY, pan.y));

    return {
      minX: centerX - scaledWidth / 2 - clampedPanX,
      minY: centerY - scaledHeight / 2 - clampedPanY,
      width: scaledWidth,
      height: scaledHeight,
    };
  }, [baseViewBox, zoom, pan]);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta * prev)));
  }, []);

  // Handle mouse down for pan start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  // Handle mouse move for panning
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;

      const dx = (e.clientX - dragStart.x) * scaleX;
      const dy = (e.clientY - dragStart.y) * scaleY;

      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    },
    [isDragging, dragStart, viewBox.width, viewBox.height]
  );

  // Handle mouse up for pan end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouseup listener to handle mouse release outside SVG
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full select-none"
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
      preserveAspectRatio="xMidYMid meet"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Render all hex territories */}
      {territories.map((territory) => {
        const pos = hexToPixel({ q: territory.q, r: territory.r }, layout);
        const isSelected = territory.id === selectedTerritoryId;
        const fillColor = getTerritoryColor(territory);

        return (
          <g key={territory.id} className="hex-territory">
            {/* Hex shape */}
            <path
              d={hexPath(pos.x, pos.y, layout.size)}
              fill={fillColor}
              stroke={isSelected ? '#000' : '#666'}
              strokeWidth={isSelected ? 2 : 1}
              className="cursor-pointer hover:brightness-110 transition-all"
              onClick={() => onTerritoryClick?.(territory)}
            />
            {/* Population indicator (small dot if populated) */}
            {territory.population > 0 && (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={3}
                fill={territory.owner ? '#fff' : '#666'}
                opacity={0.8}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default HexGrid;
