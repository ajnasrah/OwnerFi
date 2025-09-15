'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Chatbot({ isOpen, onClose }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string, content: string}>>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      // Initialize speech recognition
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
          setError(null);
        };

        recognitionRef.current.onerror = (event: unknown) => {
          setIsListening(false);
          setError(`Voice recognition error: ${(event as { error: string }).error}`);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }

      // Initialize speech synthesis
      if ('speechSynthesis' in window) {
        synthRef.current = window.speechSynthesis;
      }
      
      setIsInitialized(true);
    }

    // Add initial greeting message only when chatbot opens
    if (isOpen && messages.length === 0) {
      const greeting = "🤖 Hi! I'm OwnerFi's AI assistant. I provide general information only - not real estate advice. OwnerFi is not a licensed broker. How can I help you learn about our platform?";
      
      setMessages([{
        role: 'assistant',
        content: greeting,
        timestamp: new Date()
      }]);
    }
  }, [isOpen, isInitialized, messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
    if (synthRef.current) {
      stopSpeaking();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      synthRef.current.speak(utterance);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: conversationHistory.slice(-10) // Keep only last 10 messages for performance
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.reply) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setConversationHistory(data.conversationHistory?.slice(-10) || []);
        
        // Don't auto-speak - user will click Listen button if they want voice
      }
    } catch (error: unknown) {
      if ((error as Error).name !== 'AbortError') {
        
        setError((error as Error).message || 'Connection error. Please try again.');
        const errorMessage: Message = {
          role: 'assistant',
          content: 'Sorry, I encountered a connection issue. Please check your internet and try again. In the meantime, feel free to explore OwnerFi or sign up to get started!',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-sm mx-4 h-[650px] flex flex-col overflow-hidden">
        {/* Phone-style Header */}
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">🤖</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-slate-900 font-semibold text-lg">AI Assistant</h3>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-blue-600 font-medium">AI BOT</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-100'
                }`}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => speakText(message.content)}
                      disabled={isSpeaking}
                      className="text-xs text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 8l-2 2-2-2" />
                      </svg>
                      {isSpeaking ? 'Speaking...' : 'Listen'}
                    </button>
                    {isSpeaking && (
                      <button
                        onClick={stopSpeaking}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-700 text-slate-100 rounded-2xl px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-xs text-slate-400">OwnerFi Assistant is typing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* AI Disclaimer */}
        <div className="px-4 py-2 bg-blue-50 border-t border-blue-200">
          <p className="text-xs text-blue-700 text-center">
            🤖 AI Assistant - General info only, not real estate advice. OwnerFi is not a licensed broker.
          </p>
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Sarah about OwnerFi..."
                className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={startListening}
                disabled={isListening || isLoading}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-lg transition-colors ${
                  isListening
                    ? 'text-red-400 bg-red-400/20'
                    : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:text-slate-400 text-white p-3 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          
          {isListening && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-red-400">Listening... Speak now</span>
            </div>
          )}
          
          {!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window) && (
            <p className="text-xs text-slate-500 mt-2 text-center">
              Voice features not supported in this browser
            </p>
          )}
        </div>
      </div>
    </div>
  );
}