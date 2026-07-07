import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  RefreshCw, 
  ShieldCheck, 
  Bookmark, 
  Send, 
  HelpCircle,
  Hash,
  Heart,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { UserProfile } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, getCountFromServer } from 'firebase/firestore';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onRegenerateName: () => void;
}

export default function ProfileDrawer({
  isOpen,
  onClose,
  userProfile,
  onRegenerateName,
}: ProfileDrawerProps) {
  const [whisperCount, setWhisperCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);

  // Fetch stats when drawer opens
  useEffect(() => {
    if (isOpen) {
      const fetchMyWhisperCount = async () => {
        setLoadingStats(true);
        try {
          const q = query(collection(db, 'whispers'), where('creatorId', '==', userProfile.id));
          const snapshot = await getCountFromServer(q);
          setWhisperCount(snapshot.data().count);
        } catch (err) {
          console.error('Failed to fetch user stats:', err);
        } finally {
          setLoadingStats(false);
        }
      };

      fetchMyWhisperCount();
    }
  }, [isOpen, userProfile.id]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950 backdrop-blur-sm"
          />

          {/* Drawer panel */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-screen max-w-md bg-[#050505] border-l border-white/10 text-[#e0e0e0] shadow-2xl flex flex-col h-full"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-white/60" size={18} />
                  <h2 className="text-xs uppercase tracking-[0.2em] font-semibold text-white">Anonymous Profile & Security</h2>
                </div>
                <button
                  id="close-profile-btn"
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-white/5 text-white/50 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-slate-800">
                
                {/* Persona Card */}
                <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                  
                  {/* Large Avatar */}
                  <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-4xl mx-auto shadow-inner mb-4">
                    {userProfile.avatarEmoji}
                  </div>

                  <span className="text-[9px] uppercase tracking-widest text-white/40 font-mono">My Pen Name</span>
                  <h3 className="text-lg uppercase tracking-wider font-semibold font-sans mt-1 text-white">{userProfile.name}</h3>

                  <button
                    id="regenerate-persona-btn"
                    onClick={onRegenerateName}
                    className="mt-5 inline-flex items-center gap-1.5 px-5 py-2 rounded-full border border-white/60 hover:bg-white hover:text-black hover:border-white text-[9px] uppercase tracking-[0.15em] font-bold text-white transition-all active:scale-95 duration-300"
                  >
                    <RefreshCw size={11} />
                    <span>Regenerate Persona</span>
                  </button>
                </div>

                {/* My Stats */}
                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-white/40">My Activity Stats</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 text-white/50 mb-1">
                        <Send size={11} />
                        <span className="text-[9px] uppercase tracking-widest font-bold">Whispers Shared</span>
                      </div>
                      <span className="text-lg font-bold font-mono text-white">
                        {loadingStats ? (
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin my-1" />
                        ) : (
                          whisperCount
                        )}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 text-white/50 mb-1">
                        <Bookmark size={11} />
                        <span className="text-[9px] uppercase tracking-widest font-bold">Bookmarks Saved</span>
                      </div>
                      <span className="text-lg font-bold font-mono text-white">
                        {userProfile.savedWhispers?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Security and Privacy Explanation */}
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="text-white/50" size={14} />
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-white/40">Privacy & Security Guidelines</h4>
                  </div>

                  <div className="space-y-4 text-xs leading-relaxed text-white/60">
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <div className="p-1 rounded bg-white/5 text-white/75 mt-0.5">
                        <ShieldCheck size={14} />
                      </div>
                      <div>
                        <h5 className="font-semibold text-white text-[11px] uppercase tracking-wider mb-0.5">Zero Registration Required</h5>
                        <p>No email addresses, phone numbers, or passwords are ever requested. Your identity is fully local.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <div className="p-1 rounded bg-white/5 text-white/75 mt-0.5">
                        <HelpCircle size={14} />
                      </div>
                      <div>
                        <h5 className="font-semibold text-white text-[11px] uppercase tracking-wider mb-0.5">Device-Locked Key Pairs</h5>
                        <p>When this app boots, your browser generates a local, secure cryptographic identifier. This is used to prove ownership of whispers you author, allowing you to delete them securely.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <div className="p-1 rounded bg-white/5 text-white/75 mt-0.5">
                        <X size={14} />
                      </div>
                      <div>
                        <h5 className="font-semibold text-white text-[11px] uppercase tracking-wider mb-0.5">Community-Led Self Moderation</h5>
                        <p>If an anonymous message is reported more than 3 times by separate users, it is automatically flagged and hidden from the global feed to maintain safety without centralized surveillance.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Notes */}
                <div className="pt-6 border-t border-white/10 text-[9px] uppercase tracking-[0.15em] text-center text-white/30 font-mono">
                  Whisper Network v1.0.0 · Secure Cryptographic Anonymous Feeds
                </div>

              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
