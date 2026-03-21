'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/components/analytics/AnalyticsProvider';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  feedback?: 'up' | 'down';
}

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  bottomClass?: string;
  initialMessage?: string;
}

interface UserContext {
  firstName?: string;
  city?: string;
  state?: string;
  isInvestor?: boolean;
  isRealtor?: boolean;
  likedCount?: number;
  currentPage?: string;
}

const SESSION_KEY = 'ownerfi_chat';
const MAX_INPUT_LENGTH = 500;

// Page-aware starter suggestions
function getStarterQuestions(pathname: string): string[] {
  if (pathname.startsWith('/dashboard/investor')) {
    return ["How do cash deals work?", "What's ARV?", "How do deal alerts work?", "Filter by deal type"];
  }
  if (pathname.startsWith('/dashboard/liked')) {
    return ["How do I contact a seller?", "What should I look for?", "How do I make an offer?"];
  }
  if (pathname.startsWith('/dashboard/settings')) {
    return ["How do I change my city?", "What's investor mode?", "Set up deal alerts"];
  }
  if (pathname.startsWith('/dashboard')) {
    return ["How does swiping work?", "What homes are available?", "How do I save a property?"];
  }
  return ["How does owner financing work?", "What homes are available?", "Do I need good credit?", "How do I get started?"];
}

// Detect links and emails in text
function renderMessageContent(text: string): React.ReactNode[] {
  const linkPattern = /(\/[a-z][a-z0-9\-\/]*(?:\.[a-z]+)?)|([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const path = match[1];
    const email = match[2];
    if (path) {
      parts.push(
        <Link key={match.index} href={path} className="text-[#00BC7D] underline underline-offset-2 hover:text-[#009B66] font-medium" onClick={(e) => e.stopPropagation()}>
          {path}
        </Link>
      );
    } else if (email) {
      parts.push(
        <a key={match.index} href={`mailto:${email}`} className="text-[#00BC7D] underline underline-offset-2 hover:text-[#009B66] font-medium" onClick={(e) => e.stopPropagation()}>
          {email}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

function getContextualSuggestions(response: string, msgCount: number): string[] {
  if (msgCount <= 3) {
    return ["How does owner financing work?", "Show me how to browse homes", "Do I need good credit?"];
  }
  const lower = response.toLowerCase();
  const suggestions: string[] = [];

  if (lower.includes('owner financ') || lower.includes('seller financ') || lower.includes('deal type')) {
    suggestions.push("What are the risks?", "How do I protect myself legally?");
  }
  if (lower.includes('sign up') || lower.includes('create') || lower.includes('get started') || lower.includes('/auth')) {
    suggestions.push("Is it really free?", "What do I need to sign up?");
  }
  if (lower.includes('investor') || lower.includes('cash deal') || lower.includes('arv')) {
    suggestions.push("How do deal alert texts work?", "What's ARV mean?");
  }
  if (lower.includes('dashboard') || lower.includes('settings') || lower.includes('filter')) {
    suggestions.push("How do I change my city?", "Can I filter by price?");
  }
  if (lower.includes('down payment') || lower.includes('monthly payment') || lower.includes('interest')) {
    suggestions.push("Are the terms negotiable?", "What's a balloon payment?");
  }
  if (lower.includes('credit') || lower.includes('bank')) {
    suggestions.push("What if I have bad credit?", "How is this different from a mortgage?");
  }
  if (lower.includes('support') || lower.includes('help') || lower.includes('issue') || lower.includes('problem')) {
    suggestions.push("Contact support team", "I have a billing question");
  }
  // If the response contains property listings, suggest refinement
  if (lower.includes('bed') && lower.includes('bath') && (lower.includes('$') || lower.includes('price'))) {
    suggestions.push("Show me cheaper options", "Any with more bedrooms?", "What about a different city?");
  }

  if (suggestions.length === 0) {
    suggestions.push("What properties are available?", "Tell me about deal types", "How much does it cost?");
  }
  return [...new Set(suggestions)].slice(0, 3);
}

function loadSession(): { messages: Message[]; history: Array<{role: string, content: string}> } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.messages?.length > 0) {
      data.messages = data.messages.map((m: Message) => ({ ...m, isStreaming: false }));
      data.messages = data.messages.filter((m: Message) => m.content.trim() !== '' || m.role === 'user');
      return data;
    }
  } catch { /* ignore */ }
  return null;
}

function saveSession(messages: Message[], history: Array<{role: string, content: string}>) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      messages: messages.slice(-20),
      history: history.slice(-10),
    }));
  } catch { /* ignore */ }
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

function buildTranscript(messages: Message[]): string {
  return messages.map(m => {
    const time = new Date(m.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const who = m.role === 'user' ? 'You' : 'Sarah (Ownerfi)';
    return `[${time}] ${who}: ${m.content}`;
  }).join('\n\n');
}

export default function Chatbot({ isOpen, onClose, bottomClass, initialMessage }: ChatbotProps) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, content: string}>>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [userContext, setUserContext] = useState<UserContext | undefined>();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const msgCountRef = useRef(0);
  const autoSendRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isRestartingRef = useRef(false);
  const initialMessageSent = useRef(false);
  const openTracked = useRef(false);

  useEffect(() => { msgCountRef.current = messages.length; }, [messages.length]);

  // Persist to sessionStorage
  useEffect(() => {
    if (messages.length > 0) saveSession(messages, conversationHistory);
  }, [messages, conversationHistory]);

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  // Track chatbot open
  useEffect(() => {
    if (isOpen && !openTracked.current) {
      openTracked.current = true;
      trackEvent('chatbot_open', { page: pathname });
    }
    if (!isOpen) openTracked.current = false;
  }, [isOpen, pathname]);

  // Fetch user profile for personalization
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/buyer/profile').then(r => r.json()).then(data => {
      if (data.profile) {
        setUserContext({
          firstName: data.profile.firstName,
          city: data.profile.preferredCity || data.profile.city,
          state: data.profile.preferredState || data.profile.state,
          isInvestor: data.profile.isInvestor,
          isRealtor: data.profile.role === 'realtor',
          likedCount: data.profile.likedPropertyIds?.length || 0,
          currentPage: pathname,
        });
      }
    }).catch(() => { /* not logged in, no context */ });
  }, [isOpen, pathname]);

  // Initialize speech
  useEffect(() => {
    if (typeof window === 'undefined' || isInitialized) return;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SR = (window as Record<string, unknown>).SpeechRecognition || (window as Record<string, unknown>).webkitSpeechRecognition;
      recognitionRef.current = new (SR as unknown as { new(): unknown })();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onresult = (event: unknown) => {
        const transcript = (event as { results: { 0: { 0: { transcript: string } } } }).results[0][0].transcript;
        setInputMessage(transcript);
        setIsListening(false);
        autoSendRef.current = true;
        trackEvent('chatbot_voice', { length: transcript.length });
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
    if ('speechSynthesis' in window) synthRef.current = window.speechSynthesis;
    setIsInitialized(true);
  }, [isInitialized]);

  // Auto-send after voice
  useEffect(() => {
    if (autoSendRef.current && inputMessage.trim()) {
      autoSendRef.current = false;
      const timer = setTimeout(() => { sendMessage(inputMessage.trim()); }, 400);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMessage]);

  // Load session or show greeting
  useEffect(() => {
    if (!isOpen || messages.length > 0 || isRestartingRef.current) return;
    const saved = loadSession();
    if (saved) {
      setMessages(saved.messages);
      setConversationHistory(saved.history);
      const lastA = [...saved.messages].reverse().find(m => m.role === 'assistant');
      if (lastA) setSuggestions(getContextualSuggestions(lastA.content, saved.messages.length));
      else setSuggestions(getStarterQuestions(pathname));
      return;
    }
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    setMessages([{
      role: 'assistant',
      content: `${timeGreeting}! I'm Sarah, your Ownerfi guide. Whether you're looking to buy a home without a bank loan or just exploring — I'm here to help. What can I tell you?`,
      timestamp: Date.now()
    }]);
    setSuggestions(getStarterQuestions(pathname));
  }, [isOpen, messages.length, pathname]);

  // Handle initialMessage from floating button
  useEffect(() => {
    if (isOpen && initialMessage && !initialMessageSent.current && messages.length > 0 && !isLoading) {
      initialMessageSent.current = true;
      setTimeout(() => sendMessage(initialMessage), 500);
    }
    if (!isOpen) initialMessageSent.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMessage, messages.length, isLoading]);

  // Auto-scroll & focus
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 300); }, [isOpen]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) { setIsListening(true); recognitionRef.current.start(); }
  };
  const stopSpeaking = () => { if (synthRef.current) { synthRef.current.cancel(); setIsSpeaking(false); } };
  const speakText = (text: string) => {
    if (!synthRef.current) return;
    stopSpeaking();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9; u.pitch = 1; u.volume = 0.8;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    synthRef.current.speak(u);
    trackEvent('chatbot_speak', { length: text.length });
  };

  const handleFeedback = (index: number, type: 'up' | 'down') => {
    setMessages(prev => prev.map((m, i) => i === index ? { ...m, feedback: type } : m));
    trackEvent('chatbot_feedback', { type, message_index: index });
  };

  const restartConversation = () => {
    clearSession();
    isRestartingRef.current = true;
    setConversationHistory([]);
    setSuggestions(getStarterQuestions(pathname));
    setInputMessage('');
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
    setIsLoading(false);
    const hour = new Date().getHours();
    const tg = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    setMessages([{ role: 'assistant', content: `${tg}! Fresh start. I'm Sarah — what can I help you with?`, timestamp: Date.now() }]);
    setTimeout(() => { isRestartingRef.current = false; }, 0);
    trackEvent('chatbot_restart', { message_count: msgCountRef.current });
  };

  const emailTranscript = () => {
    const transcript = buildTranscript(messages);
    const subject = encodeURIComponent('My Ownerfi Chat Transcript');
    const body = encodeURIComponent(`Here's my conversation with Sarah from Ownerfi:\n\n${transcript}\n\n---\nOwnerfi — Skip the Bank. Buy Direct.\nhttps://ownerfi.com`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
    trackEvent('chatbot_email_transcript', { message_count: messages.length });
  };

  const sendMessage = useCallback(async (overrideMessage?: string) => {
    const text = (overrideMessage || inputMessage.trim()).slice(0, MAX_INPUT_LENGTH);
    if (!text || isLoading) return;

    if (!isOnline) {
      setMessages(prev => [...prev,
        { role: 'user', content: text, timestamp: Date.now() },
        { role: 'assistant', content: "It looks like you're offline right now. Please check your internet connection and try again. You can also email support@ownerfi.ai for help.", timestamp: Date.now() }
      ]);
      setInputMessage('');
      return;
    }

    const sentAt = Date.now();
    const userMessage: Message = { role: 'user', content: text, timestamp: sentAt };
    trackEvent('chatbot_message_sent', { length: text.length, count: msgCountRef.current });

    setMessages(prev => {
      const cleaned = prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m);
      return [...cleaned, userMessage];
    });
    setInputMessage('');
    setIsLoading(true);
    setSuggestions([]);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: conversationHistory.slice(-10),
          userContext: userContext ? { ...userContext, currentPage: pathname } : undefined,
        }),
        signal: abortControllerRef.current.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        const reply = data.reply || data.error || "Sorry, something went wrong. Try again?";
        setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: Date.now() }]);
        setConversationHistory(prev => [...prev.slice(-8), { role: 'user', content: text }, { role: 'assistant', content: reply }]);
        setSuggestions(getContextualSuggestions(reply, msgCountRef.current));
        return;
      }

      if (!response.body) throw new Error('No stream');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true }]);
      setIsLoading(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        const captured = fullResponse;
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant' && last.isStreaming) updated[updated.length - 1] = { ...last, content: captured };
          return updated;
        });
      }

      if (!fullResponse.trim()) fullResponse = "Hmm, I didn't quite get that out. Could you ask me again?";
      const final = fullResponse;
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') updated[updated.length - 1] = { ...last, content: final, isStreaming: false };
        return updated;
      });
      setConversationHistory(prev => [...prev.slice(-8), { role: 'user', content: text }, { role: 'assistant', content: final }]);
      setSuggestions(getContextualSuggestions(final, msgCountRef.current));
      trackEvent('chatbot_message_received', { length: final.length, response_ms: Date.now() - sentAt });

    } catch (error: unknown) {
      if ((error as Error).name !== 'AbortError') {
        const errorMsg = "Sorry, I had a hiccup! Could you try that again? If this keeps happening, reach out to support@ownerfi.ai.";
        setMessages(prev => {
          const cleaned = prev.filter(m => !(m.role === 'assistant' && m.isStreaming && !m.content));
          return [...cleaned, { role: 'assistant' as const, content: errorMsg, timestamp: Date.now() }];
        });
        setSuggestions(["How does owner financing work?", "Show me properties", "Contact support"]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [inputMessage, isLoading, conversationHistory, userContext, pathname, isOnline]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!isOpen) return null;
  const charCount = inputMessage.length;
  const nearLimit = charCount > MAX_INPUT_LENGTH * 0.8;

  return (
    <div className={`fixed ${bottomClass || 'bottom-6'} right-6 z-chatbot w-[90vw] max-w-[380px] animate-slide-up`}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200" style={{ height: 'min(580px, 78vh)' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-[#00BC7D] to-[#009B66] px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg width="20" height="20" viewBox="0 0 100 100" fill="none"><defs><linearGradient id="cg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#00BC7D"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs><circle cx="50" cy="50" r="45" stroke="url(#cg)" strokeWidth="8" fill="none"/><ellipse cx="50" cy="50" rx="42" ry="22" stroke="url(#cg)" strokeWidth="6.5" fill="none" transform="rotate(-25 50 50)"/><ellipse cx="50" cy="50" rx="22" ry="42" stroke="url(#cg)" strokeWidth="6.5" fill="none" transform="rotate(-25 50 50)"/></svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-semibold text-sm">Sarah</h3>
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isOnline ? 'bg-green-300' : 'bg-red-300'}`}></div>
                  <span className="text-[10px] text-white/90 font-medium">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
              </div>
              <p className="text-white/80 text-xs">Ownerfi Property Specialist</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={emailTranscript} className="w-7 h-7 text-white/70 hover:text-white hover:bg-white/10 rounded-full flex items-center justify-center transition-colors" title="Email transcript">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </button>
            <button onClick={restartConversation} className="w-7 h-7 text-white/70 hover:text-white hover:bg-white/10 rounded-full flex items-center justify-center transition-colors" title="New conversation">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button onClick={onClose} className="w-7 h-7 text-white/70 hover:text-white hover:bg-white/10 rounded-full flex items-center justify-center transition-colors" title="Minimize">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 overscroll-contain" style={{ backgroundColor: '#f8f9fa' }}>
          {messages.map((message, index) => (
            <div key={`${message.timestamp}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && (
                <div className="w-6 h-6 bg-[#00BC7D]/10 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1"><svg width="14" height="14" viewBox="0 0 100 100" fill="none"><defs><linearGradient id="cl" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#00BC7D"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs><circle cx="50" cy="50" r="45" stroke="url(#cl)" strokeWidth="7" fill="none"/><ellipse cx="50" cy="50" rx="42" ry="22" stroke="url(#cl)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/><ellipse cx="50" cy="50" rx="22" ry="42" stroke="url(#cl)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/></svg></div>
              )}
              <div className="flex flex-col max-w-[80%]">
                <div className={`px-3.5 py-2.5 break-words ${
                  message.role === 'user'
                    ? 'bg-[#00BC7D] text-white rounded-2xl rounded-br-md'
                    : 'bg-white text-slate-800 border border-slate-100 rounded-2xl rounded-bl-md shadow-sm'
                }`}>
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                    {message.role === 'assistant' ? renderMessageContent(message.content) : message.content}
                    {message.isStreaming && <span className="inline-block w-1.5 h-4 bg-[#00BC7D] ml-0.5 animate-pulse rounded-sm" />}
                  </p>
                  {message.role === 'assistant' && !message.isStreaming && message.content && (
                    <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-slate-100">
                      <button onClick={() => speakText(message.content)} disabled={isSpeaking} className="text-[11px] text-slate-400 hover:text-[#00BC7D] transition-colors flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728" /></svg>
                        {isSpeaking ? 'Speaking...' : 'Listen'}
                      </button>
                      {isSpeaking && <button onClick={stopSpeaking} className="text-[11px] text-red-400 hover:text-red-500">Stop</button>}
                      {/* Feedback */}
                      <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => handleFeedback(index, 'up')} className={`p-0.5 rounded transition-colors ${message.feedback === 'up' ? 'text-[#00BC7D]' : 'text-slate-300 hover:text-[#00BC7D]'}`} title="Helpful">
                          <svg className="w-3 h-3" fill={message.feedback === 'up' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" /></svg>
                        </button>
                        <button onClick={() => handleFeedback(index, 'down')} className={`p-0.5 rounded transition-colors ${message.feedback === 'down' ? 'text-red-400' : 'text-slate-300 hover:text-red-400'}`} title="Not helpful">
                          <svg className="w-3 h-3" fill={message.feedback === 'down' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" /></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <span className={`text-[10px] text-slate-400 mt-0.5 ${message.role === 'user' ? 'text-right' : 'text-left ml-1'}`}>
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="w-6 h-6 bg-[#00BC7D]/10 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1"><svg width="14" height="14" viewBox="0 0 100 100" fill="none"><defs><linearGradient id="cl" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#00BC7D"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs><circle cx="50" cy="50" r="45" stroke="url(#cl)" strokeWidth="7" fill="none"/><ellipse cx="50" cy="50" rx="42" ry="22" stroke="url(#cl)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/><ellipse cx="50" cy="50" rx="22" ry="42" stroke="url(#cl)" strokeWidth="5.5" fill="none" transform="rotate(-25 50 50)"/></svg></div>
              <div className="bg-white text-slate-800 border border-slate-100 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-[#00BC7D] rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-[#00BC7D] rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                    <div className="w-1.5 h-1.5 bg-[#00BC7D] rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                  </div>
                  <span className="text-[11px] text-slate-400">Sarah is typing...</span>
                </div>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && !isLoading && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => { trackEvent('chatbot_suggestion', { text: s }); sendMessage(s); }} disabled={isLoading}
                  className="text-[12px] px-3 py-1.5 bg-white border border-[#00BC7D]/30 text-[#009B66] rounded-full hover:bg-[#00BC7D]/5 hover:border-[#00BC7D]/50 transition-all shadow-sm active:scale-95">
                  {s}
                </button>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Offline banner */}
        {!isOnline && (
          <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 flex-shrink-0">
            <p className="text-[11px] text-amber-700 text-center">{"You're offline. Messages will be sent when you reconnect."}</p>
          </div>
        )}

        {/* Input */}
        <div className="p-3 bg-white border-t border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-[#00BC7D] focus-within:ring-1 focus-within:ring-[#00BC7D] transition-all">
                <input ref={inputRef} type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value.slice(0, MAX_INPUT_LENGTH))}
                  onKeyDown={handleKeyDown} placeholder="Ask me anything about Ownerfi..." className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                  disabled={isLoading} maxLength={MAX_INPUT_LENGTH} />
                <button onClick={startListening} disabled={isListening || isLoading}
                  className={`ml-1 p-1.5 rounded-lg transition-colors ${isListening ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:text-[#00BC7D] hover:bg-[#00BC7D]/5'}`}
                  title="Voice input — sends automatically">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </button>
              </div>
            </div>
            <button onClick={() => sendMessage()} disabled={!inputMessage.trim() || isLoading}
              className="w-10 h-10 bg-gradient-to-r from-[#00BC7D] to-[#009B66] hover:from-[#00d68f] hover:to-[#00BC7D] disabled:from-slate-300 disabled:to-slate-300 text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-sm active:scale-95">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            {isListening ? (
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div><span className="text-[11px] text-red-500 font-medium">Listening... will send automatically</span></div>
            ) : nearLimit ? (
              <span className="text-[11px] text-amber-500">{charCount}/{MAX_INPUT_LENGTH}</span>
            ) : <span />}
            <span className="text-[10px] text-slate-300">Powered by AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
