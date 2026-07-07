import React, { useState, useEffect } from 'react';
import { Whisper, UserProfile } from './types';
import { getOrCreateUserProfile } from './lib/user';
import { db } from './lib/firebase';
import { 
  collection, 
  addDoc, 
  query,
  orderBy,
  limit,
  onSnapshot 
} from 'firebase/firestore';

import StarsBackground from './components/StarsBackground';
import TerminalConsole from './components/TerminalConsole';

export default function App() {
  // 1. User Identity State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // 2. Whispers State (for the terminal 'feed' command)
  const [rawWhispers, setRawWhispers] = useState<Whisper[]>([]);

  // Initialize User Profile
  useEffect(() => {
    const profile = getOrCreateUserProfile();
    setUserProfile(profile);
  }, []);

  // Fetch Whispers from Firestore in real-time
  useEffect(() => {
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
    }, (error) => {
      console.error('Error listening to whispers:', error);
    });

    return () => unsubscribe();
  }, []);

  // Securely post a whisper from the CLI
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
  };

  return (
    <div className="relative min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col font-sans overflow-x-hidden justify-center items-center p-4 sm:p-6 selection:bg-white/10 selection:text-white">
      
      {/* Dynamic Starfield Background */}
      <StarsBackground />

      {/* Visual Flares from Sophisticated Dark design */}
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed top-0 left-0 w-64 h-64 bg-white/[0.02] blur-[80px] pointer-events-none z-0"></div>

      {/* MAIN BODY WRAPPER - Terminal Console is the single, unified page */}
      <main className="w-full max-w-5xl z-10 relative my-auto">
        {userProfile && (
          <TerminalConsole
            userProfile={userProfile}
            onChangeProfile={(profile) => setUserProfile(profile)}
            onPostWhisper={handlePostWhisper}
            rawWhispers={rawWhispers}
          />
        )}
      </main>

    </div>
  );
}

