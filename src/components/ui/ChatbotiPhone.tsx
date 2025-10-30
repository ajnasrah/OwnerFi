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
      const greetings = [
        "🤠 Howdy! Welcome to OwnerFi!",
        "👋 Hey there! Welcome in!",
        "😊 Hi! Welcome to OwnerFi!",
        "🏠 Welcome! How can I help?",
        "👋 Hello! Great to see you!"
      ];
      const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
      
      setMessages([{
        role: 'assistant',
        content: randomGreeting,
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
          conversationHistory: conversationHistory.slice(-10)
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
      }
    } catch (error: unknown) {
      if ((error as Error).name !== 'AbortError') {
        
        setError((error as Error).message || 'Connection error. Please try again.');
        const errorMessage: Message = {
          role: 'assistant',
          content: 'Sorry, connection issue. Try again or explore OwnerFi!',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-sm mx-auto max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', height: 'min(600px, 95vh)' }}>
        
        {/* iPhone-style Header */}
        <div className="bg-slate-50 px-3 py-3 flex items-center justify-between border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-base">👩</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-slate-900 font-semibold text-sm">Sarah</h3>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-600 font-medium">LIVE</span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-slate-200 hover:bg-slate-300 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* iPhone Messages Area */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 overscroll-contain" style={{ backgroundColor: '#f8f9fa' }}>
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2.5 rounded-3xl shadow-sm break-words ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-slate-800 border border-slate-100'
                }`}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => speakText(message.content)}
                      disabled={isSpeaking}
                      className="text-xs text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728" />
                      </svg>
                      {isSpeaking ? 'Speaking...' : 'Listen'}
                    </button>
                    {isSpeaking && (
                      <button
                        onClick={stopSpeaking}
                        className="text-xs text-red-500 hover:text-red-600 transition-colors"
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
              <div className="bg-white text-slate-800 border border-slate-100 rounded-3xl px-3 py-2.5 shadow-sm max-w-[80%]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">Sarah is typing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* iPhone-style Input */}
        <div className="p-3 bg-white border-t border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <div className="flex items-center bg-slate-100 rounded-full px-3 h-9">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Sarah..."
                  className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-500 outline-none"
                  disabled={isLoading}
                />
                <button
                  onClick={startListening}
                  disabled={isListening || isLoading}
                  className={`ml-2 p-2 rounded-full transition-colors ${
                    isListening
                      ? 'text-red-500 bg-red-100'
                      : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="w-9 h-9 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white rounded-full flex items-center justify-center transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          
          {isListening && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-red-500">Listening...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}