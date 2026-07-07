import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Heart, 
  MessageCircle, 
  Bookmark, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  User,
  Share2,
  Check
} from 'lucide-react';
import { Whisper, THEMES, FONTS } from '../types';
import { getRelativeTime, getExpiryCountdown } from '../lib/utils';

interface WhisperCardProps {
  key?: string;
  whisper: Whisper;
  currentUserId: string;
  isSaved: boolean;
  onLike: (whisperId: string) => void;
  onSave: (whisperId: string) => void;
  onDelete: (whisperId: string) => void;
  onReport: (whisperId: string) => void;
  onOpenDetails: (whisper: Whisper) => void;
}

export default function WhisperCard({
  whisper,
  currentUserId,
  isSaved,
  onLike,
  onSave,
  onDelete,
  onReport,
  onOpenDetails,
}: WhisperCardProps) {
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);

  const themePreset = THEMES.find((t) => t.id === whisper.background) || THEMES[0];
  const fontPreset = FONTS.find((f) => f.id === whisper.font) || FONTS[0];
  const hasLiked = whisper.likes.includes(currentUserId);
  const hasReported = whisper.reports.includes(currentUserId);

  useEffect(() => {
    if (whisper.expiresAt) {
      setCountdown(getExpiryCountdown(whisper.expiresAt));
      const interval = setInterval(() => {
        const remaining = getExpiryCountdown(whisper.expiresAt);
        setCountdown(remaining);
        if (remaining === 'Expired') {
          clearInterval(interval);
        }
      }, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [whisper.expiresAt]);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(
      `"${whisper.content}"\n- Shared via Whisper (Secure & Anonymous messages)`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      id={`whisper-card-${whisper.id}`}
      layoutId={`card-container-${whisper.id}`}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={() => onOpenDetails(whisper)}
      className={`relative flex flex-col justify-between h-[280px] p-6 rounded-2xl border cursor-pointer overflow-hidden transition-all duration-300 ${themePreset.class}`}
    >
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-radial-at-t from-white/5 to-transparent pointer-events-none" />

      {/* Header Info */}
      <div className="flex items-start justify-between z-10">
        <span className="px-3 py-1 text-[9px] uppercase font-bold tracking-widest rounded-full bg-white/10 border border-white/5 backdrop-blur-md">
          {whisper.tag}
        </span>

        <div className="flex items-center gap-2 text-xs opacity-70">
          {countdown && (
            <div className="flex items-center gap-1 text-rose-300 bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-500/20">
              <Clock size={11} className="animate-pulse" />
              <span>{countdown}</span>
            </div>
          )}
          <span>{getRelativeTime(whisper.createdAt)}</span>
        </div>
      </div>

      {/* Main Whisper Text Content */}
      <div className="my-auto z-10 flex flex-col justify-center max-h-[140px] overflow-hidden">
        <p className={`text-base md:text-lg text-center leading-relaxed ${fontPreset.class} break-words line-clamp-5`}>
          "{whisper.content}"
        </p>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/10 z-10 text-xs">
        {/* Creator Name (if visible) */}
        <div className="flex items-center gap-1.5 opacity-80 font-medium">
          <User size={13} className="opacity-70" />
          <span>{whisper.showName ? whisper.creatorName : 'Deeply Anonymous'}</span>
          {whisper.creatorId === currentUserId && (
            <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-400/20 px-1.5 py-0.5 rounded ml-1">
              You
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Like Button */}
          <button
            id={`like-btn-${whisper.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onLike(whisper.id);
            }}
            className={`flex items-center gap-1 hover:scale-110 active:scale-95 transition-all duration-200 p-1.5 rounded-full hover:bg-white/10 ${
              hasLiked ? 'text-rose-400 font-bold' : 'opacity-70 hover:opacity-100'
            }`}
            title="Like Whisper"
          >
            <Heart size={15} fill={hasLiked ? 'currentColor' : 'none'} className={hasLiked ? 'animate-bounce' : ''} />
            <span className="text-xs">{whisper.likes.length}</span>
          </button>

          {/* Comment Button */}
          <div className="flex items-center gap-1 opacity-70 p-1.5 rounded-full">
            <MessageCircle size={15} />
            <span className="text-xs">{whisper.commentsCount}</span>
          </div>

          {/* Save Button */}
          <button
            id={`save-btn-${whisper.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onSave(whisper.id);
            }}
            className={`hover:scale-110 active:scale-95 transition-all duration-200 p-1.5 rounded-full hover:bg-white/10 ${
              isSaved ? 'text-amber-400' : 'opacity-70 hover:opacity-100'
            }`}
            title={isSaved ? 'Unsave Whisper' : 'Save Whisper'}
          >
            <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} />
          </button>

          {/* Share Button */}
          <button
            id={`share-btn-${whisper.id}`}
            onClick={handleShare}
            className="opacity-70 hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 p-1.5 rounded-full hover:bg-white/10"
            title="Copy Whisper to Clipboard"
          >
            {copied ? <Check size={15} className="text-emerald-400" /> : <Share2 size={15} />}
          </button>

          {/* Report Button (if not creator) */}
          {whisper.creatorId !== currentUserId && (
            <button
              id={`report-btn-${whisper.id}`}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to flag and report this anonymous message? If reported by multiple people, it will be hidden.')) {
                  onReport(whisper.id);
                }
              }}
              className={`hover:scale-110 transition-all duration-200 p-1.5 rounded-full hover:bg-white/10 ${
                hasReported ? 'text-amber-500 opacity-100' : 'opacity-40 hover:opacity-100 hover:text-red-400'
              }`}
              title="Report/Flag"
              disabled={hasReported}
            >
              <AlertTriangle size={15} />
            </button>
          )}

          {/* Delete Button (if creator) */}
          {whisper.creatorId === currentUserId && (
            <button
              id={`delete-btn-${whisper.id}`}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Delete your whisper permanently? This action is instant and irreversible.')) {
                  onDelete(whisper.id);
                }
              }}
              className="text-red-400 hover:text-red-300 hover:scale-110 active:scale-95 transition-all duration-200 p-1.5 rounded-full hover:bg-white/10"
              title="Delete Whisper"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
