import { useState, useRef, useEffect } from 'react';
import { chatService, type ChatMessage } from '../services/chatService';

interface StreamingMessage extends ChatMessage {
  isStreaming?: boolean;
  displayedContent?: string;
}

export default function EnhancedChatBox() {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);





  // Check if backend is available
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Try a simple health check with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        const response = await fetch('http://localhost:8000/health', {
          method: 'GET',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log('✅ Backend connected');
          setIsConnected(true);
        } else {
          console.log('❌ Backend returned error:', response.status);
          setIsConnected(false);
        }
      } catch (error) {
        console.log('❌ Backend not available:', error instanceof Error ? error.message : 'Unknown error');
        setIsConnected(false);
      }
    };

    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Update welcome message based on connection status
  useEffect(() => {
    const welcomeMessage: StreamingMessage = {
      id: 'welcome',
      role: 'assistant',
      content: isConnected 
        ? 'Hello! I\'m your AI assistant. I\'m connected and ready to help. What would you like to know?'
        : 'Hello! I\'m your AI assistant, but I\'m currently disconnected from the backend service. Please make sure your API is running at http://localhost:8000',
      timestamp: new Date()
    };

    setMessages([welcomeMessage]);
  }, [isConnected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: StreamingMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Create AI message placeholder
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessagePlaceholder: StreamingMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      displayedContent: ''
    };

    setMessages(prev => [...prev, aiMessagePlaceholder]);

    try {
      // Real streaming API call
      let fullResponseText = '';
      
      await chatService.sendMessageStream(
        userMessage.content,
        // onChunk - called for each streaming chunk
        (chunk: string) => {
          fullResponseText += chunk;
          setMessages(prev => 
            prev.map(msg => 
              msg.id === aiMessageId 
                ? { 
                    ...msg, 
                    content: fullResponseText,
                    displayedContent: fullResponseText,
                    isStreaming: true 
                  }
                : msg
            )
          );
        },
        // onComplete - called when streaming finishes
        () => {
          setMessages(prev => 
            prev.map(msg => 
              msg.id === aiMessageId 
                ? { 
                    ...msg, 
                    content: fullResponseText,
                    displayedContent: fullResponseText,
                    isStreaming: false 
                  }
                : msg
            )
          );
          setStreamingMessageId(null);
        },
        // onError - called if streaming fails
        (error: Error) => {
          console.error('Streaming error:', error);
          const errorText = 'Sorry, I encountered an error during streaming. Please try again.';
          setMessages(prev => 
            prev.map(msg => 
              msg.id === aiMessageId 
                ? { 
                    ...msg, 
                    content: errorText,
                    displayedContent: errorText,
                    isStreaming: false 
                  }
                : msg
            )
          );
          setStreamingMessageId(null);
        }
      );
      
    } catch (error) {
      console.error('Error starting stream:', error);
      const errorText = 'Sorry, I encountered an error connecting to the AI service. Please check your backend connection.';
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === aiMessageId 
            ? { 
                ...msg, 
                content: errorText,
                displayedContent: errorText,
                isStreaming: false 
              }
            : msg
        )
      );
      
      setStreamingMessageId(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">AI Chat Assistant</h1>
            <p className="text-sm text-gray-500">
              {isConnected ? 'Connected to AI service' : 'Backend disconnected'}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
              }`} />
              <span className="text-sm text-gray-500">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            {!isConnected && (
              <button
                onClick={() => window.location.reload()}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg transition-all duration-300 ease-out ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : `bg-white border text-gray-800 shadow-sm ${
                      message.isStreaming 
                        ? 'shadow-lg border-blue-300 bg-blue-50/30 animate-pulse' 
                        : 'border-gray-200 hover:shadow-md'
                    }`
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">
                {message.role === 'assistant' && message.isStreaming 
                  ? (
                    <span>
                      {message.displayedContent}
                      <span className="inline-block w-0.5 h-4 bg-blue-500 ml-1 animate-[pulse_1s_ease-in-out_infinite] rounded-sm"></span>
                    </span>
                  )
                  : message.displayedContent || message.content
                }
              </div>
              <p className={`text-xs mt-1 ${
                message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
              }`}>
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 max-w-xs lg:max-w-md shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <div className="flex flex-col">
                <span className="text-sm text-gray-600 font-medium">
                  AI is thinking
                </span>
                  <span className="text-xs text-gray-400">
                    Analyzing your request...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isConnected ? "Ask me anything..." : "Backend not connected..."}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            disabled={isLoading || !isConnected}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading || !isConnected}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
        <div className="flex items-center justify-center mt-2">
          <p className="text-xs text-gray-400">
            {isConnected 
              ? 'Press Enter to send • Connected to AI service'
              : 'Waiting for backend at http://localhost:8000 • Check BACKEND_API.md for setup'
            }
          </p>
        </div>
      </div>
    </div>
  );
}