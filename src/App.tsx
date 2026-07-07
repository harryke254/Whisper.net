import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ShieldAlert, 
  Search, 
  SlidersHorizontal, 
  PenTool, 
  User, 
  Lock, 
  Clock, 
  Database,
  Globe,
  Heart,
  ChevronDown,
  Terminal
} from 'lucide-react';
import { Whisper, UserProfile, THEMES, TAGS } from './types';
import { getOrCreateUserProfile, regenerateProfileName, toggleSaveWhisper } from './lib/user';
import { db } from './lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  arrayUnion, 
  arrayRemove,
  query,
  orderBy,
  limit,
  onSnapshot 
} from 'firebase/firestore';

import StarsBackground from './components/StarsBackground';
import WhisperCard from './components/WhisperCard';
import WhisperComposer from './components/WhisperComposer';
import WhisperModal from './components/WhisperModal';
import ProfileDrawer from './components/ProfileDrawer';
import TerminalConsole from './components/TerminalConsole';

export default function App() {
  // 1. User Identity State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // 1b. Navigation Tab
  const [activeTab, setActiveTab] = useState<'feed' | 'terminal'>('feed');

  // 2. Whispers & Query States
  const [rawWhispers, setRawWhispers] = useState<Whisper[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', specific tag, 'my-whispers', 'bookmarks'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'likes' | 'replies'>('newest');

  // 3. UI Toggle States
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedWhisper, setSelectedWhisper] = useState<Whisper | null>(null);

  // Initialize User Profile
  useEffect(() => {
    const profile = getOrCreateUserProfile();
    setUserProfile(profile);
  }, []);

  // Fetch Whispers from Firestore in real-time
  useEffect(() => {
    setLoading(true);
    // Fetch latest 300 whispers to perform client-side filtering/sorting robustly
    const whispersRef = collection(db, 'whispers');
    const q = query(whispersRef, orderBy('createdAt', 'desc'), limit(300));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Whisper[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          ...data,
        } as Whisper);
      });
      setRawWhispers(list);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to whispers:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter and Sort raw whispers on the client-side
  const getFilteredAndSortedWhispers = (): Whisper[] => {
    if (!userProfile) return [];

    const now = Date.now();

    return rawWhispers
      .filter((whisper) => {
        // 1. Filter out expired whispers
        if (whisper.expiresAt && whisper.expiresAt < now) {
          return false;
        }

        // 2. Filter out highly reported whispers (surveillance-free moderation)
        if (whisper.reports && whisper.reports.length >= 3) {
          return false;
        }

        // 3. Filter out if reported by current user specifically
        if (whisper.reports && whisper.reports.includes(userProfile.id)) {
          return false;
        }

        // 4. Category/Filter tab check
        if (activeFilter === 'my-whispers') {
          return whisper.creatorId === userProfile.id;
        }
        if (activeFilter === 'bookmarks') {
          return userProfile.savedWhispers?.includes(whisper.id);
        }
        if (activeFilter !== 'all') {
          return whisper.tag === activeFilter;
        }

        return true;
      })
      .filter((whisper) => {
        // 5. Search query match
        if (!searchQuery.trim()) return true;
        const queryLower = searchQuery.toLowerCase();
        return (
          whisper.content.toLowerCase().includes(queryLower) ||
          whisper.tag.toLowerCase().includes(queryLower)
        );
      })
      .sort((a, b) => {
        // 6. Sorting options
        if (sortBy === 'likes') {
          return b.likes.length - a.likes.length;
        }
        if (sortBy === 'replies') {
          return (b.commentsCount || 0) - (a.commentsCount || 0);
        }
        return b.createdAt - a.createdAt; // default newest
      });
  };

  const processedWhispers = getFilteredAndSortedWhispers();

  // Handlers
  const handlePostWhisper = async (
    content: string,
    themeId: string,
    fontId: string,
    tag: string,
    showName: boolean,
    selfDestruct: boolean
  ) => {
    if (!userProfile) return;

    const expiresAt = selfDestruct ? Date.now() + 24 * 60 * 60 * 1000 : null;

    await addDoc(collection(db, 'whispers'), {
      content,
      createdAt: Date.now(),
      creatorId: userProfile.id,
      creatorName: `${userProfile.avatarEmoji} ${userProfile.name}`,
      showName,
      background: themeId,
      font: fontId,
      tag,
      likes: [],
      reports: [],
      expiresAt,
      commentsCount: 0,
    });

    setIsComposerOpen(false);
  };

  const handleLikeWhisper = async (whisperId: string) => {
    if (!userProfile) return;

    const whisper = rawWhispers.find((w) => w.id === whisperId);
    if (!whisper) return;

    const docRef = doc(db, 'whispers', whisperId);
    const hasLiked = whisper.likes.includes(userProfile.id);

    try {
      if (hasLiked) {
        await updateDoc(docRef, {
          likes: arrayRemove(userProfile.id),
        });
      } else {
        await updateDoc(docRef, {
          likes: arrayUnion(userProfile.id),
        });
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const handleSaveWhisper = (whisperId: string) => {
    if (!userProfile) return;
    const updated = toggleSaveWhisper(userProfile, whisperId);
    setUserProfile(updated);
  };

  const handleDeleteWhisper = async (whisperId: string) => {
    try {
      await deleteDoc(doc(db, 'whispers', whisperId));
      if (selectedWhisper?.id === whisperId) {
        setSelectedWhisper(null);
      }
    } catch (err) {
      console.error('Failed to delete whisper:', err);
    }
  };

  const handleReportWhisper = async (whisperId: string) => {
    if (!userProfile) return;
    const docRef = doc(db, 'whispers', whisperId);
    try {
      await updateDoc(docRef, {
        reports: arrayUnion(userProfile.id),
      });
    } catch (err) {
      console.error('Failed to report whisper:', err);
    }
  };

  const handleRegeneratePersona = () => {
    if (!userProfile) return;
    const updated = regenerateProfileName(userProfile);
    setUserProfile(updated);
  };

  // Synchronize detailed view whisper real-time fields (likes count, comments count, etc.)
  const currentDetailedWhisper = selectedWhisper
    ? rawWhispers.find((w) => w.id === selectedWhisper.id) || selectedWhisper
    : null;

  return (
    <div className="relative min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col font-sans overflow-x-hidden selection:bg-white/10 selection:text-white">
      
      {/* Dynamic Starfield Background */}
      <StarsBackground />

      {/* Visual Flares from Sophisticated Dark design */}
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed top-0 left-0 w-64 h-64 bg-white/[0.02] blur-[80px] pointer-events-none z-0"></div>

      {/* HEADER SECTION */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050505]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-20 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Logo Branding - Sophisticated Wide Styling */}
          <div className="flex flex-col">
            <div className="text-[18px] sm:text-[22px] font-light tracking-[0.3em] text-white uppercase flex items-center gap-1.5">
              Aether
              <span className="text-[9px] font-medium tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 uppercase">
                Void
              </span>
            </div>
            <div className="text-[9px] uppercase tracking-widest text-white/40 mt-1">
              The Anonymous Collective
            </div>
          </div>

          {/* Secure Status & Active Minds Indicator */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-widest text-white/50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></div>
              <span>4.2k Active Minds</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-widest text-white/40">
              <Lock size={10} className="text-white/40" />
              <span>Node: 88.23.01.ALPHA</span>
            </div>
          </div>

          {/* User Profile & Write Actions */}
          <div className="flex items-center gap-3">
            <button
              id="header-profile-btn"
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 transition-all duration-300"
              title="View Identity & Stats"
            >
              <span className="text-sm">{userProfile?.avatarEmoji || '✨'}</span>
              <span className="hidden sm:inline text-[10px] uppercase tracking-wider">{userProfile?.name || 'Loading'}</span>
              <User size={13} className="text-white/40 sm:hidden" />
            </button>

            <button
              id="header-compose-btn"
              onClick={() => setIsComposerOpen(!isComposerOpen)}
              className="flex items-center gap-2 px-5 py-2 border border-white/60 text-white text-[11px] uppercase tracking-[0.2em] hover:bg-white hover:text-black hover:border-white transition-all duration-300 rounded-full shadow-lg shadow-white/5"
            >
              <PenTool size={11} />
              <span>Whisper</span>
            </button>
          </div>

        </div>
      </header>

      {/* MAIN BODY WRAPPER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 z-10 relative">
        
        {/* HERO TITLE BLOCK */}
        <div className="text-center space-y-4 mb-14 max-w-xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-extralight tracking-[0.15em] text-white uppercase font-sans">
              Speak into the void.
            </h2>
          </motion.div>
          <p className="text-white/40 text-xs sm:text-sm uppercase tracking-widest leading-relaxed">
            A safe, zero-tracking, device-encrypted network where untold confessions, hopes, and secrets flow anonymously.
          </p>
        </div>

        {/* COMPOSER COLLAPSED PANEL */}
        <AnimatePresence>
          {isComposerOpen && userProfile && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: '2.5rem' }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <WhisperComposer userProfile={userProfile} onPostWhisper={handlePostWhisper} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* VIEW SELECTOR TABS */}
        <div className="flex justify-center gap-4 mb-10">
          <button
            id="tab-view-feed"
            onClick={() => setActiveTab('feed')}
            className={`px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.2em] font-bold transition-all duration-300 border cursor-pointer ${
              activeTab === 'feed'
                ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.15)]'
                : 'bg-white/5 border-white/5 hover:border-white/20 text-white/50 hover:text-white'
            }`}
          >
            🌌 Public Void Feed
          </button>
          <button
            id="tab-view-terminal"
            onClick={() => setActiveTab('terminal')}
            className={`px-6 py-2.5 rounded-full text-xs uppercase tracking-[0.2em] font-bold transition-all duration-300 border cursor-pointer flex items-center gap-2 ${
              activeTab === 'terminal'
                ? 'bg-emerald-500 text-black border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'bg-white/5 border-white/5 hover:border-emerald-500/20 text-white/50 hover:text-emerald-400'
            }`}
          >
            <Terminal size={12} />
            Void CLI Shell
          </button>
        </div>

        {activeTab === 'terminal' && userProfile ? (
          <div className="mt-4">
            <TerminalConsole
              userProfile={userProfile}
              onChangeProfile={(profile) => setUserProfile(profile)}
              onPostWhisper={handlePostWhisper}
              rawWhispers={rawWhispers}
            />
          </div>
        ) : (
          <>
            {/* FILTERS & SEARCH ROW */}
            <div className="space-y-6 mb-10">
          
          {/* Tag filter selector */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase tracking-widest select-none">
              <Globe size={11} className="text-white/30" />
              <span>Filter Collective Feed</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Tag Badges scroller */}
            <div className="flex flex-wrap gap-2 max-w-full">
              <button
                id="filter-tag-all"
                onClick={() => setActiveFilter('all')}
                className={`px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest transition-all duration-300 border ${
                  activeFilter === 'all'
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 border-white/5 hover:border-white/20 text-white/50 hover:text-white'
                }`}
              >
                All Whispers
              </button>

              {TAGS.map((tag) => (
                <button
                  id={`filter-tag-${tag.replace('#', '')}`}
                  key={tag}
                  onClick={() => setActiveFilter(tag)}
                  className={`px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest transition-all duration-300 border ${
                    activeFilter === tag
                      ? 'bg-white text-black border-white'
                      : 'bg-white/5 border-white/5 hover:border-white/20 text-white/50 hover:text-white'
                  }`}
                >
                  {tag}
                </button>
              ))}

              <div className="w-px h-6 bg-white/10 mx-1 self-center hidden sm:block" />

              <button
                id="filter-tag-my-whispers"
                onClick={() => setActiveFilter('my-whispers')}
                className={`px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest transition-all duration-300 border ${
                  activeFilter === 'my-whispers'
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 border-white/5 hover:border-white/20 text-white/50 hover:text-white'
                }`}
              >
                My Whispers
              </button>

              <button
                id="filter-tag-bookmarks"
                onClick={() => setActiveFilter('bookmarks')}
                className={`px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest transition-all duration-300 border ${
                  activeFilter === 'bookmarks'
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 border-white/5 hover:border-white/20 text-white/50 hover:text-white'
                }`}
              >
                Bookmarked
              </button>
            </div>

            {/* Search and Sort controls */}
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              {/* Search input */}
              <div className="relative flex-1 sm:w-64">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  id="feed-search-bar"
                  type="text"
                  placeholder="SEARCH FEED..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 hover:border-white/15 focus:border-white/25 rounded-full pl-10 pr-4 py-2 text-[10px] tracking-wider uppercase text-white placeholder-white/30 focus:outline-none transition-all duration-300"
                />
              </div>

              {/* Sorting option select */}
              <div className="relative">
                <select
                  id="feed-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="appearance-none w-full bg-white/5 border border-white/5 hover:border-white/15 focus:border-white/25 rounded-full pl-4 pr-10 py-2 text-[10px] uppercase tracking-widest text-white/70 font-semibold focus:outline-none cursor-pointer transition-all duration-300"
                >
                  <option value="newest" className="bg-[#050505] text-white">Sort: Newest</option>
                  <option value="likes" className="bg-[#050505] text-white">Sort: Most Liked</option>
                  <option value="replies" className="bg-[#050505] text-white">Sort: Most Replied</option>
                </select>
                <ChevronDown size={11} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              </div>
            </div>

          </div>
        </div>

        {/* FEED GRID VIEW */}
        {loading ? (
          /* Loading Skeleton Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[280px] bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="w-16 h-5 bg-slate-800 rounded-full" />
                  <div className="w-20 h-4 bg-slate-800 rounded" />
                </div>
                <div className="space-y-2 py-4">
                  <div className="w-4/5 h-4 bg-slate-800 rounded mx-auto" />
                  <div className="w-11/12 h-4 bg-slate-800 rounded mx-auto" />
                  <div className="w-3/4 h-4 bg-slate-800 rounded mx-auto" />
                </div>
                <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                  <div className="w-24 h-4 bg-slate-800 rounded" />
                  <div className="flex gap-2">
                    <div className="w-8 h-4 bg-slate-800 rounded" />
                    <div className="w-8 h-4 bg-slate-800 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : processedWhispers.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24 rounded-3xl border border-white/10 bg-white/[0.02] max-w-2xl mx-auto p-8"
          >
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-xl mx-auto text-white/70 mb-5 shadow-inner">
              🕳️
            </div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-[0.15em] mb-2">Silence in the Void</h3>
            <p className="text-xs uppercase tracking-wider text-white/40 max-w-md mx-auto mb-8 leading-relaxed">
              {activeFilter === 'my-whispers'
                ? "You haven't whispered anything into the void yet. Share a secret or a thought to see it here."
                : activeFilter === 'bookmarks'
                ? "You haven't bookmarked any whispers yet. Tap the bookmark icon on any whisper card to save it."
                : "No matching whispers found in the void. Be the first to start a new thread!"}
            </p>
            <button
              id="empty-state-compose-btn"
              onClick={() => setIsComposerOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 border border-white/60 hover:bg-white hover:text-black hover:border-white text-[10px] uppercase tracking-[0.2em] font-bold text-white transition-all duration-300 rounded-full"
            >
              <PenTool size={11} />
              <span>Share a Whisper</span>
            </button>
          </motion.div>
        ) : (
          /* Real Whispers Feed Grid */
          <motion.div 
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {processedWhispers.map((whisper) => (
                <WhisperCard
                  key={whisper.id}
                  whisper={whisper}
                  currentUserId={userProfile?.id || ''}
                  isSaved={userProfile?.savedWhispers?.includes(whisper.id) || false}
                  onLike={handleLikeWhisper}
                  onSave={handleSaveWhisper}
                  onDelete={handleDeleteWhisper}
                  onReport={handleReportWhisper}
                  onOpenDetails={(w) => setSelectedWhisper(w)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

          </>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/10 mt-20 py-10 text-center text-[10px] tracking-wider uppercase text-white/40 bg-[#050505] relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="tracking-widest">© 2026 Whisper Network. All transmissions fully anonymous & ephemeral.</p>
          <div className="flex gap-4">
            <span className="hover:text-white cursor-help transition-colors" onClick={() => setIsProfileOpen(true)}>Security Information</span>
            <span>·</span>
            <span className="text-white/20 select-none">No Trackers Enabled</span>
          </div>
        </div>
      </footer>

      {/* 1. SLIDING PROFILE & SECURITY DRAWER */}
      {userProfile && (
        <ProfileDrawer
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          userProfile={userProfile}
          onRegenerateName={handleRegeneratePersona}
        />
      )}

      {/* 2. DETAILED DISCUSSION MODAL */}
      <AnimatePresence>
        {currentDetailedWhisper && userProfile && (
          <WhisperModal
            whisper={currentDetailedWhisper}
            userProfile={userProfile}
            isSaved={userProfile.savedWhispers?.includes(currentDetailedWhisper.id) || false}
            onClose={() => setSelectedWhisper(null)}
            onLike={handleLikeWhisper}
            onSave={handleSaveWhisper}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
