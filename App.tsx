
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Search, Menu, MoreVertical, Send, Paperclip, Mic, 
  Settings as SettingsIcon, Share2, Trash2, Pin, CornerUpLeft, 
  Check, CheckCheck, X, ChevronLeft, Volume2, Play, Pause, Smile, UserCircle, CheckCircle, UserPlus, Image as ImageIcon, Camera, RefreshCw, Palette, Fish, Waves, Droplet, Key
} from 'lucide-react';
import { Chat, Message, Language, UserProfile, Theme } from './types';
import { TRANSLATIONS, INITIAL_CHATS, REACTION_EMOJIS, PUBLIC_AVATARS, DEFAULT_AVATAR_URL } from './constants';
import { PeerService, PeerData } from './services/peer';
import { getGeminiResponse } from './services/gemini';
import VoiceRecorder from './components/VoiceRecorder';

// --- UI Components ---

const Avatar: React.FC<{ src: string, className?: string, title?: string, theme?: Theme }> = ({ src, className, title, theme }) => {
  const isSvg = src?.startsWith('<svg');
  return (
    <div title={title} className={`relative overflow-hidden rounded-full flex-shrink-0 bg-white/10 flex items-center justify-center shadow-md transition-all duration-300 hover:scale-105 ${className}`}>
      {isSvg ? (
        <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: src }} />
      ) : (
        <img 
          src={src || DEFAULT_AVATAR_URL} 
          className="w-full h-full object-cover" 
          alt={title || "Avatar"}
          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL; }}
        />
      )}
      {theme === 'frutiger' && (
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-white/10 rounded-full border border-white/30 pointer-events-none" />
      )}
    </div>
  );
};


const AudioPlayer: React.FC<{ src: string, t: any }> = ({ src, t }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState('0:00');
  const [currentTime, setCurrentTime] = useState('0:00');
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => console.error("Playback failed:", err));
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="mb-3 flex items-center gap-3 bg-black/20 p-3 rounded-2xl min-w-[240px] border border-white/5">
      <button 
        onClick={togglePlay}
        className="w-10 h-10 flex items-center justify-center bg-green-500 rounded-full text-white hover:bg-green-600 transition-all active:scale-90 shadow-lg"
      >
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] opacity-40 font-bold uppercase tracking-widest">{t.voiceMsg}</span>
          <span className="text-[10px] opacity-40 font-bold">{isPlaying ? currentTime : duration}</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 transition-all duration-100" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <audio 
        ref={audioRef}
        src={src} 
        className="hidden" 
        preload="metadata"
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(formatTime(audioRef.current.duration));
          }
        }}
        onDurationChange={() => {
          if (audioRef.current) {
            setDuration(formatTime(audioRef.current.duration));
          }
        }}
        onTimeUpdate={() => {
          if (audioRef.current) {
            const d = audioRef.current.duration;
            const c = audioRef.current.currentTime;
            setCurrentTime(formatTime(c));
            if (isFinite(d) && d > 0) {
              setProgress((c / d) * 100);
            }
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
          setCurrentTime('0:00');
        }}
      />
    </div>
  );
};

const normalizePeerId = (value: string) => value.trim().replace(/^@+/, '').toLowerCase();

const mergeMessages = (current: Message[], incoming: Message[]) => {
  const byId = new Map<string, Message>();
  [...current, ...incoming].forEach((msg) => {
    if (msg?.id) byId.set(msg.id, msg);
  });
  return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
};

const dedupeChats = (input: Chat[]): Chat[] => {
  const merged = new Map<string, Chat>();

  input.forEach((chat) => {
    const id = normalizePeerId(chat.id || chat.nickname || '');
    if (!id) return;

    const normalized: Chat = {
      ...chat,
      id,
      nickname: chat.nickname ? normalizePeerId(chat.nickname) : chat.nickname,
      avatar: chat.avatar || DEFAULT_AVATAR_URL,
      messages: Array.isArray(chat.messages) ? chat.messages : [],
    };

    const existing = merged.get(id);
    if (!existing) {
      merged.set(id, normalized);
      return;
    }

    const existingNameLooksGeneric = existing.name === `@${id}` || !existing.name;
    const nextName = existingNameLooksGeneric && normalized.name ? normalized.name : existing.name;
    const nextAvatar = existing.avatar && existing.avatar !== DEFAULT_AVATAR_URL
      ? existing.avatar
      : (normalized.avatar || DEFAULT_AVATAR_URL);

    merged.set(id, {
      ...existing,
      ...normalized,
      id,
      name: nextName || `@${id}`,
      avatar: nextAvatar,
      nickname: normalized.nickname || existing.nickname || id,
      messages: mergeMessages(existing.messages, normalized.messages),
      isP2P: Boolean(existing.isP2P || normalized.isP2P),
      isContact: Boolean(existing.isContact || normalized.isContact),
    });
  });

  return Array.from(merged.values());
};

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('ru');
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('arbuzgram_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse user profile from localStorage", e);
    }
    return {
      name: 'User_' + Math.floor(Math.random() * 1000),
      nickname: 'arbuz' + Math.floor(Math.random() * 10000),
      avatar: DEFAULT_AVATAR_URL,
      theme: 'standard'
    };
  });

  const [userApiKey, setUserApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('gemini_user_key') || '';
    } catch (e) {
      console.error("Failed to read gemini_user_key from localStorage", e);
      return '';
    }
  });

  const [chats, setChats] = useState<Chat[]>(() => {
    try {
      const savedChats = localStorage.getItem('arbuzgram_chats');
      if (savedChats) return dedupeChats(JSON.parse(savedChats));
    } catch (e) {
      console.error("Failed to parse chats from localStorage", e);
    }
    return dedupeChats(INITIAL_CHATS('ru'));
  });
  
  const [activeChatId, setActiveChatId] = useState<string>('saved');
  const [isConnectedMap, setIsConnectedMap] = useState<Record<string, boolean>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactNickname, setNewContactNickname] = useState('');
  const [addContactError, setAddContactError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  
  const peerServiceRef = useRef<PeerService | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[language];

  useEffect(() => {
    localStorage.setItem('arbuzgram_profile', JSON.stringify(userProfile));
    peerServiceRef.current?.broadcast({ type: 'profile', profile: userProfile });
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('arbuzgram_chats', JSON.stringify(dedupeChats(chats)));
  }, [chats]);

  useEffect(() => {
    setChats(prev => dedupeChats(prev));
  }, []);

  // Sync bot profile if it changed in constants
  useEffect(() => {
    setChats(prev => prev.map(chat => {
      if (chat.id === 'gemini') {
        return { ...chat, name: TRANSLATIONS[language].aiBot, avatar: PUBLIC_AVATARS[1] };
      }
      if (chat.id === 'saved') {
        return { ...chat, name: TRANSLATIONS[language].savedMessages, avatar: PUBLIC_AVATARS[0] };
      }
      return chat;
    }));
  }, [language, TRANSLATIONS]);

  useEffect(() => {
    localStorage.setItem('gemini_user_key', userApiKey);
  }, [userApiKey]);

  // Helper to convert URL avatars to base64 so Gemini can "see" them
  const getBase64Avatar = async (url: string): Promise<string | undefined> => {
    if (url.startsWith('data:')) return url;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Could not convert avatar to base64 for Gemini", e);
      return undefined;
    }
  };

  const handleIncomingData = useCallback((remoteId: string, data: PeerData) => {
    const cleanRemoteId = normalizePeerId(remoteId);
    if (!cleanRemoteId) return;

    setChats(prev => {
      const deduped = dedupeChats(prev);
      const existingIndex = deduped.findIndex(
        chat => chat.id === cleanRemoteId || normalizePeerId(chat.nickname || '') === cleanRemoteId
      );

      const baseChat: Chat = existingIndex >= 0
        ? deduped[existingIndex]
        : {
            id: cleanRemoteId,
            name: `@${cleanRemoteId}`,
            nickname: cleanRemoteId,
            isP2P: true,
            isContact: true,
            avatar: DEFAULT_AVATAR_URL,
            messages: []
          };

      let updatedChat: Chat = baseChat;

      if (data.type === 'message' && data.content) {
        const incomingMsg: Message = { ...data.content, senderId: cleanRemoteId };
        updatedChat = { ...baseChat, messages: mergeMessages(baseChat.messages, [incomingMsg]) };
      }

      if (data.type === 'profile' && data.profile) {
        updatedChat = {
          ...updatedChat,
          name: data.profile.name || updatedChat.name || `@${cleanRemoteId}`,
          avatar: data.profile.avatar || updatedChat.avatar || DEFAULT_AVATAR_URL,
          nickname: normalizePeerId(data.profile.nickname || cleanRemoteId),
          isP2P: true,
          isContact: true
        };
      }

      if (existingIndex >= 0) {
        return deduped.map((chat, idx) => idx === existingIndex ? updatedChat : chat);
      }

      return [...deduped, updatedChat];
    });
  }, []);

  const initPeer = () => {
    try {
      if (peerServiceRef.current) peerServiceRef.current.disconnectAll();
      peerServiceRef.current = new PeerService(
        userProfile.nickname,
        () => {},
        handleIncomingData,
        (remoteId) => {
          const cleanRemoteId = normalizePeerId(remoteId);
          setIsConnectedMap(prev => ({ ...prev, [cleanRemoteId]: true }));
          peerServiceRef.current?.send(cleanRemoteId, { type: 'profile', profile: userProfile });
        },
        (remoteId) => {
          const cleanRemoteId = normalizePeerId(remoteId);
          setIsConnectedMap(prev => ({ ...prev, [cleanRemoteId]: false }));
        },
        (err) => console.error(err)
      );
    } catch (e) {
      console.error("Failed to initialize PeerService", e);
    }
  };

  useEffect(() => { initPeer(); return () => peerServiceRef.current?.disconnectAll(); }, [userProfile.nickname]);

  const uniqueChats = useMemo(() => dedupeChats(chats), [chats]);
  const safeChats = uniqueChats.length > 0 ? uniqueChats : dedupeChats(INITIAL_CHATS(language));
  const activeChat = safeChats.find(c => c.id === activeChatId) || safeChats[0];
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeChat.messages, isTyping]);

  const handleSendMessage = async (text?: string, voiceData?: string, imageData?: string) => {
    if (!text && !voiceData && !imageData) return;
    const newMessage: Message = { id: Date.now().toString() + Math.random().toString(36).substr(2, 9), senderId: 'me', text, voiceData, imageData, timestamp: Date.now(), replyToId: replyToId || undefined };
    setReplyToId(null);
    setInputText('');
    setChats(prev => prev.map(chat => chat.id === activeChatId ? { ...chat, messages: [...chat.messages, newMessage] } : chat));
    
    if (activeChatId === 'gemini') {
      setIsTyping(true);
      // Attempt to get base64 version of user avatar for the bot to see
      const avatarBase64 = await getBase64Avatar(userProfile.avatar);
      const botResponse = await getGeminiResponse(
        text || '', 
        language, 
        imageData, 
        userApiKey, 
        avatarBase64
      );
      setIsTyping(false);
      const botMessage: Message = { id: (Date.now() + 1).toString(), senderId: 'gemini', text: botResponse, timestamp: Date.now() };
      setChats(prev => prev.map(chat => chat.id === 'gemini' ? { ...chat, messages: [...chat.messages, botMessage] } : chat));
    } else if (activeChat.isP2P) {
      peerServiceRef.current?.send(normalizePeerId(activeChatId), { type: 'message', content: newMessage });
    }
  };

  const themeStyles = useMemo(() => {
    switch(userProfile.theme) {
      case 'minimal':
        return {
          bg: 'bg-[#0a0a0a] text-white',
          sidebar: 'bg-[#121212] border-[#222]',
          header: 'bg-[#121212] border-[#222]',
          bubbleMe: 'bg-green-600 text-white rounded-2xl rounded-bl-none',
          bubbleOther: 'bg-[#2b2b2b] text-white rounded-2xl rounded-br-none',
          input: 'bg-[#1c1c1c] text-white rounded-full',
          accent: 'text-green-500',
          button: 'bg-green-600 text-white hover:bg-green-700',
        };
      case 'frutiger':
        return {
          bg: 'bg-gradient-to-br from-[#e0f7fa] via-[#e8f5e9] to-[#f1f8e9] text-[#1b5e20]',
          sidebar: 'bg-white/40 backdrop-blur-xl border-white/50',
          header: 'bg-white/60 backdrop-blur-2xl border-b border-white/80',
          bubbleMe: 'bg-gradient-to-b from-[#4caf50] to-[#2e7d32] text-white rounded-2xl shadow-lg border border-white/30',
          bubbleOther: 'bg-white/90 backdrop-blur-lg text-[#1b5e20] rounded-2xl shadow-md border border-white/80',
          input: 'bg-white/90 text-[#1b5e20] rounded-full shadow-inner border border-white/80',
          accent: 'text-[#2e7d32] font-bold',
          button: 'bg-gradient-to-b from-[#81c784] to-[#4caf50] text-white rounded-full border border-white/50 shadow-lg',
        };
      default: // standard
        return {
          bg: 'bg-[#0f0f0f] text-white',
          sidebar: 'bg-[#1c1c1c] border-[#222]',
          header: 'bg-[#1c1c1c] border-[#222]',
          bubbleMe: 'bg-[#766ac8] text-white rounded-2xl rounded-bl-none',
          bubbleOther: 'bg-[#2b2b2b] text-white rounded-2xl rounded-br-none',
          input: 'bg-[#2b2b2b] text-white rounded-full',
          accent: 'text-[#766ac8]',
          button: 'bg-[#766ac8] text-white hover:bg-[#6558b1]',
        };
    }
  }, [userProfile.theme]);

  const addContactLabels = language === 'ru'
    ? {
        button: 'Добавить контакт',
        placeholder: '@username',
        add: 'Добавить',
        duplicate: 'Контакт уже есть',
        invalid: 'Введите username (минимум 3 символа)',
        self: 'Нельзя добавить себя'
      }
    : {
        button: 'Add contact',
        placeholder: '@username',
        add: 'Add',
        duplicate: 'Contact already exists',
        invalid: 'Enter username (at least 3 chars)',
        self: 'You cannot add yourself'
      };

  const handleAddContact = () => {
    const clean = normalizePeerId(newContactNickname);

    if (clean.length < 3) {
      setAddContactError(addContactLabels.invalid);
      return;
    }

    if (clean === normalizePeerId(userProfile.nickname)) {
      setAddContactError(addContactLabels.self);
      return;
    }

    const exists = safeChats.some(c => c.id === clean || normalizePeerId(c.nickname || '') === clean);
    if (exists) {
      setAddContactError(addContactLabels.duplicate);
      return;
    }

    const chat: Chat = {
      id: clean,
      name: `@${clean}`,
      nickname: clean,
      isP2P: true,
      isContact: true,
      avatar: DEFAULT_AVATAR_URL,
      messages: []
    };

    setChats(prev => {
      const deduped = dedupeChats(prev);
      if (deduped.some(c => c.id === clean || normalizePeerId(c.nickname || '') === clean)) {
        return deduped;
      }
      return [...deduped, chat];
    });
    setActiveChatId(clean);
    setIsSidebarOpen(window.innerWidth >= 768);
    setNewContactNickname('');
    setAddContactError('');
    setShowAddContact(false);

    peerServiceRef.current?.connect(
      clean,
      handleIncomingData,
      (remoteId) => {
        const cleanRemoteId = normalizePeerId(remoteId);
        setIsConnectedMap(prev => ({ ...prev, [cleanRemoteId]: true }));
        peerServiceRef.current?.send(cleanRemoteId, { type: 'profile', profile: userProfile });
      },
      (remoteId) => {
        const cleanRemoteId = normalizePeerId(remoteId);
        setIsConnectedMap(prev => ({ ...prev, [cleanRemoteId]: false }));
      }
    );
  };

  const filteredChats = safeChats.filter(
    c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.nickname?.toLowerCase().includes(searchQuery.replace('@','').toLowerCase())
  );

  return (
    <div className={`flex h-screen w-full overflow-hidden select-none transition-all duration-500 ${themeStyles.bg}`}>
      
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-full md:w-[380px]' : 'w-0'} flex flex-col border-r ${themeStyles.sidebar} transition-all duration-300 ${!isSidebarOpen ? 'hidden' : ''} z-10 overflow-hidden`}>
        <div className={`p-4 flex items-center gap-4 border-b ${themeStyles.header} h-[72px]`}>
          <button className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90" onClick={() => setShowSettings(true)}>
            <Menu size={28} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-green-500 tracking-tight">ArbuzGram</h1>
          </div>
        </div>
        
        <div className="p-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 group-focus-within:opacity-100 transition-opacity" size={20} />
            <input 
              type="text" 
              placeholder={t.search} 
              className={`w-full ${themeStyles.input} py-2.5 pl-11 pr-4 outline-none text-sm transition-all focus:ring-1 focus:ring-green-500`} 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
          </div>
          <div className="mt-3">
            <button
              onClick={() => {
                setShowAddContact(prev => !prev);
                setAddContactError('');
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all font-bold text-sm"
            >
              <UserPlus size={18} />
              <span>{addContactLabels.button}</span>
            </button>

            {showAddContact && (
              <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <input
                  type="text"
                  placeholder={addContactLabels.placeholder}
                  value={newContactNickname}
                  onChange={(e) => {
                    setNewContactNickname(e.target.value);
                    if (addContactError) setAddContactError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddContact()}
                  className={`w-full ${themeStyles.input} py-2.5 px-4 outline-none text-sm focus:ring-1 focus:ring-green-500`}
                />
                {addContactError && <p className="text-xs text-red-400">{addContactError}</p>}
                <button
                  onClick={handleAddContact}
                  className="w-full py-2.5 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-all text-sm font-bold"
                >
                  {addContactLabels.add}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll">
          {filteredChats.map(chat => (
            <div 
              key={chat.id} 
              onClick={() => { setActiveChatId(chat.id); if (window.innerWidth < 768) setIsSidebarOpen(false); }} 
              className={`flex items-center gap-4 p-4 cursor-pointer transition-all ${activeChatId === chat.id ? 'bg-white/10 border-r-4 border-green-500' : 'hover:bg-white/5'}`}
            >
              <Avatar src={chat.avatar} className="w-16 h-16" theme={userProfile.theme} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold truncate text-base">{chat.name}</h3>
                  <span className="text-xs opacity-40 uppercase font-medium">{chat.messages.length > 0 ? new Date(chat.messages[chat.messages.length - 1].timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                </div>
                <p className="text-sm opacity-60 truncate font-medium">{chat.messages.length > 0 ? (chat.messages[chat.messages.length - 1].text || 'Media attachment') : 'Start conversation'}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={`p-4 border-t ${themeStyles.sidebar} flex items-center gap-4 bg-white/5`}>
          <Avatar src={userProfile.avatar} className="w-14 h-14" theme={userProfile.theme} />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{userProfile.name}</p>
            <p className="text-xs opacity-60 truncate text-green-500 font-bold">@{userProfile.nickname}</p>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-3 hover:bg-white/10 rounded-full transition-all"><SettingsIcon size={24}/></button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col relative ${!isSidebarOpen ? 'flex' : 'hidden md:flex'} z-10 transition-all duration-300`}>
        <div className={`h-[72px] border-b ${themeStyles.header} flex items-center px-4 gap-4 z-20`}>
          <button className="md:hidden p-2 hover:bg-white/10 rounded-full transition-all" onClick={() => setIsSidebarOpen(true)}><ChevronLeft size={28} /></button>
          <Avatar src={activeChat.avatar} className="w-14 h-14" theme={userProfile.theme} />
          <div className="flex-1 text-left">
            <h3 className="font-bold text-base tracking-tight">{activeChat.name}</h3>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isConnectedMap[activeChatId] || activeChatId === 'gemini' ? 'bg-green-400' : 'bg-gray-500'}`} />
              <p className={`text-xs opacity-70 uppercase tracking-tighter font-bold ${themeStyles.accent}`}>{activeChatId === 'gemini' ? (isTyping ? t.typing : t.online) : (activeChat.isP2P ? (isConnectedMap[activeChatId] ? t.online : t.offline) : '')}</p>
            </div>
          </div>
          <button className="p-3 hover:bg-white/10 rounded-full opacity-60 transition-all"><MoreVertical size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 relative custom-scroll">
          {activeChat.messages.map((msg) => {
            const isMe = msg.senderId === 'me';
            const isGemini = msg.senderId === 'gemini';
            let senderAvatar = isMe ? userProfile.avatar : (isGemini ? PUBLIC_AVATARS[1] : activeChat.avatar);
            let senderName = isMe ? userProfile.name : (isGemini ? t.aiBot : activeChat.name);

            return (
              <div key={msg.id} className={`flex items-end gap-4 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                <Avatar src={senderAvatar} className="w-10 h-10 flex-shrink-0" theme={userProfile.theme} />
                <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`px-5 py-3 shadow-sm ${isMe ? themeStyles.bubbleMe : themeStyles.bubbleOther}`}>
                    {!isMe && <p className={`text-xs font-bold mb-1.5 opacity-60 text-left`}>{senderName}</p>}
                    {msg.imageData && (
                      <div className="mb-3 rounded-xl overflow-hidden border border-white/20 max-w-[280px]">
                        <img src={msg.imageData} className="w-full h-auto cursor-pointer" onClick={() => window.open(msg.imageData)} alt="content" />
                      </div>
                    )}
                    {msg.voiceData && <AudioPlayer src={msg.voiceData} t={t} />}
                    {msg.text && <p className="text-base leading-relaxed whitespace-pre-wrap text-left font-medium">{msg.text}</p>}
                    <div className="flex items-center justify-end gap-1.5 mt-1.5 opacity-50">
                      <span className="text-[10px] font-bold">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      {isMe && <CheckCheck size={14} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className={`p-4 border-t ${themeStyles.header} bg-white/5`}>
          <div className="flex items-center gap-4">
            <button onClick={() => fileInputRef.current?.click()} className="p-3 hover:bg-white/10 rounded-full opacity-70 transition-all"><Paperclip size={28} /></button>
            <input type="file" ref={fileInputRef} onChange={(e) => { const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onload = () => handleSendMessage(undefined, undefined, r.result as string); r.readAsDataURL(file); } }} accept="image/*" className="hidden" />
            
            <div className="flex-1 relative">
              {isRecording ? (
                <VoiceRecorder onSend={(data) => { handleSendMessage(undefined, data); setIsRecording(false); }} onCancel={() => setIsRecording(false)} />
              ) : (
                <input 
                  type="text" 
                  placeholder={t.placeholder} 
                  className={`w-full ${themeStyles.input} py-3 px-6 outline-none text-sm transition-all focus:ring-1 focus:ring-green-500 font-medium`} 
                  value={inputText} 
                  onChange={(e) => setInputText(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputText)} 
                />
              )}
            </div>

            {!isRecording && (inputText.trim() ? (
              <button 
                onClick={() => handleSendMessage(inputText)} 
                className={`w-12 h-12 ${themeStyles.button} flex items-center justify-center transition-all shadow-md active:scale-90`}
              >
                <Send size={24} />
              </button>
            ) : (
              <button onClick={() => setIsRecording(true)} className="p-3 hover:bg-white/10 rounded-full opacity-70 transition-all"><Mic size={28} /></button>
            ))}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setShowSettings(false)}>
          <div 
            className={`${themeStyles.sidebar} w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl p-0`} 
            onClick={e => e.stopPropagation()}
          >
            <div className={`p-8 border-b border-white/10 flex items-center justify-between bg-white/5`}>
              <h2 className="text-2xl font-black">{t.settings}</h2>
              <button onClick={() => setShowSettings(false)} className="p-3 hover:bg-white/10 rounded-full transition-all"><X size={32}/></button>
            </div>
            
            <div className="p-8 space-y-10 max-h-[80vh] overflow-y-auto custom-scroll">
              <div className="text-center group">
                <div className="relative inline-block">
                  <Avatar src={userProfile.avatar} className="w-40 h-40 border-8 border-green-500/20 mx-auto" theme={userProfile.theme} />
                  <div onClick={() => avatarFileInputRef.current?.click()} className="absolute bottom-2 right-2 bg-green-500 p-3 rounded-full cursor-pointer shadow-xl hover:bg-green-600 transition-colors">
                    <Camera size={24} className="text-white" />
                  </div>
                  <input type="file" ref={avatarFileInputRef} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const r = new FileReader();
                      r.onload = () => setUserProfile(p => ({ ...p, avatar: r.result as string }));
                      r.readAsDataURL(file);
                    }
                  }} accept="image/*" className="hidden" />
                </div>
                <div className="mt-8 space-y-6">
                  <div className="text-left">
                    <label className="text-xs opacity-60 uppercase font-black ml-2 tracking-widest">{t.yourName}</label>
                    <input className={`w-full ${themeStyles.input} p-4 text-base outline-none mt-2 font-bold`} value={userProfile.name} onChange={(e) => setUserProfile(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="text-left">
                    <label className="text-xs opacity-60 uppercase font-black ml-2 tracking-widest">@nickname</label>
                    <input className={`w-full ${themeStyles.input} p-4 text-base outline-none mt-2 font-bold text-green-500`} value={userProfile.nickname} onChange={(e) => setUserProfile(p => ({ ...p, nickname: e.target.value.toLowerCase().replace(/\s/g, '') }))} />
                  </div>
                </div>
              </div>

              {/* API Key Section */}
              <div className="p-6 bg-green-500/5 border border-green-500/10 rounded-3xl space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Key size={20} className="text-green-500" />
                  <span className="text-sm font-black uppercase tracking-widest">{language === 'ru' ? 'API Ключ Gemini' : 'Gemini API Key'}</span>
                </div>
                <input 
                  type="password"
                  placeholder="Paste your API key here..."
                  className={`w-full ${themeStyles.input} p-4 text-sm outline-none font-medium`}
                  value={userApiKey}
                  onChange={(e) => setUserApiKey(e.target.value)}
                />
                <p className="text-xs opacity-50 italic font-medium px-2">
                  {language === 'ru' ? 'Ключ сохраняется локально. Бот будет использовать его для ответов.' : 'Key stored locally. Bot will use it to interact with you.'}
                </p>
              </div>

              <div className="space-y-6">
                <p className="text-xs opacity-60 uppercase font-black ml-2 tracking-widest">{t.theme}</p>
                <div className="grid grid-cols-1 gap-4">
                  {(['standard', 'minimal', 'frutiger'] as Theme[]).map(th => (
                    <button 
                      key={th} 
                      onClick={() => setUserProfile(p => ({ ...p, theme: th }))}
                      className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${userProfile.theme === th ? 'border-green-500 bg-green-500/10 shadow-lg' : 'border-white/5 opacity-70 hover:opacity-100 hover:bg-white/5'}`}
                    >
                      <span className="text-base font-bold">{t[`theme_${th}` as keyof typeof t]}</span>
                      {userProfile.theme === th && <CheckCircle size={24} className="text-green-500" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setLanguage('en')} className={`flex-1 p-4 rounded-2xl border-2 transition-all text-sm font-black tracking-widest ${language === 'en' ? 'border-green-500 bg-green-500/10' : 'border-white/5'}`}>ENGLISH</button>
                <button onClick={() => setLanguage('ru')} className={`flex-1 p-4 rounded-2xl border-2 transition-all text-sm font-black tracking-widest ${language === 'ru' ? 'border-green-500 bg-green-500/10' : 'border-white/5'}`}>РУССКИЙ</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
