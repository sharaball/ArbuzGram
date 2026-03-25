
import React from 'react';

export const PUBLIC_AVATARS = [
  "https://api.dicebear.com/7.x/initials/svg?seed=Saved&backgroundColor=4ade80",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Google_Gemini_logo.svg/1200px-Google_Gemini_logo.svg.png",
];

// High quality watermelon image for ArbuzGram branding
export const DEFAULT_AVATAR_URL = "https://images.rawpixel.com/image_png_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA4L2pvYjEwMzQtZWxlbWVudC0wNS00MDMucG5n.png";

export const TRANSLATIONS = {
  en: {
    search: "Search",
    settings: "Settings",
    devices: "Devices",
    personalNickname: "Your @nickname",
    partnerNickname: "Partner's @nickname",
    connect: "Connect",
    disconnect: "Disconnect",
    savedMessages: "Saved Messages",
    aiBot: "ыхыхыххы гимини",
    typing: "typing...",
    online: "online",
    offline: "offline",
    pin: "Pin",
    unpin: "Unpin",
    reply: "Reply",
    forward: "Forward",
    delete: "Delete",
    copyNickname: "Copy @nickname",
    copied: "Copied!",
    multiSelect: "Select Messages",
    cancel: "Cancel",
    send: "Send",
    placeholder: "Message",
    noChats: "No chats found",
    voiceMsg: "Voice message",
    forwarded: "Forwarded",
    profile: "Profile",
    yourName: "Your Display Name",
    nicknameHint: "Change @nickname (no spaces)",
    chooseAvatar: "Change Photo",
    idTaken: "This nickname is already taken!",
    requests: "Chat Requests",
    accept: "Accept",
    decline: "Decline",
    noRequests: "No new requests",
    wantsToChat: "wants to start a conversation",
    theme: "Appearance",
    theme_standard: "Standard",
    theme_minimal: "Dark Mode",
    theme_frutiger: "Liquid Arbuz"
  },
  ru: {
    search: "Поиск",
    settings: "Настройки",
    devices: "Устройства",
    personalNickname: "Ваш @nickname",
    partnerNickname: "Partner's @nickname",
    connect: "Подключить",
    disconnect: "Отключить",
    savedMessages: "Избранное",
    aiBot: "ыхыхыххы гимини",
    typing: "печатает...",
    online: "в сети",
    offline: "не в сети",
    pin: "Закрепить",
    unpin: "Открепить",
    reply: "Ответить",
    forward: "Переслать",
    delete: "Удалить",
    copyNickname: "Копировать @",
    copied: "Скопировано!",
    multiSelect: "Выбрать сообщения",
    cancel: "Отмена",
    send: "Отправить",
    placeholder: "Сообщение",
    noChats: "Чаты не найдены",
    voiceMsg: "Голосовое сообщение",
    forwarded: "Переслано",
    profile: "Профиль",
    yourName: "Ваше имя",
    nicknameHint: "Сменить @nickname (без пробелов)",
    chooseAvatar: "Изменить фото",
    idTaken: "Этот никнейм уже занят!",
    requests: "Запросы на чат",
    accept: "Принять",
    decline: "Отклонить",
    noRequests: "Нет новых запросов",
    wantsToChat: "хочет начать общение",
    theme: "Оформление",
    theme_standard: "Стандарт",
    theme_minimal: "Темная тема",
    theme_frutiger: "Liquid Arbuz"
  }
};

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👏"];

export const INITIAL_CHATS = (lang: 'en' | 'ru') => [
  {
    id: 'saved',
    name: TRANSLATIONS[lang].savedMessages,
    isBot: false,
    isP2P: false,
    messages: [],
    avatar: PUBLIC_AVATARS[0]
  },
  {
    id: 'gemini',
    name: TRANSLATIONS[lang].aiBot,
    isBot: true,
    isP2P: false,
    messages: [],
    avatar: PUBLIC_AVATARS[1]
  }
];
