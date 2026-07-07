import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  Send, 
  Lock, 
  Unlock, 
  Wifi, 
  User, 
  RefreshCw, 
  FileText, 
  Check, 
  X, 
  ArrowRight,
  Shield,
  HelpCircle,
  Eye,
  Key
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  where 
} from 'firebase/firestore';
import { UserProfile, Connection, Message, TerminalLog } from '../types';
import { encryptMessage, decryptMessage } from '../lib/encryption';
import { syncUserProfileToFirestore } from '../lib/user';

interface TerminalConsoleProps {
  userProfile: UserProfile;
  onChangeProfile: (profile: UserProfile) => void;
  onPostWhisper: (content: string, themeId: string, fontId: string, tag: string, showName: boolean, selfDestruct: boolean) => Promise<void>;
  rawWhispers: any[];
}

export default function TerminalConsole({
  userProfile,
  onChangeProfile,
  onPostWhisper,
  rawWhispers
}: TerminalConsoleProps) {
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [isBooting, setIsBooting] = useState(true);
  const [bootStep, setBootStep] = useState(0);
  const [activeChatPeer, setActiveChatPeer] = useState<string | null>(null);
  const [peerProfile, setPeerProfile] = useState<{name: string, emoji: string} | null>(null);
  
  // Real-time connections and messages
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);

  // Sync profile when console starts
  useEffect(() => {
    if (userProfile) {
      syncUserProfileToFirestore(userProfile);
    }
  }, [userProfile]);

  // Listen to connections
  useEffect(() => {
    if (!userProfile) return;
    const connectionsRef = collection(db, 'connections');
    
    // Query connections involving this user
    const unsubscribe1 = onSnapshot(connectionsRef, (snapshot) => {
      const list: Connection[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Connection;
        if (data.requesterId === userProfile.id || data.receiverId === userProfile.id) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setConnections(list);
    }, (error) => {
      addLog(`[SYSTEM_ERROR]: Connections listener failed: ${error.message}`, 'error');
    });

    return () => unsubscribe1();
  }, [userProfile?.id]);

  // Listen to messages of active chat
  useEffect(() => {
    if (!activeChatPeer || !userProfile) {
      setActiveMessages([]);
      setPeerProfile(null);
      return;
    }

    // Get peer details
    const peerDocRef = doc(db, 'users', activeChatPeer);
    getDoc(peerDocRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPeerProfile({ name: data.name || 'Unknown', emoji: data.avatarEmoji || '👤' });
      } else {
        setPeerProfile({ name: 'Unknown Node', emoji: '⚙️' });
      }
    });

    // Find connection ID
    const connection = connections.find(c => 
      (c.requesterId === userProfile.id && c.receiverId === activeChatPeer) ||
      (c.requesterId === activeChatPeer && c.receiverId === userProfile.id)
    );

    if (!connection || connection.status !== 'accepted') {
      setActiveMessages([]);
      return;
    }

    const messagesRef = collection(db, 'connections', connection.id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((docSnap) => {
        msgs.push({ id: docSnap.id, ...docSnap.data() } as Message);
      });
      setActiveMessages(msgs);
    }, (error) => {
      addLog(`[SYSTEM_ERROR]: Messages sync failure: ${error.message}`, 'error');
    });

    return () => unsubscribe();
  }, [activeChatPeer, connections, userProfile?.id]);

  // Auto scroll to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, isBooting, bootStep]);

  // Hacker startup boot sequence
  useEffect(() => {
    const bootLines = [
      { text: "⚡ INITIALIZING COLD NODE SYSTEM CLIENT...", delay: 200 },
      { text: "🔒 GENERATING LOCAL CRYPTOGRAPHIC KEYPAIR... SUCCESS", delay: 400 },
      { text: "🛰️ CONNECTING TO VOID RETRIEVAL RELAYS...", delay: 300 },
      { text: `📡 ACTIVE NODE ADDRESS: https://ais-pre-vg7jihlk4xzblfkejnemgh...`, delay: 500 },
      { text: "🌌 INTEGRITY SYNC: DECENTRALIZED STORAGE ONLINE", delay: 300 },
      { text: "💥 WELCOME TO THE WHISPER - POWERED BY ITCHYFINGERS", delay: 600 },
      { text: "🤖 Type 'help' for the complete directory of terminal commands.", delay: 200 }
    ];

    if (bootStep < bootLines.length) {
      const timer = setTimeout(() => {
        const type = bootStep === 5 ? 'success' : 'system';
        addLog(bootLines[bootStep].text, type);
        setBootStep(prev => prev + 1);
      }, bootLines[bootStep].delay);
      return () => clearTimeout(timer);
    } else {
      setIsBooting(false);
    }
  }, [bootStep]);

  const addLog = (text: string, type: 'input' | 'output' | 'system' | 'error' | 'success' = 'output') => {
    const newLog: TerminalLog = {
      id: Math.random().toString(36).substring(2, 9),
      text,
      type,
      timestamp: Date.now()
    };
    setLogs(prev => [...prev, newLog]);
  };

  // Command Parser
  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd) return;

    // Add to history
    commandHistoryRef.current.push(cmd);
    historyIndexRef.current = -1;

    // Print command input
    addLog(`root@whisper:~# ${cmd}`, 'input');
    setCommandInput('');

    const parts = cmd.split(' ');
    const primaryCmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (primaryCmd) {
      case 'help':
        addLog(`========================================================================`, 'system');
        addLog(`  AETHER SECURE COMMAND DIRECTORY - ZERO SURVEYING NETWORK`, 'success');
        addLog(`========================================================================`, 'system');
        addLog(`  help                         - Show this helper guide`, 'output');
        addLog(`  whoami                       - Display your Node Cryptographic signatures`, 'output');
        addLog(`  register [name]              - Re-register your anonymous pen name`, 'output');
        addLog(`  connect [userId]             - Send a friend connection request to a Node ID`, 'output');
        addLog(`  connections                  - List all active & pending peer connections`, 'output');
        addLog(`  accept [userId]              - Accept incoming peer connection request`, 'output');
        addLog(`  decline [userId]             - Terminate / decline connection with node`, 'output');
        addLog(`  chat [userId]                - Focus secure end-to-end chat room`, 'output');
        addLog(`  msg [text...]                - Transmit private encrypted text to focused node`, 'output');
        addLog(`  sendfile [filename] [text]   - Transmit custom encrypted file envelope`, 'output');
        addLog(`  whisper [content...]         - Broadcast a public whisper to the global void feed`, 'output');
        addLog(`  feed                         - Read global whispers directly from the CLI`, 'output');
        addLog(`  clear                        - Erase active logs buffer`, 'output');
        addLog(`========================================================================`, 'system');
        break;

      case 'whoami':
        addLog(`================ NODE SIGNATURES ================`, 'system');
        addLog(`  NODE PEN NAME  : ${userProfile.name} ${userProfile.avatarEmoji}`, 'output');
        addLog(`  SECURE NODE ID : ${userProfile.id}`, 'success');
        addLog(`  DEVICES-KEY    : ${userProfile.secretKey}`, 'output');
        addLog(`  STATUS         : SHIELD_SHREDDER_v4.2 (ACTIVE)`, 'output');
        addLog(`=================================================`, 'system');
        break;

      case 'register':
        if (args.length === 0) {
          addLog(`[ERROR]: Syntax: register [new_anonymous_name]`, 'error');
        } else {
          const newName = args.join(' ');
          const updated = { ...userProfile, name: newName };
          onChangeProfile(updated);
          await syncUserProfileToFirestore(updated);
          addLog(`[SUCCESS]: Local identity successfully registered as: ${newName}`, 'success');
        }
        break;

      case 'connect':
        if (args.length === 0) {
          addLog(`[ERROR]: Syntax: connect [target_user_id]`, 'error');
          break;
        }
        const targetId = args[0].trim();
        if (targetId === userProfile.id) {
          addLog(`[ERROR]: You cannot establish a loopback tunnel connection to yourself!`, 'error');
          break;
        }

        addLog(`[SYSTEM]: Querying node database for ID: ${targetId}...`, 'system');
        try {
          const targetDoc = await getDoc(doc(db, 'users', targetId));
          if (!targetDoc.exists()) {
            addLog(`[CONNECTION_FAILED]: Target secure node does not exist. Confirm target User ID is correct.`, 'error');
          } else {
            const peerData = targetDoc.data();
            const sortedIds = [userProfile.id, targetId].sort();
            const connectionId = sortedIds.join('_');

            await setDoc(doc(db, 'connections', connectionId), {
              id: connectionId,
              requesterId: userProfile.id,
              receiverId: targetId,
              status: 'pending',
              requesterName: userProfile.name,
              receiverName: peerData.name,
              requesterEmoji: userProfile.avatarEmoji,
              receiverEmoji: peerData.avatarEmoji || '👤',
              createdAt: Date.now()
            });

            addLog(`[REQUEST_SENT]: Cipher tunnel request dispatched to ${peerData.name} (${targetId}). Waiting for handshake...`, 'success');
          }
        } catch (err: any) {
          addLog(`[ERROR]: Network routing failure: ${err.message}`, 'error');
        }
        break;

      case 'connections':
        addLog(`================ CHANNELS ================`, 'system');
        if (connections.length === 0) {
          addLog(`  No established or pending connection tunnels.`, 'output');
        } else {
          connections.forEach(c => {
            const isRequester = c.requesterId === userProfile.id;
            const peerName = isRequester ? c.receiverName : c.requesterName;
            const peerEmoji = isRequester ? c.receiverEmoji : c.requesterEmoji;
            const peerId = isRequester ? c.receiverId : c.requesterId;
            
            let statusText = `[PENDING OUTGOING]`;
            if (c.status === 'accepted') {
              statusText = `[SECURED TUNNEL]`;
            } else if (!isRequester && c.status === 'pending') {
              statusText = `[PENDING INCOMING - Type 'accept ${peerId}']`;
            }

            addLog(`  ${peerEmoji} ${peerName} (${peerId}) - ${statusText}`, c.status === 'accepted' ? 'success' : 'system');
          });
        }
        addLog(`=========================================`, 'system');
        break;

      case 'accept':
        if (args.length === 0) {
          addLog(`[ERROR]: Syntax: accept [peer_user_id]`, 'error');
          break;
        }
        const requesterId = args[0].trim();
        const connToAccept = connections.find(c => c.requesterId === requesterId && c.receiverId === userProfile.id);
        
        if (!connToAccept) {
          addLog(`[ERROR]: No pending connection request found from Node ID: ${requesterId}`, 'error');
          break;
        }

        try {
          await updateDoc(doc(db, 'connections', connToAccept.id), {
            status: 'accepted'
          });
          addLog(`[SUCCESS]: Handshake completed! Secured cryptographic connection established.`, 'success');
          setActiveChatPeer(requesterId);
        } catch (err: any) {
          addLog(`[ERROR]: Failed to secure tunnel: ${err.message}`, 'error');
        }
        break;

      case 'decline':
        if (args.length === 0) {
          addLog(`[ERROR]: Syntax: decline [peer_user_id]`, 'error');
          break;
        }
        const declinePeerId = args[0].trim();
        const connToDecline = connections.find(c => 
          (c.requesterId === declinePeerId && c.receiverId === userProfile.id) ||
          (c.requesterId === userProfile.id && c.receiverId === declinePeerId)
        );

        if (!connToDecline) {
          addLog(`[ERROR]: No connection found with Node ID: ${declinePeerId}`, 'error');
          break;
        }

        try {
          await updateDoc(doc(db, 'connections', connToDecline.id), {
            status: 'declined'
          });
          addLog(`[SUCCESS]: Connection terminated.`, 'system');
          if (activeChatPeer === declinePeerId) {
            setActiveChatPeer(null);
          }
        } catch (err: any) {
          addLog(`[ERROR]: Termination failure: ${err.message}`, 'error');
        }
        break;

      case 'chat':
        if (args.length === 0) {
          addLog(`[ERROR]: Syntax: chat [peer_user_id]`, 'error');
          break;
        }
        const chatPeerId = args[0].trim();
        const isConnected = connections.some(c => 
          c.status === 'accepted' && 
          ((c.requesterId === userProfile.id && c.receiverId === chatPeerId) ||
           (c.requesterId === chatPeerId && c.receiverId === userProfile.id))
        );

        if (!isConnected) {
          addLog(`[ERROR]: Cannot focus chat. Establish secured tunnel connection first.`, 'error');
        } else {
          setActiveChatPeer(chatPeerId);
          addLog(`[CHAT_FOCUS]: Encryption channel aligned with Node ID: ${chatPeerId}. Start whispering securely.`, 'success');
        }
        break;

      case 'msg':
        if (args.length === 0) {
          addLog(`[ERROR]: Syntax: msg [text...]`, 'error');
          break;
        }
        if (!activeChatPeer) {
          addLog(`[ERROR]: No focused secure channel. Focus first using 'chat [peer_user_id]'`, 'error');
          break;
        }

        const msgText = args.join(' ');
        await sendDirectMessage(msgText, false, null);
        break;

      case 'sendfile':
        if (args.length < 2) {
          addLog(`[ERROR]: Syntax: sendfile [filename] [text_payload_content...]`, 'error');
          break;
        }
        if (!activeChatPeer) {
          addLog(`[ERROR]: No active chat channel. Focus first using 'chat [peer_user_id]'`, 'error');
          break;
        }

        const fileName = args[0];
        const fileContent = args.slice(1).join(' ');
        await sendDirectMessage(`Secure Payload File Transmitted: ${fileName}`, true, {
          fileName,
          fileType: 'text/plain',
          encryptedContent: fileContent,
          isSecured: true
        });
        break;

      case 'whisper':
        if (args.length === 0) {
          addLog(`[ERROR]: Syntax: whisper [content...]`, 'error');
        } else {
          const content = args.join(' ');
          try {
            await onPostWhisper(content, 'cosmic', 'mono', '#general', true, false);
            addLog(`[SUCCESS]: Broadcast posted securely to global feed void.`, 'success');
          } catch (err: any) {
            addLog(`[ERROR]: Broadcast failed: ${err.message}`, 'error');
          }
        }
        break;

      case 'feed':
        addLog(`=============== GLOBAL VOID STREAM ===============`, 'system');
        if (rawWhispers.length === 0) {
          addLog(`  Void is completely silent.`, 'output');
        } else {
          rawWhispers.slice(0, 5).forEach((w, index) => {
            addLog(`  [${index + 1}] tag: ${w.tag} | From: ${w.creatorName || 'Anonymous'}:`, 'system');
            addLog(`      "${w.content}"`, 'output');
          });
        }
        addLog(`===================================================`, 'system');
        break;

      case 'clear':
        setLogs([]);
        break;

      default:
        addLog(`[SYSTEM]: Command '${primaryCmd}' not recognized. Type 'help' for directory.`, 'error');
        break;
    }
  };

  const sendDirectMessage = async (content: string, isFile: boolean, fileObj: any) => {
    if (!activeChatPeer || !userProfile) return;

    const connection = connections.find(c => 
      (c.requesterId === userProfile.id && c.receiverId === activeChatPeer) ||
      (c.requesterId === activeChatPeer && c.receiverId === userProfile.id)
    );

    if (!connection) return;

    // Symmetric key is connection ID
    const cryptoKey = connection.id;
    const encryptedText = encryptMessage(content, cryptoKey);
    
    let filePayload = null;
    if (isFile && fileObj) {
      filePayload = {
        fileName: fileObj.fileName,
        fileType: fileObj.fileType,
        encryptedContent: encryptMessage(fileObj.encryptedContent, cryptoKey),
        isSecured: true
      };
    }

    try {
      const messagesRef = collection(db, 'connections', connection.id, 'messages');
      await addDoc(messagesRef, {
        id: Math.random().toString(36).substring(2, 9),
        chatId: connection.id,
        senderId: userProfile.id,
        receiverId: activeChatPeer,
        content: encryptedText,
        isEncrypted: true,
        encryptionKeyHint: 'AES-E2EE-SYM',
        createdAt: Date.now(),
        ...(filePayload && { filePayload })
      });

      addLog(`[TUNNEL_TRANSMISSION]: Payload packets successfully serialized and transmitted.`, 'success');
    } catch (err: any) {
      addLog(`[ERROR]: Packet drop: ${err.message}`, 'error');
    }
  };

  // Helper decrypt to read safely in UI
  const getDecryptedText = (encrypted: string) => {
    if (!activeChatPeer) return '';
    const connection = connections.find(c => 
      (c.requesterId === userProfile.id && c.receiverId === activeChatPeer) ||
      (c.requesterId === activeChatPeer && c.receiverId === userProfile.id)
    );
    if (!connection) return encrypted;
    return decryptMessage(encrypted, connection.id);
  };

  return (
    <div className="w-full bg-[#050505] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[750px] relative">
      {/* Glow overlays */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/50 via-teal-500/50 to-indigo-500/50"></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none opacity-40 z-10"></div>
      
      {/* Console Header */}
      <div className="p-4 bg-black/80 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-emerald-400">Void Core Command Shell v4.02</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            <span className="text-[8px] uppercase tracking-widest text-white/60 font-mono">ENCRYPTED TUNNEL ACTIVE</span>
          </div>
          <span className="text-[9px] font-mono text-white/40 uppercase">Node: {userProfile.id.slice(0,8)}...</span>
        </div>
      </div>

      {/* Main Terminal Area */}
      <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10 overflow-hidden">
        
        {/* Terminal Logs View */}
        <div className="flex-1 flex flex-col bg-black/40 p-4 font-mono text-xs overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
          <div className="flex-1 space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="whitespace-pre-wrap leading-relaxed">
                {log.type === 'input' && (
                  <div className="text-white/40 flex items-start gap-1">
                    <span className="text-emerald-400 select-none">&gt;</span>
                    <span className="text-emerald-300">{log.text}</span>
                  </div>
                )}
                {log.type === 'output' && <div className="text-white/80 pl-4">{log.text}</div>}
                {log.type === 'system' && <div className="text-indigo-400 font-bold">{log.text}</div>}
                {log.type === 'error' && <div className="text-red-400 font-semibold bg-red-950/20 px-2 py-1 rounded border border-red-900/20">{log.text}</div>}
                {log.type === 'success' && <div className="text-emerald-400 font-semibold">{log.text}</div>}
              </div>
            ))}
            
            {/* Real-time active chat message UI if chat is focused */}
            {activeChatPeer && peerProfile && (
              <div className="mt-6 border-t border-white/10 pt-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400">
                      SECURED END-TO-END CHAT CHANNEL WITH {peerProfile.emoji} {peerProfile.name}
                    </span>
                  </div>
                  <button 
                    onClick={() => setActiveChatPeer(null)}
                    className="text-[9px] uppercase tracking-widest text-white/40 hover:text-white flex items-center gap-1 border border-white/10 px-2 py-0.5 rounded hover:bg-white/5 transition-all"
                  >
                    Close Tunnel
                  </button>
                </div>

                {activeMessages.length === 0 ? (
                  <div className="text-center py-6 text-white/30 border border-dashed border-white/5 rounded-2xl">
                    No packets transmitted inside this channel. Type a message below to start communicating securely.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
                    {activeMessages.map((msg) => {
                      const isMe = msg.senderId === userProfile.id;
                      const decryptedContent = getDecryptedText(msg.content);
                      
                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`p-3 rounded-2xl max-w-[85%] border ${
                            isMe 
                              ? 'bg-white/5 border-white/10 text-white' 
                              : 'bg-emerald-950/10 border-emerald-500/20 text-emerald-200'
                          }`}>
                            <div className="flex items-center justify-between gap-4 mb-1 text-[8px] uppercase tracking-widest text-white/30">
                              <span>{isMe ? 'YOU (SECURE NODE)' : peerProfile.name}</span>
                              <span className="flex items-center gap-1">
                                <Lock size={8} /> E2EE
                              </span>
                            </div>
                            
                            {msg.filePayload ? (
                              <div className="space-y-2 mt-1">
                                <div className="flex items-center gap-2 bg-black/40 p-2.5 rounded-xl border border-white/5">
                                  <FileText className="w-4 h-4 text-emerald-400" />
                                  <div className="text-left">
                                    <div className="text-[10px] font-bold text-white tracking-wide">{msg.filePayload.fileName}</div>
                                    <div className="text-[8px] text-white/40 uppercase tracking-widest">Encrypted Document Container</div>
                                  </div>
                                </div>
                                <div className="bg-black/60 p-2.5 rounded-xl text-[10px] text-emerald-400 border border-white/5 text-left font-mono break-all max-h-[80px] overflow-y-auto">
                                  <div className="text-[8px] text-white/40 uppercase mb-1">DECRYPTED PAYLOAD CONTENT:</div>
                                  {decryptMessage(msg.filePayload.encryptedContent, msg.chatId)}
                                </div>
                              </div>
                            ) : (
                              <div className="text-left text-xs break-all leading-relaxed">{decryptedContent}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            
            <div ref={terminalEndRef} />
          </div>

          {/* Interactive Command Prompt */}
          <form onSubmit={handleCommandSubmit} className="mt-4 border-t border-white/10 pt-3 flex items-center gap-2">
            <span className="text-emerald-400 font-bold select-none shrink-0">root@whisper:~#</span>
            <input
              id="terminal-input-command"
              type="text"
              className="flex-1 bg-transparent border-none text-emerald-300 placeholder-emerald-800 focus:outline-none focus:ring-0 font-mono text-xs"
              placeholder={activeChatPeer ? "Type command or secure msg... (e.g. msg Hey!)" : "Type command... (e.g. help, register, connect)"}
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              disabled={isBooting}
              autoFocus
              autoComplete="off"
            />
            <button
              id="terminal-send-btn"
              type="submit"
              disabled={isBooting || !commandInput.trim()}
              className="p-1 rounded text-emerald-400 hover:bg-white/5 disabled:opacity-30 transition-colors"
            >
              <Send size={14} />
            </button>
          </form>
        </div>

        {/* GUI Connection Panel (Improves usability immensely) */}
        <div className="w-full md:w-64 bg-black/20 p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-white/60" />
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/70">SECURE CHANNELS</h3>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-white/10">
            {connections.length === 0 ? (
              <div className="text-center py-8 text-[10px] uppercase tracking-wider text-white/30 border border-dashed border-white/5 rounded-2xl px-2">
                No active tunnels. Share Node ID to connect.
              </div>
            ) : (
              connections.map((c) => {
                const isRequester = c.requesterId === userProfile.id;
                const peerName = isRequester ? c.receiverName : c.requesterName;
                const peerEmoji = isRequester ? c.receiverEmoji : c.requesterEmoji;
                const peerId = isRequester ? c.receiverId : c.requesterId;
                const isSelected = activeChatPeer === peerId;

                return (
                  <div 
                    key={c.id} 
                    className={`p-3 rounded-2xl border transition-all duration-300 text-left ${
                      isSelected 
                        ? 'bg-white/10 border-white/30' 
                        : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base select-none">{peerEmoji}</span>
                        <div className="text-left leading-tight">
                          <div className="text-xs font-bold text-white tracking-wide">{peerName}</div>
                          <div className="text-[8px] font-mono text-white/40">{peerId.slice(0, 8)}...</div>
                        </div>
                      </div>
                      
                      {c.status === 'accepted' ? (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                      ) : !isRequester && c.status === 'pending' ? (
                        <span className="text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">RECV</span>
                      ) : (
                        <span className="text-[8px] font-bold bg-white/5 text-white/40 border border-white/10 px-1.5 py-0.5 rounded uppercase tracking-wider">PEND</span>
                      )}
                    </div>

                    <div className="flex gap-2 mt-2">
                      {c.status === 'accepted' ? (
                        <>
                          <button
                            id={`btn-chat-with-${peerId}`}
                            onClick={() => {
                              setActiveChatPeer(peerId);
                              addLog(`root@whisper:~# chat ${peerId}`, 'input');
                              addLog(`[CHAT_FOCUS]: Secured E2EE channel aligned with node: ${peerId}.`, 'success');
                            }}
                            className="flex-1 py-1 rounded-lg border border-white/20 text-[9px] text-white uppercase tracking-wider hover:bg-white hover:text-black transition-all"
                          >
                            OPEN CHAT
                          </button>
                        </>
                      ) : !isRequester && c.status === 'pending' ? (
                        <>
                          <button
                            id={`btn-accept-${peerId}`}
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'connections', c.id), { status: 'accepted' });
                                addLog(`[SUCCESS]: Tunnel connection from ${peerName} accepted!`, 'success');
                                setActiveChatPeer(peerId);
                              } catch (e: any) {
                                addLog(`[ERROR]: Acceptance failed: ${e.message}`, 'error');
                              }
                            }}
                            className="flex-1 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] uppercase tracking-wider hover:bg-emerald-500 hover:text-black transition-all"
                          >
                            ACCEPT
                          </button>
                          <button
                            id={`btn-decline-${peerId}`}
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'connections', c.id), { status: 'declined' });
                                addLog(`[SYSTEM]: Declined connection request from ${peerName}.`, 'system');
                              } catch (e: any) {
                                addLog(`[ERROR]: Decline failed: ${e.message}`, 'error');
                              }
                            }}
                            className="p-1 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-black transition-all"
                          >
                            <X size={10} />
                          </button>
                        </>
                      ) : (
                        <div className="text-[8px] text-white/40 tracking-widest uppercase">TUNNEL PENDING...</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Node Details / ID Share */}
          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl text-left text-[10px] font-mono">
            <div className="text-[8px] text-white/40 uppercase tracking-widest mb-1.5 font-bold">MY TUNNEL ACCESS KEY</div>
            <div className="flex items-center justify-between gap-2 bg-black/40 p-2 rounded-xl border border-white/5">
              <span className="text-white/80 select-all truncate">{userProfile.id}</span>
              <button
                id="btn-copy-node-id"
                onClick={() => {
                  navigator.clipboard.writeText(userProfile.id);
                  addLog(`[SYSTEM]: Local node signature copied to clipboard. Share with friends to connect untracked!`, 'success');
                }}
                className="p-1 hover:bg-white/5 rounded text-white/60 hover:text-white transition-colors"
                title="Copy Node Access ID"
              >
                <FileText size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
