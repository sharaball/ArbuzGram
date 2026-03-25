
export type Language = 'ru' | 'en';
export type Theme = 'standard' | 'minimal' | 'frutiger';

export enum MessageType {
  TEXT = 'text',
  VOICE = 'voice',
  IMAGE = 'image'
}

export interface Reaction {
  emoji: string;
  count: number;
  me: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  text?: string;
  voiceData?: string; // Base64
  imageData?: string; // Base64
  timestamp: number;
  isPinned?: boolean;
  replyToId?: string;
  isForwarded?: boolean;
  reactions?: Record<string, number>; // emoji -> count
}

export interface Chat {
  id: string;
  name: string;
  avatar: string; 
  isBot?: boolean;
  isP2P?: boolean;
  isContact?: boolean; 
  messages: Message[];
  lastSeen?: string;
  nickname?: string;
}

export interface UserProfile {
  name: string;
  nickname: string;
  avatar: string;
  theme: Theme;
}

export interface UserState {
  peerId: string;
  partnerId: string;
  connected: boolean;
  language: Language;
  profile: UserProfile;
}
