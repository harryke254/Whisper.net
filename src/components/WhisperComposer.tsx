import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import EmojiPicker from './EmojiPicker';
import { 
  Send, 
  Sparkles, 
  Clock, 
  User, 
  UserX,
  Type,
  Palette,
  Eye,
  Info
} from 'lucide-react';
import { THEMES, FONTS, TAGS, UserProfile } from '../types';

interface WhisperComposerProps {
  userProfile: UserProfile;
  onPostWhisper: (
    content: string,
    themeId: string,
    fontId: string,
    tag: string,
    showName: boolean,
    selfDestruct: boolean
  ) => Promise<void>;
}

export default function WhisperComposer({ userProfile, onPostWhisper }: WhisperComposerProps) {
  const [content, setContent] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('slate');
  const [selectedFont, setSelectedFont] = useState('sans');
  const [selectedTag, setSelectedTag] = useState('#general');
  const [showName, setShowName] = useState(true);
  const [selfDestruct, setSelfDestruct] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const themePreset = THEMES.find((t) => t.id === selectedTheme) || THEMES[0];
  const fontPreset = FONTS.find((f) => f.id === selectedFont) || FONTS[0];

  const maxChars = 300;
  const charsLeft = maxChars - content.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    if (content.length > maxChars) {
      setError('Your whisper is a bit too long for the void. Please limit to 300 characters.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onPostWhisper(
        content.trim(),
        selectedTheme,
        selectedFont,
        selectedTag,
        showName,
        selfDestruct
      );
      setContent('');
      // Keep other presets for convenience, but maybe reset self-destruct
      setSelfDestruct(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to send your whisper. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-2xl mx-auto mb-10 rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-md shadow-2xl z-10"
    >
      <div className="flex items-center gap-2 mb-6">
        <Sparkles size={14} className="text-white/60 animate-pulse" />
        <h2 className="text-xs uppercase tracking-[0.2em] font-semibold text-white">Whisper into the Void</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Real-time styled card preview in composer! */}
        <div 
          className={`relative p-6 rounded-2xl border min-h-[180px] flex flex-col justify-between transition-all duration-500 overflow-hidden ${themePreset.class}`}
        >
          {/* Subtle starry canvas-like background effect in preview */}
          <div className="absolute inset-0 bg-radial-at-t from-white/5 to-transparent pointer-events-none" />

          {/* Preview Tag & Expiry Indicator */}
          <div className="flex items-start justify-between z-10 select-none">
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-white/10">
              {selectedTag}
            </span>
            {selfDestruct && (
              <div className="flex items-center gap-1 text-rose-300 bg-rose-950/40 px-2.5 py-0.5 rounded-full border border-rose-500/20 text-xs font-medium">
                <Clock size={11} className="animate-pulse" />
                <span>Expires in 24h</span>
              </div>
            )}
          </div>

          {/* Text Input area */}
          <div className="my-4 z-10 flex flex-col justify-center">
            <textarea
              id="whisper-text-input"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (error) setError(null);
              }}
              placeholder="What untold secret is weighing on your mind?"
              maxLength={maxChars}
              rows={4}
              className={`w-full bg-transparent border-0 resize-none text-center outline-none focus:ring-0 placeholder-white/30 text-slate-100 ${fontPreset.class} text-base md:text-lg focus:outline-none`}
              disabled={isSubmitting}
            />
          </div>

          {/* Preview Footer */}
          <div className="flex items-center justify-between border-t border-white/10 pt-3 z-10 text-xs opacity-80 select-none">
            <div className="flex items-center gap-1">
              <User size={12} />
              <span>{showName ? userProfile.name : 'Deeply Anonymous'}</span>
            </div>
            <div className="flex items-center gap-3">
              <EmojiPicker
                onSelect={(emoji) => {
                  setContent(prev => {
                    if (prev.length + emoji.length <= maxChars) {
                      return prev + emoji;
                    }
                    return prev;
                  });
                }}
                buttonClassName="h-7 w-7 rounded-lg border-white/10 bg-white/5 text-white/50 hover:text-white"
              />
              <div className={`font-mono text-xs ${charsLeft < 30 ? 'text-rose-300 font-semibold' : 'text-slate-400'}`}>
                {charsLeft} / {maxChars}
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 text-sm rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Left Column: Styles & Options */}
          <div className="space-y-6">
            {/* Tag selector */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold flex items-center gap-1">
                <span>Select Capsule / Tag</span>
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
                {TAGS.map((tag) => (
                  <button
                    id={`tag-select-${tag.replace('#', '')}`}
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={`px-3.5 py-1.5 text-[9px] uppercase tracking-wider rounded-full border transition-all duration-300 ${
                      selectedTag === tag
                        ? 'bg-white text-black border-white font-bold'
                        : 'bg-white/5 border-white/5 hover:border-white/15 text-white/50 hover:text-white'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Themes picker */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold flex items-center gap-1">
                <Palette size={11} className="text-white/30" />
                <span>Atmospheric Canvas</span>
              </label>
              <div className="flex items-center gap-2.5">
                {THEMES.map((theme) => (
                  <button
                    id={`theme-btn-${theme.id}`}
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`w-8 h-8 rounded-full border-2 transition-all duration-300 ${
                      selectedTheme === theme.id 
                        ? 'border-white scale-110 shadow-lg shadow-white/10' 
                        : 'border-transparent hover:scale-105'
                    } ${theme.class.split(' ')[0]}`} // extract bg class
                    title={theme.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Fonts & Security options */}
          <div className="space-y-6">
            {/* Font picker */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold flex items-center gap-1">
                <Type size={11} className="text-white/30" />
                <span>Typography</span>
              </label>
              <div className="flex gap-2">
                {FONTS.map((font) => (
                  <button
                    id={`font-btn-${font.id}`}
                    key={font.id}
                    type="button"
                    onClick={() => setSelectedFont(font.id)}
                    className={`flex-1 py-1.5 px-3 text-[9px] uppercase tracking-wider rounded-full border transition-all duration-300 ${
                      selectedFont === font.id
                        ? 'bg-white text-black border-white font-bold'
                        : 'bg-white/5 border-white/5 text-white/40 hover:text-white hover:border-white/15'
                    }`}
                  >
                    {font.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-3">
              {/* Alias Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {showName ? (
                    <User size={13} className="text-white/60" />
                  ) : (
                    <UserX size={13} className="text-white/30" />
                  )}
                  <div className="text-left">
                    <span className="block text-[11px] uppercase tracking-wider font-semibold text-white/80">Show Anonymous Pen Name</span>
                    <span className="block text-[9px] uppercase tracking-widest text-white/40">
                      {showName ? `As "${userProfile.name}"` : 'Deeply anonymous (No name)'}
                    </span>
                  </div>
                </div>
                <button
                  id="toggle-show-name"
                  type="button"
                  onClick={() => setShowName(!showName)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 focus:outline-none ${
                    showName ? 'bg-white' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full transition-transform duration-300 ${
                      showName ? 'translate-x-4 bg-black' : 'translate-x-0 bg-white'
                    }`}
                  />
                </button>
              </div>

              {/* Expiration Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={13} className={selfDestruct ? 'text-rose-400' : 'text-white/30'} />
                  <div className="text-left">
                    <span className="block text-[11px] uppercase tracking-wider font-semibold text-white/80">Self-Destruct in 24 Hours</span>
                    <span className="block text-[9px] uppercase tracking-widest text-white/40">Whisper disappears automatically</span>
                  </div>
                </div>
                <button
                  id="toggle-self-destruct"
                  type="button"
                  onClick={() => setSelfDestruct(!selfDestruct)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 focus:outline-none ${
                    selfDestruct ? 'bg-rose-500' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${
                      selfDestruct ? 'translate-x-4 bg-black' : 'translate-x-0 bg-white'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 flex justify-end">
          <button
            id="publish-whisper-btn"
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className="w-full md:w-auto px-8 py-3 bg-white hover:bg-transparent hover:text-white border border-white text-black text-[10px] uppercase tracking-[0.2em] font-bold rounded-full transition-all duration-300 disabled:opacity-30 shadow-lg shadow-white/5 active:scale-95 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                <span>Whispering...</span>
              </>
            ) : (
              <>
                <Send size={11} />
                <span>Whisper into the Void</span>
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
