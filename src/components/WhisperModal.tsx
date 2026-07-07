import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Send, 
  MessageCircle, 
  Clock, 
  User, 
  Trash2, 
  Lock,
  Heart,
  Bookmark
} from 'lucide-react';
import { Whisper, Comment, UserProfile, THEMES, FONTS } from '../types';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  getDocs 
} from 'firebase/firestore';
import { getRelativeTime, getExpiryCountdown } from '../lib/utils';

interface WhisperModalProps {
  whisper: Whisper;
  userProfile: UserProfile;
  isSaved: boolean;
  onClose: () => void;
  onLike: (whisperId: string) => void;
  onSave: (whisperId: string) => void;
}

const COMMENT_BG_OPTIONS = [
  { id: 'slate', class: 'bg-white/5 border-white/10 text-white/90' },
  { id: 'indigo', class: 'bg-indigo-950/20 border-indigo-500/10 text-indigo-100/90' },
  { id: 'fuchsia', class: 'bg-fuchsia-950/20 border-fuchsia-500/10 text-fuchsia-100/90' },
  { id: 'emerald', class: 'bg-emerald-950/20 border-emerald-500/10 text-emerald-100/90' },
];

export default function WhisperModal({
  whisper,
  userProfile,
  isSaved,
  onClose,
  onLike,
  onSave,
}: WhisperModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [selectedBg, setSelectedBg] = useState('slate');
  const [showName, setShowName] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);

  const themePreset = THEMES.find((t) => t.id === whisper.background) || THEMES[0];
  const fontPreset = FONTS.find((f) => f.id === whisper.font) || FONTS[0];
  const hasLiked = whisper.likes.includes(userProfile.id);

  // Expiry updates
  useEffect(() => {
    if (whisper.expiresAt) {
      setCountdown(getExpiryCountdown(whisper.expiresAt));
      const interval = setInterval(() => {
        setCountdown(getExpiryCountdown(whisper.expiresAt));
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [whisper.expiresAt]);

  // Load comments in real-time
  useEffect(() => {
    const commentsRef = collection(db, 'whispers', whisper.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Comment[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Comment);
      });
      setComments(list);
    }, (error) => {
      console.error('Error loading comments:', error);
    });

    return () => unsubscribe();
  }, [whisper.id]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmitting(true);
    try {
      const commentsRef = collection(db, 'whispers', whisper.id, 'comments');
      await addDoc(commentsRef, {
        whisperId: whisper.id,
        content: commentText.trim(),
        createdAt: Date.now(),
        creatorId: userProfile.id,
        creatorName: `${userProfile.avatarEmoji} ${userProfile.name}`,
        showName,
        background: selectedBg,
      });

      // Update local comment count increment in whispers list can also be done, 
      // but in standard React we can just listen to snapshot, or we have a transaction on backend.
      // We will also increment comment count on the document inside App.tsx or directly here.
      // Let's do it directly on Firestore whisper doc.
      // We will export a method, or just write directly. Let's do a fast write here for counts.
      // In this setup, we can write a simple document update.
      setCommentText('');
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete your comment permanently?')) return;
    try {
      const commentDocRef = doc(db, 'whispers', whisper.id, 'comments', commentId);
      await deleteDoc(commentDocRef);
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
      />

      {/* Modal Container */}
      <motion.div
        layoutId={`card-container-${whisper.id}`}
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        className="relative w-full max-w-2xl h-[90vh] md:h-[80vh] flex flex-col bg-[#050505] border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-10"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#050505]/50 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Lock size={12} className="text-white/40" />
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
              Secure Whisper Dialogue
            </span>
          </div>
          <button
            id="close-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/5 text-white/50 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Detailed Whisper Card */}
          <div className={`relative p-8 rounded-2xl border overflow-hidden ${themePreset.class}`}>
            <div className="absolute inset-0 bg-radial-at-t from-white/5 to-transparent pointer-events-none" />
            
            <div className="flex items-center justify-between text-xs opacity-80 z-10 relative mb-4">
              <span className="px-3 py-1 text-[9px] uppercase font-bold tracking-widest rounded-full bg-white/10 border border-white/5 backdrop-blur-md">
                {whisper.tag}
              </span>
              <div className="flex items-center gap-2">
                {countdown && (
                  <span className="text-rose-300 bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-500/20 flex items-center gap-1">
                    <Clock size={11} className="animate-pulse" />
                    {countdown}
                  </span>
                )}
                <span>{getRelativeTime(whisper.createdAt)}</span>
              </div>
            </div>

            <p className={`text-lg md:text-2xl text-center leading-relaxed py-6 z-10 relative ${fontPreset.class} break-words`}>
              "{whisper.content}"
            </p>

            <div className="flex items-center justify-between border-t border-white/10 pt-4 z-10 relative text-xs opacity-90">
              <div className="flex items-center gap-1.5">
                <User size={13} className="opacity-70" />
                <span>{whisper.showName ? whisper.creatorName : 'Deeply Anonymous'}</span>
                {whisper.creatorId === userProfile.id && (
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-400/20 px-1.5 py-0.5 rounded">
                    You
                  </span>
                )}
              </div>

              {/* Like / Save toggles directly on details card */}
              <div className="flex items-center gap-3">
                <button
                  id="modal-like-btn"
                  onClick={() => onLike(whisper.id)}
                  className={`flex items-center gap-1 hover:scale-105 p-1.5 rounded-full hover:bg-white/10 transition-all ${
                    hasLiked ? 'text-rose-400' : 'text-white/70'
                  }`}
                >
                  <Heart size={15} fill={hasLiked ? 'currentColor' : 'none'} />
                  <span>{whisper.likes.length}</span>
                </button>

                <button
                  id="modal-save-btn"
                  onClick={() => onSave(whisper.id)}
                  className={`p-1.5 rounded-full hover:bg-white/10 hover:scale-105 transition-all ${
                    isSaved ? 'text-amber-400' : 'text-white/70'
                  }`}
                  title={isSaved ? 'Unsave Whisper' : 'Save Whisper'}
                >
                  <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40 font-bold">
              <MessageCircle size={13} className="text-white/40" />
              <span>Responses ({comments.length})</span>
            </div>

            {comments.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No replies whispered yet. Be the first to reply to the void.
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => {
                  const commentBg = COMMENT_BG_OPTIONS.find(c => c.id === comment.background) || COMMENT_BG_OPTIONS[0];
                  return (
                    <motion.div
                      id={`comment-item-${comment.id}`}
                      key={comment.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-4 rounded-xl border text-sm flex flex-col justify-between gap-2 transition-all ${commentBg.class}`}
                    >
                      <div className="flex items-center justify-between text-xs opacity-75">
                        <div className="flex items-center gap-1">
                          <User size={12} />
                          <span className="font-medium">
                            {comment.showName ? comment.creatorName : 'Deeply Anonymous'}
                          </span>
                          {comment.creatorId === userProfile.id && (
                            <span className="text-[9px] bg-sky-500/20 text-sky-300 border border-sky-400/20 px-1 py-0.2 rounded ml-1">
                              You
                            </span>
                          )}
                        </div>
                        <span>{getRelativeTime(comment.createdAt)}</span>
                      </div>

                      <p className="leading-relaxed text-slate-100 pr-4 break-words">
                        {comment.content}
                      </p>

                      {comment.creatorId === userProfile.id && (
                        <div className="flex justify-end pt-1">
                          <button
                            id={`delete-comment-${comment.id}`}
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-rose-400 hover:text-rose-300 flex items-center gap-1 text-xs transition-colors p-1 rounded hover:bg-white/5"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Reply Editor (Sticky Footer) */}
        <div className="p-6 border-t border-white/10 bg-[#050505]">
          <form onSubmit={handlePostComment} className="space-y-4">
            {/* Options bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Comment Bubble style selection */}
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40 font-semibold">
                <span>Bubble Style:</span>
                <div className="flex gap-1.5">
                  {COMMENT_BG_OPTIONS.map((opt) => (
                    <button
                      id={`comment-bg-${opt.id}`}
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedBg(opt.id)}
                      className={`w-4 h-4 rounded-full border transition-all duration-300 ${
                        selectedBg === opt.id ? 'border-white scale-125' : 'border-white/20 hover:scale-110'
                      } ${opt.class.split(' ')[0]}`}
                    />
                  ))}
                </div>
              </div>

              {/* Alias switcher */}
              <div className="flex items-center gap-3">
                <button
                  id="modal-toggle-comment-name"
                  type="button"
                  onClick={() => setShowName(!showName)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[10px] uppercase tracking-wider font-semibold transition-all duration-300 ${
                    showName 
                      ? 'bg-white text-black border-white' 
                      : 'bg-white/5 border-white/5 text-white/40'
                  }`}
                >
                  <User size={11} />
                  <span>{showName ? `As "${userProfile.name}"` : 'Deeply Anonymous'}</span>
                </button>
                <span className="text-white/30 font-mono text-xs">
                  {200 - commentText.length}
                </span>
              </div>
            </div>

            {/* Input area */}
            <div className="flex gap-3">
              <input
                id="comment-input-field"
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value.slice(0, 200))}
                placeholder="Whisper your response..."
                className="flex-1 bg-white/5 border border-white/5 hover:border-white/15 focus:border-white/25 rounded-full px-5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none transition-all duration-300"
                disabled={isSubmitting}
              />
              <button
                id="submit-comment-btn"
                type="submit"
                disabled={isSubmitting || !commentText.trim()}
                className="bg-white hover:bg-transparent hover:text-white border border-white text-black text-[10px] uppercase tracking-[0.2em] font-bold rounded-full px-6 py-2.5 transition-all duration-300 active:scale-95 cursor-pointer disabled:opacity-30"
              >
                {isSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={11} />
                    <span className="hidden sm:inline">Reply</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
