'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  /** Extra bottom offset class for pages with bottom tab bars (e.g. "bottom-24") */
  bottomClass?: string;
}

const SESSION_KEY = 'ownerfi_chat';
const MAX_INPUT_LENGTH = 500;

const STARTER_QUESTIONS = [
  "How does owner financing work?",
  "What homes are available?",
  "Do I need good credit?",
  "How do I get started?",
];

// Detect internal paths, email addresses, and make them clickable
function renderMessageContent(text: string): React.ReactNode[] {
  // Match /paths (with optional trailing text) and email addresses
  const linkPattern = /(\/[a-z][a-z0-9\-\/]*(?:\.[a-z]+)?)|([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const path = match[1];
    const email = match[2];

    if (path) {
      parts.push(
        <Link
          key={match.index}
          href={path}
          className="text-emerald-600 underline underline-offset-2 hover:text-emerald-700 font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {path}
        </Link>
      );
    } else if (email) {
      parts.push(
        <a
          key={match.index}
          href={`mailto:${email}`}
          className="text-emerald-600 underline underline-offset-2 hover:text-emerald-700 font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {email}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

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
  if (lower.includes('safe') || lower.includes('legit') || lower.includes('attorney') || lower.includes('protect')) {
    suggestions.push("What's title insurance?", "How do I find a real estate attorney?");
  }
  if (lower.includes('realtor') || lower.includes('agent')) {
    suggestions.push("Can I partner with OwnerFi?", "How do buyer leads work?");
  }
  if (lower.includes('support') || lower.includes('help') || lower.includes('issue') || lower.includes('problem')) {
    suggestions.push("Contact support team", "I have a billing question");
  }

  if (suggestions.length === 0) {
    suggestions.push("What properties are available?", "Tell me about deal types", "How much does it cost?");
  }

  // Deduplicate and limit
  return [...new Set(suggestions)].slice(0, 3);
}

function loadSession(): { messages: Message[]; history: Array<{role: string, content: string}> } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.messages?.length > 0) return data;
  } catch { /* ignore */ }
  return null;
}

function saveSession(messages: Message[], history: Array<{role: string, content: string}>) {
  try {
    // Only keep last 20 messages in storage
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      messages: messages.slice(-20),
      history: history.slice(-10),
    }));
  } catch { /* ignore — storage full etc */ }
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export default function Chatbot({ isOpen, onClose, bottomClass }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, content: string}>>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(STARTER_QUESTIONS);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const msgCountRef = useRef(0); // Avoids stale closure for suggestions
  const autoSendRef = useRef(false); // Flag for voice auto-send
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep msgCountRef in sync
  useEffect(() => {
    msgCountRef.current = messages.length;
  }, [messages.length]);

  // Persist messages to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      saveSession(messages, conversationHistory);
    }
  }, [messages, conversationHistory]);

  // Initialize
  useEffect(() => {
    if (typeof window === 'undefined' || isInitialized) return;

    // Speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as Record<string, unknown>).SpeechRecognition || (window as Record<string, unknown>).webkitSpeechRecognition;
      recognitionRef.current = new (SpeechRecognition as unknown as { new(): unknown })();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: unknown) => {
        const transcript = (event as { results: { 0: { 0: { transcript: string } } } }).results[0][0].transcript;
        setInputMessage(transcript);
        setIsListening(false);
        autoSendRef.current = true; // Signal auto-send
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }

    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    setIsInitialized(true);
  }, [isInitialized]);

  // Auto-send after voice recognition sets inputMessage
  useEffect(() => {
    if (autoSendRef.current && inputMessage.trim()) {
      autoSendRef.current = false;
      // Small delay so user can see what was transcribed
      const timer = setTimeout(() => {
        sendMessage(inputMessage.trim());
      }, 400);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMessage]);

  // Load session or show greeting when opened
  useEffect(() => {
    if (!isOpen || messages.length > 0) return;

    const saved = loadSession();
    if (saved) {
      setMessages(saved.messages);
      setConversationHistory(saved.history);
      // Show suggestions based on last assistant message
      const lastAssistant = [...saved.messages].reverse().find(m => m.role === 'assistant');
      if (lastAssistant) {
        setSuggestions(getContextualSuggestions(lastAssistant.content, saved.messages.length));
      }
      return;
    }

    // Fresh greeting
    const hour = new Date().getHours();
    let timeGreeting = 'Hey there';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 17) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    setMessages([{
      role: 'assistant',
      content: `${timeGreeting}! I'm Sarah, your OwnerFi guide. Whether you're looking to buy a home without a bank loan or just exploring your options — I'm here to help. What can I tell you?`,
      timestamp: Date.now()
    }]);
  }, [isOpen, messages.length]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const speakText = (text: string) => {
    if (!synthRef.current) return;
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthRef.current.speak(utterance);
  };

  const restartConversation = () => {
    clearSession();
    setMessages([]);
    setConversationHistory([]);
    setSuggestions(STARTER_QUESTIONS);
    setInputMessage('');
    // Trigger fresh greeting on next render
    setTimeout(() => {
      const hour = new Date().getHours();
      let timeGreeting = 'Hey there';
      if (hour < 12) timeGreeting = 'Good morning';
      else if (hour < 17) timeGreeting = 'Good afternoon';
      else timeGreeting = 'Good evening';

      setMessages([{
        role: 'assistant',
        content: `${timeGreeting}! Fresh start. I'm Sarah — what can I help you with?`,
        timestamp: Date.now()
      }]);
    }, 100);
  };

  const sendMessage = useCallback(async (overrideMessage?: string) => {
    const text = (overrideMessage || inputMessage.trim()).slice(0, MAX_INPUT_LENGTH);
    if (!text || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setSuggestions([]);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: conversationHistory.slice(-10)
        }),
        signal: abortControllerRef.current.signal,
      });

      // Handle JSON responses (rate limit, budget exceeded, errors)
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        const reply = data.reply || data.error || "Sorry, something went wrong. Try again?";
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: reply,
          timestamp: Date.now()
        }]);
        setConversationHistory(prev => [
          ...prev.slice(-8),
          { role: 'user', content: text },
          { role: 'assistant', content: reply }
        ]);
        setSuggestions(getContextualSuggestions(reply, msgCountRef.current));
        return;
      }

      // Stream the response
      if (!response.body) throw new Error('No response stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      // Add empty streaming message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true
      }]);

      setIsLoading(false); // Hide typing dots once streaming starts

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;

        const captured = fullResponse; // Avoid closure issues
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
            updated[updated.length - 1] = { ...lastMsg, content: captured };
          }
          return updated;
        });
      }

      // Handle empty response edge case
      if (!fullResponse.trim()) {
        fullResponse = "Hmm, I didn't quite get that out. Could you ask me again?";
      }

      // Mark streaming complete
      const finalResponse = fullResponse;
      setMessages(prev => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          updated[updated.length - 1] = { ...lastMsg, content: finalResponse, isStreaming: false };
        }
        return updated;
      });

      // Update conversation history
      setConversationHistory(prev => [
        ...prev.slice(-8),
        { role: 'user', content: text },
        { role: 'assistant', content: finalResponse }
      ]);

      setSuggestions(getContextualSuggestions(finalResponse, msgCountRef.current));

    } catch (error: unknown) {
      if ((error as Error).name !== 'AbortError') {
        const errorMsg = "Sorry, I had a hiccup! Could you try that again? If this keeps happening, reach out to support@ownerfi.ai.";
        setMessages(prev => {
          // Remove any empty streaming message
          const cleaned = prev.filter(m => !(m.role === 'assistant' && m.isStreaming && !m.content));
          return [...cleaned, {
            role: 'assistant' as const,
            content: errorMsg,
            timestamp: Date.now()
          }];
        });
        setSuggestions(["How does owner financing work?", "Show me properties", "Contact support"]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [inputMessage, isLoading, conversationHistory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  if (!isOpen) return null;

  const charCount = inputMessage.length;
  const nearLimit = charCount > MAX_INPUT_LENGTH * 0.8;

  return (
    <div className={`fixed ${bottomClass || 'bottom-6'} right-6 z-chatbot w-[90vw] max-w-[380px] animate-slide-up`}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200" style={{ height: 'min(580px, 78vh)' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-base">👩</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-semibold text-sm">Sarah</h3>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></div>
                  <span className="text-[10px] text-white/90 font-medium">ONLINE</span>
                </div>
              </div>
              <p className="text-white/80 text-xs">OwnerFi Property Specialist</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Restart conversation */}
            <button
              onClick={restartConversation}
              className="w-7 h-7 text-white/70 hover:text-white hover:bg-white/10 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
              title="Start new conversation"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="w-7 h-7 text-white/70 hover:text-white hover:bg-white/10 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
              title="Minimize chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 overscroll-contain" style={{ backgroundColor: '#f8f9fa' }}>
          {messages.map((message, index) => (
            <div
              key={`${message.timestamp}-${index}`}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                  <span className="text-xs">👩</span>
                </div>
              )}
              <div className="flex flex-col max-w-[80%]">
                <div
                  className={`px-3.5 py-2.5 break-words ${
                    message.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-2xl rounded-br-md'
                      : 'bg-white text-slate-800 border border-slate-100 rounded-2xl rounded-bl-md shadow-sm'
                  }`}
                >
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                    {message.role === 'assistant'
                      ? renderMessageContent(message.content)
                      : message.content
                    }
                    {message.isStreaming && (
                      <span className="inline-block w-1.5 h-4 bg-emerald-500 ml-0.5 animate-pulse rounded-sm" />
                    )}
                  </p>
                  {message.role === 'assistant' && !message.isStreaming && message.content && (
                    <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-100">
                      <button
                        onClick={() => speakText(message.content)}
                        disabled={isSpeaking}
                        className="text-[11px] text-slate-400 hover:text-emerald-600 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728" />
                        </svg>
                        {isSpeaking ? 'Speaking...' : 'Listen'}
                      </button>
                      {isSpeaking && (
                        <button
                          onClick={stopSpeaking}
                          className="text-[11px] text-red-400 hover:text-red-500 transition-colors"
                        >
                          Stop
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {/* Timestamp */}
                <span className={`text-[10px] text-slate-400 mt-0.5 ${message.role === 'user' ? 'text-right' : 'text-left ml-1'}`}>
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                <span className="text-xs">👩</span>
              </div>
              <div className="bg-white text-slate-800 border border-slate-100 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Reply Suggestions */}
          {suggestions.length > 0 && !isLoading && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  disabled={isLoading}
                  className="text-[12px] px-3 py-1.5 bg-white border border-emerald-200 text-emerald-700 rounded-full hover:bg-emerald-50 hover:border-emerald-300 transition-all shadow-sm active:scale-95"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-white border-t border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-400 transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value.slice(0, MAX_INPUT_LENGTH))}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about OwnerFi..."
                  className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                  disabled={isLoading}
                  maxLength={MAX_INPUT_LENGTH}
                />
                <button
                  onClick={startListening}
                  disabled={isListening || isLoading}
                  className={`ml-1 p-1.5 rounded-lg transition-colors ${
                    isListening
                      ? 'text-red-500 bg-red-50'
                      : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                  }`}
                  title="Voice input — will send automatically"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!inputMessage.trim() || isLoading}
              className="w-10 h-10 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-slate-300 disabled:to-slate-300 text-white rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-sm active:scale-95"
              title="Send message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-between mt-1.5 px-1">
            {isListening ? (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-[11px] text-red-500 font-medium">Listening... will send automatically</span>
              </div>
            ) : nearLimit ? (
              <span className="text-[11px] text-amber-500">{charCount}/{MAX_INPUT_LENGTH}</span>
            ) : (
              <span></span>
            )}
            <span className="text-[10px] text-slate-300">Powered by AI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
