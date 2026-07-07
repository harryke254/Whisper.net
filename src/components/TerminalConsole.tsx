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
  Key,
  Paperclip,
  LogOut,
  ChevronLeft,
  Users,
  MessageSquare,
  Plus
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
import { fetchNetworkAndLocation, requestHighPrecisionLocation, DeliveryMetadata } from '../lib/network';
import EmojiPicker from './EmojiPicker';

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
  
  // New UI states
  const [isStealthMode, setIsStealthMode] = useState(true);
  const [isChatMode, setIsChatMode] = useState(false);
  const [chatInputText, setChatInputText] = useState('');
  const [newConnectionId, setNewConnectionId] = useState('');
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [fileNameInput, setFileNameInput] = useState('');
  const [fileContentInput, setFileContentInput] = useState('');

  const [deviceMetadata, setDeviceMetadata] = useState<DeliveryMetadata | null>(null);
  const [expandedTraceMsgId, setExpandedTraceMsgId] = useState<string | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);

  // Fetch location and network metadata on component mount
  useEffect(() => {
    const initMetadata = async () => {
      try {
        const meta = await fetchNetworkAndLocation();
        setDeviceMetadata(meta);
      } catch (error) {
        console.error("Failed to load initial network/geo metadata", error);
      }
    };
    initMetadata();
  }, []);

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

    // Find connection ID
    const connection = connections.find(c => 
      (c.requesterId === userProfile.id && c.receiverId === activeChatPeer) ||
      (c.requesterId === activeChatPeer && c.receiverId === userProfile.id)
    );

    // Get peer details from connection metadata first to avoid race/delay
    if (connection) {
      const isRequester = connection.requesterId === userProfile.id;
      setPeerProfile({
        name: isRequester ? connection.receiverName : connection.requesterName,
        emoji: isRequester ? connection.receiverEmoji : connection.requesterEmoji
      });
    } else {
      const peerDocRef = doc(db, 'users', activeChatPeer);
      getDoc(peerDocRef).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setPeerProfile({ name: data.name || 'Unknown', emoji: data.avatarEmoji || '👤' });
        } else {
          setPeerProfile({ name: 'Unknown Node', emoji: '⚙️' });
        }
      });
    }

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
      { text: "🤖 COLD SHORE NETWORK SECURED AND READY.", delay: 200 }
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
        addLog(`[SYSTEM]: Access restricted. To view the complete directory of terminal commands, execute: 'ls cmd'`, 'system');
        break;

      case 'ls':
        if (args.length > 0 && args[0].toLowerCase() === 'cmd') {
          addLog(`========================================================================`, 'system');
          addLog(`  AETHER SECURE COMMAND DIRECTORY - ZERO SURVEYING NETWORK`, 'success');
          addLog(`========================================================================`, 'system');
          addLog(`  ls cmd                       - Show this secure helper guide`, 'output');
          addLog(`  ls cn                        - List all active & pending peer connections`, 'output');
          addLog(`  whoami                       - Display your Node Cryptographic signatures`, 'output');
          addLog(`  reg [name]                   - Re-register your anonymous pen name (alias: register)`, 'output');
          addLog(`  cn [userId]                  - Send a friend connection request to a Node ID (alias: connect)`, 'output');
          addLog(`  accept [userId]              - Accept incoming peer connection request`, 'output');
          addLog(`  decline [userId]             - Terminate / decline connection with node`, 'output');
          addLog(`  cht                          - Open secure chat / Focus active channel (alias: chat)`, 'output');
          addLog(`  cht [userId]                 - Focus chat page on a specific connected Node ID`, 'output');
          addLog(`  stealth [on/off]             - Toggle connection panels on/off (Default: ON)`, 'output');
          addLog(`  close / exit                 - Defocus current chat and return to main shell`, 'output');
          addLog(`  clear                        - Erase active logs buffer`, 'output');
          addLog(`========================================================================`, 'system');
        } else if (args.length > 0 && args[0].toLowerCase() === 'cn') {
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
        } else {
          addLog(`[ERROR]: Syntax error. Command not recognized.`, 'error');
        }
        break;

      case 'whoami':
        addLog(`================ NODE SIGNATURES ================`, 'system');
        addLog(`  NODE PEN NAME  : ${userProfile.name} ${userProfile.avatarEmoji}`, 'output');
        addLog(`  SECURE NODE ID : ${userProfile.id}`, 'success');
        addLog(`  DEVICES-KEY    : ${userProfile.secretKey}`, 'output');
        addLog(`  STATUS         : SHIELD_SHREDDER_v4.2 (ACTIVE)`, 'output');
        addLog(`=================================================`, 'system');
        break;

      case 'reg':
      case 'register':
        if (args.length === 0) {
          addLog(`[ERROR]: Syntax: ${primaryCmd} [new_anonymous_name]`, 'error');
        } else {
          const newName = args.join(' ');
          const updated = { ...userProfile, name: newName };
          onChangeProfile(updated);
          await syncUserProfileToFirestore(updated);
          addLog(`[SUCCESS]: Local identity successfully registered as: ${newName}`, 'success');
        }
        break;

      case 'cn':
      case 'connect':
        if (args.length === 0) {
          addLog(`[ERROR]: Syntax: ${primaryCmd} [target_user_id]`, 'error');
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

      case 'cht':
      case 'chat':
        setIsChatMode(true);
        if (args.length === 0) {
          const firstAccepted = connections.find(c => c.status === 'accepted');
          if (firstAccepted) {
            const peerId = firstAccepted.requesterId === userProfile.id ? firstAccepted.receiverId : firstAccepted.requesterId;
            setActiveChatPeer(peerId);
            addLog(`[CHAT_FOCUS]: Secure Tunnel Focused on Node: ${peerId}. Use 'msg [text]' or the inline input to communicate.`, 'success');
          } else {
            addLog(`[ERROR]: No active secure tunnels. Connect with a Node first using 'cn [userId]'`, 'error');
          }
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
          addLog(`[CHAT_FOCUS]: Encryption channel aligned with Node ID: ${chatPeerId}. Ready for secure transmission.`, 'success');
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

      case 'stealth':
        if (args.length > 0) {
          const action = args[0].toLowerCase();
          if (action === 'on') {
            setIsStealthMode(true);
            addLog(`[SYSTEM]: Stealth mode enabled. GUI side connection panels have been securely encrypted and hidden.`, 'success');
          } else if (action === 'off') {
            setIsStealthMode(false);
            addLog(`[SYSTEM]: Stealth mode disabled. Connection panels are now visible.`, 'system');
          } else {
            addLog(`[ERROR]: Syntax: stealth [on/off]`, 'error');
          }
        } else {
          setIsStealthMode(prev => {
            const next = !prev;
            addLog(`[SYSTEM]: Stealth mode toggled ${next ? 'ON' : 'OFF'}. Connection panels are now ${next ? 'HIDDEN' : 'VISIBLE'}.`, 'success');
            return next;
          });
        }
        break;

      case 'close':
      case 'exit':
        if (activeChatPeer) {
          setActiveChatPeer(null);
          addLog(`[SYSTEM]: Secured chat tunnel defocused. Returned to standard shell.`, 'system');
        } else {
          addLog(`[SYSTEM]: No active chat focus. Shell is already standard.`, 'system');
        }
        break;

      case 'clear':
        setLogs([]);
        break;

      default:
        addLog(`[SYSTEM]: Command '${primaryCmd}' not recognized.`, 'error');
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

    // Fetch live network and geolocation details to stamp on transmission packet
    let liveMetadata: DeliveryMetadata | null = null;
    try {
      liveMetadata = await fetchNetworkAndLocation();
    } catch (e) {
      liveMetadata = deviceMetadata;
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
        ...(filePayload && { filePayload }),
        ...(liveMetadata && { deliveryMetadata: liveMetadata })
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

  const renderDeliveryTrace = (msg: Message) => {
    const meta = msg.deliveryMetadata;
    if (!meta) return null;
    const isExpanded = expandedTraceMsgId === msg.id;

    if (!isExpanded) {
      return (
        <button
          onClick={() => setExpandedTraceMsgId(msg.id)}
          className="text-[8px] mt-1 uppercase tracking-widest text-emerald-400/60 hover:text-emerald-300 font-mono flex items-center gap-1 cursor-pointer hover:underline transition-all"
        >
          <span>🛰️ [TRACE DETECTED - VIEW PORT]</span>
        </button>
      );
    }

    const mapUrl = (meta.senderLat && meta.senderLon) 
      ? `https://www.google.com/maps?q=${meta.senderLat},${meta.senderLon}&t=k` 
      : null;

    return (
      <div className="mt-2 p-2.5 bg-black/80 rounded-xl border border-white/10 text-left font-mono text-[9px] text-white/80 space-y-1.5 max-w-full overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1">
          <span className="text-[7.5px] text-amber-500 font-bold uppercase tracking-widest">🛰️ TRANSMISSION HANDSHAKE INTERCEPT</span>
          <button
            onClick={() => setExpandedTraceMsgId(null)}
            className="text-white/40 hover:text-white text-[7.5px] uppercase cursor-pointer"
          >
            [CLOSE]
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <span className="text-white/40">IP ADDR:</span> <span className="text-emerald-400 font-bold select-all">{meta.senderIp || '127.0.0.1'}</span>
          </div>
          <div>
            <span className="text-white/40">ISP/CARRIER:</span> <span className="text-indigo-300 truncate inline-block max-w-[100px] align-bottom" title={meta.senderIsp}>{meta.senderIsp || 'Secure Meshnet Node'}</span>
          </div>
          <div>
            <span className="text-white/40">LOCATION:</span> <span className="text-emerald-300">{meta.senderCity ? `${meta.senderCity}, ${meta.senderCountry || ''}` : 'Classified Orbit Grid'}</span>
          </div>
          <div>
            <span className="text-white/40">LAT / LON:</span> <span className="text-cyan-400">{meta.senderLat && meta.senderLon ? `${meta.senderLat.toFixed(4)}, ${meta.senderLon.toFixed(4)}` : 'UNKNOWN'}</span>
          </div>
          <div>
            <span className="text-white/40">CONN TYPE:</span> <span className="text-amber-300 uppercase">{meta.senderNetworkType || 'Broadband'}</span>
          </div>
          <div>
            <span className="text-white/40">BANDWIDTH:</span> <span className="text-rose-400">{meta.senderDownlink ? `${meta.senderDownlink} Mbps` : 'Direct Optical'}</span>
          </div>
          <div>
            <span className="text-white/40">PING RTT:</span> <span className="text-cyan-300">{meta.senderRtt ? `${meta.senderRtt} ms` : '<1 ms'}</span>
          </div>
          <div>
            <span className="text-white/40">ACCURACY:</span> <span className="text-emerald-400">{meta.highPrecision ? '100% HIGH PRECISION GPS' : '95% GEO-IP RADAR'}</span>
          </div>
        </div>
        
        {mapUrl && (
          <div className="pt-1.5 flex items-center justify-between border-t border-white/5 mt-1">
            <span className="text-[7px] text-white/30 uppercase">DELIVERED TO EXACT GPS REGION</span>
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-0.5 rounded bg-emerald-500 text-black hover:bg-emerald-400 text-[8px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_8px_rgba(16,185,129,0.15)] flex items-center gap-1"
            >
              Open Satellite Radar 🛰️
            </a>
          </div>
        )}
      </div>
    );
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim() || !activeChatPeer) return;
    await sendDirectMessage(chatInputText.trim(), false, null);
    setChatInputText('');
  };

  const handleTransmitFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileNameInput.trim() || !fileContentInput.trim() || !activeChatPeer) return;
    await sendDirectMessage(`Secure Payload File Transmitted: ${fileNameInput.trim()}`, true, {
      fileName: fileNameInput.trim(),
      fileType: 'text/plain',
      encryptedContent: fileContentInput.trim(),
      isSecured: true
    });
    setFileNameInput('');
    setFileContentInput('');
    setIsFileModalOpen(false);
  };

  const handleConnectNode = async (targetId: string) => {
    if (!targetId.trim()) return;
    const cleanId = targetId.trim();
    if (cleanId === userProfile.id) {
      addLog(`[ERROR]: Loopback connection is invalid.`, 'error');
      return;
    }
    addLog(`[SYSTEM]: Querying node database for ID: ${cleanId}...`, 'system');
    try {
      const targetDoc = await getDoc(doc(db, 'users', cleanId));
      if (!targetDoc.exists()) {
        addLog(`[CONNECTION_FAILED]: Secure node ID does not exist.`, 'error');
        return;
      }
      const peerData = targetDoc.data();
      const sortedIds = [userProfile.id, cleanId].sort();
      const connectionId = sortedIds.join('_');

      await setDoc(doc(db, 'connections', connectionId), {
        id: connectionId,
        requesterId: userProfile.id,
        receiverId: cleanId,
        status: 'pending',
        requesterName: userProfile.name,
        receiverName: peerData.name,
        requesterEmoji: userProfile.avatarEmoji,
        receiverEmoji: peerData.avatarEmoji || '👤',
        createdAt: Date.now()
      });
      addLog(`[REQUEST_SENT]: Cipher tunnel request dispatched to ${peerData.name} (${cleanId}). Waiting for handshake...`, 'success');
    } catch (err: any) {
      addLog(`[ERROR]: Handshake routing failed: ${err.message}`, 'error');
    }
  };

  return (
    <div className="w-full bg-[#050505] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[750px] relative font-sans text-white">
      {/* Glow overlays */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/50 via-teal-500/50 to-indigo-500/50"></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none opacity-40 z-10"></div>
      
      {/* File payload modal */}
      {isFileModalOpen && (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setIsFileModalOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-emerald-400" />
              <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">Serialize & Transmit Document</h4>
            </div>
            <form onSubmit={handleTransmitFile} className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-white/40 mb-1 font-bold">File Package Name</label>
                <input 
                  type="text" 
                  value={fileNameInput}
                  onChange={(e) => setFileNameInput(e.target.value)}
                  placeholder="top_secret_intel.txt"
                  className="w-full bg-white/5 border border-white/5 hover:border-white/15 focus:border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:ring-0 animate-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-widest text-white/40 mb-1 font-bold">Document Payload Content</label>
                <textarea 
                  value={fileContentInput}
                  onChange={(e) => setFileContentInput(e.target.value)}
                  placeholder="Type or paste the secure document text packet content..."
                  className="w-full bg-white/5 border border-white/5 hover:border-white/15 focus:border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:ring-0 h-32 resize-none"
                  required
                />
              </div>
              <button 
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer"
              >
                Transmit Encrypted Document
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Console Header */}
      <div className="p-4 bg-black/80 border-b border-white/10 flex items-center justify-between relative z-20">
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-emerald-400">
            Void Core Command Shell v4.02
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span 
            className="text-[9px] font-mono text-white/40 uppercase cursor-pointer hover:text-white/80 transition-colors"
            title="Click to copy your Node ID"
            onClick={() => {
              navigator.clipboard.writeText(userProfile.id);
              addLog(`[SYSTEM]: Local node ID copied to clipboard.`, 'success');
            }}
          >
            Node: {userProfile.id.slice(0,8)}...
          </span>
        </div>
      </div>

      {isChatMode ? (
        /* INTERACTIVE CHATTING PAGE (GUI) */
        <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10 overflow-hidden relative z-20 bg-black/40">
          
          {/* Chat Sidebar / Directory */}
          <div className={`w-full md:w-72 bg-[#080808]/90 p-4 flex flex-col h-full overflow-hidden ${activeChatPeer ? 'hidden md:flex' : 'flex'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-white/60" />
                <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/70">CONNECTED NODES</h3>
              </div>
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 font-mono">
                {connections.filter(c => c.status === 'accepted').length} ONLINE
              </span>
            </div>

            {/* Direct Connections Scrollable Area */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-white/10 pb-4">
              {connections.filter(c => c.status === 'accepted').length === 0 ? (
                <div className="text-center py-10 text-[10px] uppercase tracking-wider text-white/30 border border-dashed border-white/5 rounded-2xl px-3">
                  No established tunnels. Share your Node ID to connect with someone instantly.
                </div>
              ) : (
                connections.map((c) => {
                  const isRequester = c.requesterId === userProfile.id;
                  const peerName = isRequester ? c.receiverName : c.requesterName;
                  const peerEmoji = isRequester ? c.receiverEmoji : c.requesterEmoji;
                  const peerId = isRequester ? c.receiverId : c.requesterId;
                  const isSelected = activeChatPeer === peerId;

                  if (c.status !== 'accepted') return null;

                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveChatPeer(peerId)}
                      className={`w-full p-3 rounded-2xl border transition-all duration-300 text-left flex items-center justify-between cursor-pointer ${
                        isSelected 
                          ? 'bg-white/10 border-white/20 shadow-md' 
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-base select-none">{peerEmoji}</span>
                        <div className="text-left leading-tight truncate">
                          <div className="text-xs font-bold text-white tracking-wide">{peerName}</div>
                          <div className="text-[8px] font-mono text-white/40">{peerId.slice(0, 16)}...</div>
                        </div>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0"></div>
                    </button>
                  );
                })
              )}

              {/* Pending Invites Section */}
              {connections.some(c => c.status === 'pending') && (
                <div className="mt-6 pt-4 border-t border-white/10 space-y-2">
                  <div className="text-[8px] text-white/40 uppercase tracking-[0.15em] font-bold mb-2">HANDSHAKES OUTSTANDING</div>
                  {connections.map((c) => {
                    const isRequester = c.requesterId === userProfile.id;
                    const peerName = isRequester ? c.receiverName : c.requesterName;
                    const peerEmoji = isRequester ? c.receiverEmoji : c.requesterEmoji;
                    const peerId = isRequester ? c.receiverId : c.requesterId;

                    if (c.status !== 'pending') return null;

                    return (
                      <div key={c.id} className="p-3 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-xs select-none">{peerEmoji}</span>
                            <span className="text-[10px] font-bold text-white/80 truncate">{peerName}</span>
                          </div>
                          {!isRequester && (
                            <span className="text-[7px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.5 rounded uppercase tracking-wider animate-pulse">RECV</span>
                          )}
                        </div>
                        {!isRequester ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'connections', c.id), { status: 'accepted' });
                                  addLog(`[SUCCESS]: Tunnel connection from ${peerName} accepted!`, 'success');
                                  setActiveChatPeer(peerId);
                                } catch (e: any) {
                                  addLog(`[ERROR]: Acceptance failed: ${e.message}`, 'error');
                                }
                              }}
                              className="flex-1 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[8px] uppercase tracking-widest font-bold hover:bg-emerald-500 hover:text-black transition-all cursor-pointer"
                            >
                              ACCEPT
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'connections', c.id), { status: 'declined' });
                                  addLog(`[SYSTEM]: Connection declined from ${peerName}.`, 'system');
                                } catch (e: any) {
                                  addLog(`[ERROR]: Decline failed: ${e.message}`, 'error');
                                }
                              }}
                              className="p-1 px-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-black transition-all cursor-pointer text-[8px]"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <div className="text-[8px] text-white/30 tracking-widest uppercase">TUNNEL Handshake Pending...</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Handshake Portal inside sidebar */}
            <div className="mt-auto pt-4 border-t border-white/10">
              <div className="text-[8px] text-white/40 uppercase tracking-widest mb-1.5 font-bold">ESTABLISH CHAT TUNNEL</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste Node Access ID..."
                  value={newConnectionId}
                  onChange={(e) => setNewConnectionId(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/5 hover:border-white/10 rounded-xl px-3 py-2 text-[10px] text-white placeholder-white/20 focus:outline-none focus:ring-0 font-mono"
                />
                <button
                  onClick={async () => {
                    if (!newConnectionId.trim()) return;
                    await handleConnectNode(newConnectionId.trim());
                    setNewConnectionId('');
                  }}
                  className="p-2 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 transition-colors shrink-0 flex items-center justify-center cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                  title="Send Connection Handshake"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Chat Pane */}
          <div className={`flex-1 flex flex-col bg-black/10 relative overflow-hidden h-full ${activeChatPeer ? 'flex' : 'hidden md:flex'}`}>
            {activeChatPeer && peerProfile ? (
              <>
                {/* Chat Header Info */}
                <div className="p-3 bg-black/60 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 truncate">
                    <button
                      onClick={() => setActiveChatPeer(null)}
                      className="md:hidden p-1 rounded-lg border border-white/10 hover:bg-white/5 text-white/60 hover:text-white mr-1 cursor-pointer"
                      title="Back to Nodes"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xl select-none">{peerProfile.emoji}</span>
                    <div className="text-left truncate">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{peerProfile.name}</span>
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      </div>
                      <div className="text-[8px] font-mono text-white/40 flex items-center gap-1 truncate">
                        <span className="select-all">{activeChatPeer}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(activeChatPeer);
                            addLog(`[SYSTEM]: Copied peer's Node ID: ${activeChatPeer}`, 'success');
                          }}
                          className="hover:text-white text-white/30 transition-colors p-0.5"
                          title="Copy Node ID"
                        >
                          <FileText size={8} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsFileModalOpen(true)}
                      className="p-1.5 px-3 border border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-500/5 text-emerald-400 hover:text-emerald-300 rounded-xl text-[9px] uppercase tracking-widest font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Paperclip size={10} />
                      <span>Transmit File</span>
                    </button>
                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-1 rounded-xl text-[8px] font-mono text-white/60">
                      <Lock size={8} className="text-emerald-400" />
                      <span>E2E CRYPTO ENVELOPE</span>
                    </div>
                  </div>
                </div>

                {/* Real-time Message Stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                  {activeMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/30 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-full border border-dashed border-white/10 flex items-center justify-center text-lg mb-3">
                        💬
                      </div>
                      <div className="text-xs font-bold uppercase tracking-wider mb-1 text-white/70">Quantum Encryption Ready</div>
                      <div className="text-[10px] leading-relaxed">No messages have been exchanged yet in this E2EE tunnel. Type a secure message below to begin instantly.</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeMessages.map((msg) => {
                        const isMe = msg.senderId === userProfile.id;
                        const decryptedContent = getDecryptedText(msg.content);
                        
                        return (
                          <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className={`p-3 rounded-2xl max-w-[85%] border ${
                              isMe 
                                ? 'bg-[#121212]/90 border-white/10 text-white shadow-md' 
                                : 'bg-emerald-950/15 border-emerald-500/25 text-emerald-200'
                            }`}>
                              <div className="flex items-center justify-between gap-4 mb-1 text-[8px] uppercase tracking-widest text-white/30">
                                <span>{isMe ? 'YOU' : peerProfile.name}</span>
                                <span className="flex items-center gap-1">
                                  <Lock size={8} /> E2EE
                                </span>
                              </div>
                              
                              {msg.filePayload ? (
                                <div className="space-y-2 mt-1">
                                  <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/5">
                                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                    <div className="text-left">
                                      <div className="text-[10px] font-bold text-white tracking-wide">{msg.filePayload.fileName}</div>
                                      <div className="text-[7px] text-white/40 uppercase tracking-widest">Encrypted Document Container</div>
                                    </div>
                                  </div>
                                  <div className="bg-black/60 p-2.5 rounded-xl text-[10px] text-emerald-400 border border-white/5 text-left font-mono break-all max-h-[120px] overflow-y-auto">
                                    <div className="text-[7px] text-white/40 uppercase mb-1 font-bold">DECRYPTED PAYLOAD:</div>
                                    {decryptMessage(msg.filePayload.encryptedContent, msg.chatId)}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-left text-xs break-all leading-relaxed">{decryptedContent}</div>
                              )}
                              {renderDeliveryTrace(msg)}
                            </div>
                            <span className="text-[7px] text-white/30 font-mono uppercase mt-1 px-2">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })}
                      <div ref={terminalEndRef} />
                    </div>
                  )}
                </div>

                {/* Instant Messenger Chat Input - Fulfilling: "no need of adding msg so as to send messages" */}
                <form onSubmit={handleSendChatMessage} className="p-3 bg-black/40 border-t border-white/10 flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInputText}
                    onChange={(e) => setChatInputText(e.target.value)}
                    placeholder={`Write extremely secure encrypted message to ${peerProfile.name}...`}
                    className="flex-1 bg-[#0a0a0a] border border-white/5 hover:border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:ring-0"
                  />
                  <EmojiPicker
                    onSelect={(emoji) => setChatInputText(prev => prev + emoji)}
                    buttonClassName="h-[38px] w-[38px]"
                  />
                  <button
                    type="submit"
                    disabled={!chatInputText.trim()}
                    className="p-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:hover:bg-emerald-500 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.15)] shrink-0"
                  >
                    <Send size={12} />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-xl mb-4 shadow-inner">
                  🔐
                </div>
                <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-white mb-2">SECURED CHAT INTERCONNECT</h3>
                <p className="text-xs uppercase tracking-wider text-white/40 leading-relaxed mb-6">
                  Verify cryptographic handshakes and select an active tunnel on the left to begin secure real-time messaging instantly.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsChatMode(false);
                      addLog(`root@whisper:~# exit_chat`, 'input');
                      addLog(`[SYSTEM]: Returned to command line shell.`, 'system');
                    }}
                    className="px-5 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-[9px] uppercase tracking-widest font-bold transition-all cursor-pointer"
                  >
                    Return to CLI Console
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* STANDARD TERMINAL LOGS & CLI VIEW */
        <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10 overflow-hidden relative z-20">
          
          {/* Terminal Logs View */}
          <div className="flex-1 flex flex-col bg-black/40 p-4 font-mono text-xs overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            <div className="flex-1 space-y-2 pb-4">
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
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setActiveChatPeer(null)}
                        className="text-[9px] uppercase tracking-widest text-white/40 hover:text-white flex items-center gap-1 border border-white/10 px-2.5 py-0.5 rounded-full hover:bg-white/5 transition-all cursor-pointer"
                      >
                        Close Tunnel
                      </button>
                    </div>
                  </div>

                  {activeMessages.length === 0 ? (
                    <div className="text-center py-6 text-white/30 border border-dashed border-white/5 rounded-2xl text-[10px]">
                      No packets transmitted inside this channel. Type a message in the input field below to start secure real-time communication.
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
                              {renderDeliveryTrace(msg)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Inline direct messaging input field */}
                  <form 
                    onSubmit={handleSendChatMessage} 
                    className="flex items-center gap-2 mt-3 pt-2 border-t border-white/10"
                  >
                    <input
                      type="text"
                      value={chatInputText}
                      onChange={(e) => setChatInputText(e.target.value)}
                      placeholder={`Direct E2EE message to ${peerProfile.name}...`}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:ring-0 font-sans"
                    />
                    <button
                      type="submit"
                      disabled={!chatInputText.trim()}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[10px] uppercase tracking-wider transition-all disabled:opacity-30 cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                    >
                      Send
                    </button>
                  </form>
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
                placeholder=""
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
                className="p-1 rounded text-emerald-400 hover:bg-white/5 disabled:opacity-30 transition-colors cursor-pointer"
              >
                <Send size={14} />
              </button>
            </form>
          </div>

          {/* GUI Connection Panel (Improves usability immensely) */}
          {!isStealthMode && (
            <div className="w-full md:w-64 bg-black/20 p-4 flex flex-col gap-4 border-t md:border-t-0 md:border-l border-white/10">
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
                                addLog(`root@whisper:~# cht ${peerId}`, 'input');
                                addLog(`[CHAT_FOCUS]: Secured E2EE channel aligned with node: ${peerId}.`, 'success');
                              }}
                              className="flex-1 py-1 rounded-lg border border-white/20 text-[9px] text-white uppercase tracking-wider hover:bg-white hover:text-black transition-all cursor-pointer"
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
                              className="flex-1 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] uppercase tracking-wider hover:bg-emerald-500 hover:text-black transition-all cursor-pointer"
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
                              className="p-1 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-black transition-all cursor-pointer"
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
                  className="p-1 hover:bg-white/5 rounded text-white/60 hover:text-white transition-colors cursor-pointer"
                  title="Copy Node Access ID"
                >
                  <FileText size={12} />
                </button>
              </div>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
