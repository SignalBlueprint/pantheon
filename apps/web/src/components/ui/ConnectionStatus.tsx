'use client';

import { ConnectionStatus as Status } from '../../hooks/useGameSocket';

interface ConnectionStatusProps {
  status: Status;
}

const statusConfig: Record<Status, { label: string; color: string; bgColor: string }> = {
  connected: {
    label: 'Connected',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  connecting: {
    label: 'Connecting...',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  reconnecting: {
    label: 'Reconnecting...',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  disconnected: {
    label: 'Disconnected',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
};

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const config = statusConfig[status];

  return (
    <div
      className={`fixed bottom-4 right-4 px-3 py-1.5 rounded-full text-sm font-medium ${config.bgColor} ${config.color}`}
    >
      <span className="inline-block w-2 h-2 rounded-full mr-2 animate-pulse"
        style={{ backgroundColor: status === 'connected' ? '#22c55e' : status === 'disconnected' ? '#ef4444' : '#eab308' }}
      />
      {config.label}
    </div>
  );
}

export default ConnectionStatus;
