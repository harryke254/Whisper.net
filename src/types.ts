export interface Whisper {
  id: string;
  content: string;
  createdAt: number; // UTC timestamp
  creatorId: string; // Anonymous device/profile ID
  creatorName: string; // E.g., "Midnight Dreamer"
  showName: boolean; // Whether to display the anonymous name or hide it completely
  background: string; // Preset theme ID (e.g., 'cosmic', 'sunset', 'emerald')
  font: string; // Font identifier (e.g., 'sans', 'serif', 'mono', 'cursive')
  tag: string; // E.g., '#confession', '#secret', '#dream'
  likes: string[]; // List of creatorIds who liked this
  reports: string[]; // List of creatorIds who reported this
  expiresAt: number | null; // Self-destruction timestamp, or null
  commentsCount: number;
}

export interface Comment {
  id: string;
  whisperId: string;
  content: string;
  createdAt: number;
  creatorId: string;
  creatorName: string;
  showName: boolean;
  background: string; // Color preset for comment bubble
}

export interface UserProfile {
  id: string;
  secretKey: string; // Secret generated client-side for ownership proof
  name: string; // Generated anonymous name
  avatarEmoji: string; // Fun emoji avatar
  savedWhispers: string[]; // List of whisper IDs saved locally
}

export interface Connection {
  id: string;
  requesterId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined';
  requesterName: string;
  receiverName: string;
  requesterEmoji: string;
  receiverEmoji: string;
  createdAt: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  content: string;
  isEncrypted: boolean;
  encryptionKeyHint?: string;
  createdAt: number;
  filePayload?: {
    fileName: string;
    fileType: string;
    encryptedContent: string;
    isSecured: boolean;
  };
  deliveryMetadata?: {
    senderIp?: string;
    senderCity?: string;
    senderRegion?: string;
    senderCountry?: string;
    senderLat?: number;
    senderLon?: number;
    senderIsp?: string;
    senderNetworkType?: string;
    senderDownlink?: number;
    senderRtt?: number;
    highPrecision?: boolean;
    userAgent?: string;
  };
}

export interface TerminalLog {
  id: string;
  text: string;
  type: 'input' | 'output' | 'system' | 'error' | 'success';
  timestamp: number;
}

export interface ThemePreset {
  id: string;
  name: string;
  class: string; // Tailwind classes for gradient and text
  iconClass?: string;
}

export const FONTS = [
  { id: 'sans', name: 'Clean Sans', class: 'font-sans' },
  { id: 'serif', name: 'Elegant Serif', class: 'font-serif font-semibold italic' },
  { id: 'mono', name: 'Retro Mono', class: 'font-mono tracking-tight text-[15px]' },
];

export const THEMES: ThemePreset[] = [
  {
    id: 'slate',
    name: 'Quiet Slate',
    class: 'bg-white/5 border-white/10 text-white/90 shadow-sm hover:border-white/20 hover:bg-white/[0.07]',
  },
  {
    id: 'cosmic',
    name: 'Cosmic Obsidian',
    class: 'bg-white/[0.02] border-white/5 text-white/80 hover:border-white/10 hover:bg-white/[0.04]',
  },
  {
    id: 'sunset',
    name: 'Velvet Darkness',
    class: 'bg-white/[0.08] border-white/10 text-white hover:border-white/20 hover:bg-white/[0.11]',
  },
  {
    id: 'emerald',
    name: 'Obsidian Emerald',
    class: 'bg-emerald-950/10 border-emerald-500/10 text-emerald-100/90 hover:border-emerald-500/20 hover:bg-emerald-950/20',
  },
  {
    id: 'ocean',
    name: 'Deep Blue Void',
    class: 'bg-blue-950/10 border-blue-500/10 text-blue-100/90 hover:border-blue-500/20 hover:bg-blue-950/20',
  },
  {
    id: 'crimson',
    name: 'Noir Crimson',
    class: 'bg-rose-950/10 border-rose-500/10 text-rose-100/90 hover:border-rose-500/20 hover:bg-rose-950/20',
  },
];

export const TAGS = [
  '#general',
  '#secret',
  '#confession',
  '#dream',
  '#hope',
  '#regret',
  '#thought',
  '#unsaid',
];

export const ANONYMOUS_ADJECTIVES = [
  'Midnight', 'Silent', 'Golden', 'Echoing', 'Velvet', 'Shadow', 'Crimson', 'Astral',
  'Stardust', 'Lost', 'Quiet', 'Dreamy', 'Hidden', 'Misty', 'Neon', 'Cosmic', 'Solar',
  'Ancient', 'Whispering', 'Humble', 'Serene', 'Drifting', 'Forgotten', 'Indigo', 'Luminous'
];

export const ANONYMOUS_NOUNS = [
  'Dreamer', 'Seeker', 'Echo', 'Shadow', 'Wanderer', 'Star', 'Willow', 'Sailor', 'Gazer',
  'Soul', 'Memory', 'Ghost', 'breeze', 'Petal', 'Flame', 'River', 'Forest', 'Voyager',
  'Pathfinder', 'Cloud', 'Mirror', 'Tide', 'Spire', 'Harbor', 'Stargazer', 'Chronicle'
];

export const ANONYMOUS_EMOJIS = [
  '✨', '🌙', '🌌', '🪐', '☄️', '🔮', '🕯️', '🥀', '🌊', '🍁', '👁️', '☁️', '🕊️', '🦊', '🦉', '🐾'
];
