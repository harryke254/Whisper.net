import { UserProfile, ANONYMOUS_ADJECTIVES, ANONYMOUS_NOUNS, ANONYMOUS_EMOJIS } from '../types';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { DeliveryMetadata } from './network';

const STORAGE_KEY = 'whisper_user_profile_v1';

export async function syncUserProfileToFirestore(profile: UserProfile, location?: DeliveryMetadata): Promise<void> {
  try {
    await setDoc(doc(db, 'users', profile.id), {
      id: profile.id,
      name: profile.name,
      avatarEmoji: profile.avatarEmoji,
      createdAt: Date.now(),
      ...(location && { lastKnownLocation: location })
    }, { merge: true });
  } catch (err) {
    console.error('Failed to sync profile to firestore:', err);
  }
}

function generateRandomName(): string {
  const adj = ANONYMOUS_ADJECTIVES[Math.floor(Math.random() * ANONYMOUS_ADJECTIVES.length)];
  const noun = ANONYMOUS_NOUNS[Math.floor(Math.random() * ANONYMOUS_NOUNS.length)];
  return `${adj} ${noun}`;
}

function generateRandomEmoji(): string {
  return ANONYMOUS_EMOJIS[Math.floor(Math.random() * ANONYMOUS_EMOJIS.length)];
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function getOrCreateUserProfile(): UserProfile {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Ensure all necessary fields exist
      if (parsed.id && parsed.secretKey && parsed.name && parsed.avatarEmoji) {
        if (!parsed.savedWhispers) parsed.savedWhispers = [];
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse user profile', e);
    }
  }

  // Create new profile
  const newProfile: UserProfile = {
    id: generateId(),
    secretKey: generateId() + '-' + Date.now(),
    name: generateRandomName(),
    avatarEmoji: generateRandomEmoji(),
    savedWhispers: [],
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
  return newProfile;
}

export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function regenerateProfileName(profile: UserProfile): UserProfile {
  const updated = {
    ...profile,
    name: generateRandomName(),
    avatarEmoji: generateRandomEmoji(),
  };
  saveUserProfile(updated);
  return updated;
}

export function toggleSaveWhisper(profile: UserProfile, whisperId: string): UserProfile {
  const saved = profile.savedWhispers || [];
  const index = saved.indexOf(whisperId);
  const updatedSaved = index === -1 
    ? [...saved, whisperId] 
    : saved.filter(id => id !== whisperId);
  
  const updated = {
    ...profile,
    savedWhispers: updatedSaved,
  };
  saveUserProfile(updated);
  return updated;
}
