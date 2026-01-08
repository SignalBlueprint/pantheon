'use client';

import { useState, useEffect, useCallback } from 'react';
import { Highlight, SpectatorLink } from '@pantheon/shared';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  highlight?: Highlight;
  spectatorLink?: SpectatorLink;
  shardId?: string;
  tick?: number;
  title?: string;
  description?: string;
}

/**
 * Social platform share configurations
 */
const SHARE_PLATFORMS = [
  {
    id: 'twitter',
    name: 'Twitter/X',
    icon: '𝕏',
    color: 'bg-black hover:bg-gray-900',
    getUrl: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: 'reddit',
    name: 'Reddit',
    icon: '🔴',
    color: 'bg-orange-600 hover:bg-orange-700',
    getUrl: (url: string, text: string) =>
      `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '💬',
    color: 'bg-indigo-600 hover:bg-indigo-700',
    getUrl: null, // Discord doesn't have a direct share URL, just copy
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: '📘',
    color: 'bg-blue-600 hover:bg-blue-700',
    getUrl: (url: string, text: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
  },
] as const;

/**
 * Share Modal component for social sharing
 */
export function ShareModal({
  isOpen,
  onClose,
  highlight,
  spectatorLink,
  shardId,
  tick,
  title,
  description,
}: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareText, setShareText] = useState<string>('');
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate or use existing share URL
  useEffect(() => {
    if (!isOpen) return;

    const generateShareUrl = async () => {
      // If we already have a spectator link, use it
      if (spectatorLink) {
        setShareUrl(`${window.location.origin}/watch/${spectatorLink.code}`);
        setShareText(spectatorLink.title || 'Check out this Pantheon moment!');
        return;
      }

      // If we have a highlight, create a spectator link for it
      if (highlight) {
        setIsCreatingLink(true);
        try {
          const response = await fetch('/api/spectator-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shardId: highlight.shardId,
              startTick: highlight.tick,
              title: highlight.title,
              description: highlight.description,
              seasonId: highlight.seasonId,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            setShareUrl(`${window.location.origin}/watch/${data.code}`);
            setShareText(highlight.title);

            // Increment share count
            await fetch(`/api/highlights/${highlight.id}/share`, { method: 'POST' });
          } else {
            setError('Failed to create share link');
          }
        } catch (err) {
          setError('Failed to create share link');
        } finally {
          setIsCreatingLink(false);
        }
        return;
      }

      // Create new spectator link from provided data
      if (shardId && tick !== undefined) {
        setIsCreatingLink(true);
        try {
          const response = await fetch('/api/spectator-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shardId,
              startTick: tick,
              title: title || 'Pantheon Moment',
              description,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            setShareUrl(`${window.location.origin}/watch/${data.code}`);
            setShareText(title || 'Check out this Pantheon moment!');
          } else {
            setError('Failed to create share link');
          }
        } catch (err) {
          setError('Failed to create share link');
        } finally {
          setIsCreatingLink(false);
        }
      }
    };

    generateShareUrl();
  }, [isOpen, highlight, spectatorLink, shardId, tick, title, description]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  }, [shareUrl]);

  // Share to platform
  const handleShare = useCallback(
    (platform: typeof SHARE_PLATFORMS[number]) => {
      if (platform.getUrl) {
        window.open(platform.getUrl(shareUrl, shareText), '_blank', 'noopener,noreferrer');
      } else {
        // For platforms without direct share URL (like Discord), copy to clipboard
        handleCopy();
      }
    },
    [shareUrl, shareText, handleCopy]
  );

  // Native share API
  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareText,
          text: description || 'Check out this Pantheon highlight!',
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
        if ((err as Error).name !== 'AbortError') {
          setError('Share failed');
        }
      }
    }
  }, [shareUrl, shareText, description]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📤</span>
            Share Moment
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isCreatingLink ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-gray-400">Creating share link...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <span className="text-4xl block mb-4">❌</span>
              <p className="text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Preview */}
              {(highlight || title) && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="font-medium text-white">{highlight?.title || title}</h3>
                  {(highlight?.description || description) && (
                    <p className="text-gray-400 text-sm mt-1">
                      {highlight?.description || description}
                    </p>
                  )}
                </div>
              )}

              {/* Share URL */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Share Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm"
                  />
                  <button
                    onClick={handleCopy}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Native share button (if available) */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={handleNativeShare}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg text-white font-medium transition-all"
                >
                  📱 Share via Device
                </button>
              )}

              {/* Social platforms */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-3">
                  Share to Platform
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {SHARE_PLATFORMS.map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => handleShare(platform)}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-medium transition-colors ${platform.color}`}
                    >
                      <span className="text-lg">{platform.icon}</span>
                      {platform.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Embed code (for advanced users) */}
              <details className="group">
                <summary className="text-sm text-gray-400 cursor-pointer hover:text-white transition-colors">
                  Advanced: Embed Code
                </summary>
                <div className="mt-3">
                  <textarea
                    readOnly
                    value={`<iframe src="${shareUrl}/embed" width="640" height="360" frameborder="0" allowfullscreen></iframe>`}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-300 text-xs font-mono h-20"
                  />
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShareModal;
