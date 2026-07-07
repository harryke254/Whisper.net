import React, { useState } from 'react';
import { Smile } from 'lucide-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
  buttonClassName?: string;
}

export default function EmojiPicker({ onSelect, className = '', buttonClassName = '' }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const emojiCategories = [
    {
      title: 'Recent & Expressions',
      emojis: ['😀', '😂', '🤣', '😊', '😍', '😎', '😜', '🤫', '💀', '👽', '🤖', '👑', '👀', '👍', '👎', '🙌', '👏', '🔥']
    },
    {
      title: 'Cosmic & Signal',
      emojis: ['⚡', '✨', '🌟', '🌌', '🌙', '🌊', '💻', '🔒', '🔑', '📡', '💥', '🍀', '🍕', '🍺', '🎮', '🛸', '🎯', '💯']
    }
  ];

  return (
    <div className={`relative ${className}`}>
      <button
        id="emoji-picker-toggle-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-xl border border-white/10 bg-[#080808] hover:bg-white/5 text-white/60 hover:text-white transition-all cursor-pointer flex items-center justify-center ${buttonClassName}`}
        title="Insert Emoji"
      >
        <Smile size={14} />
      </button>

      {isOpen && (
        <>
          {/* Click outside to close */}
          <div 
            id="emoji-picker-backdrop"
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div 
            id="emoji-picker-dropdown"
            className="absolute bottom-full mb-2 right-0 z-50 w-64 bg-[#0a0a0a]/95 border border-white/10 rounded-2xl p-3 shadow-2xl backdrop-blur-md"
          >
            <div className="space-y-3">
              {emojiCategories.map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="text-[8px] font-mono uppercase tracking-widest text-white/30 select-none text-left">
                    {cat.title}
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {cat.emojis.map((emoji) => (
                      <button
                        id={`emoji-select-${emoji}`}
                        key={emoji}
                        type="button"
                        onClick={() => {
                          onSelect(emoji);
                          setIsOpen(false);
                        }}
                        className="p-1.5 hover:bg-white/5 rounded-lg text-sm transition-all hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
