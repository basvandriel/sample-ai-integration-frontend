// API service for chat functionality
// This will be used to connect to your backend REST API

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatResponse {
  message: string;
}

class ChatService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  async sendMessage(message: string): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async sendMessageStream(
    message: string, 
    onChunk: (chunk: string) => void,  // Receives individual chunks
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          onComplete();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.trim()) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              // Skip completion indicators
              if (data === '[DONE]') {
                onComplete();
                return;
              }
              
              try {
                const parsed = JSON.parse(data);
                
                // Skip completion indicators in JSON format
                if (parsed.done === true) {
                  onComplete();
                  return;
                }
                
                // Extract content from various possible formats
                const content = parsed.content || parsed.message || parsed.text || parsed.delta?.content;
                if (content && typeof content === 'string') {
                  onChunk(content);  // Send individual chunk
                }
              } catch (e) {
                // If not JSON, treat as plain text (but skip completion markers)
                if (data !== 'DONE' && data !== 'END' && !data.includes('"done"')) {
                  onChunk(data);
                }
              }
            } else {
              // Plain text streaming - skip completion indicators
              if (line !== 'DONE' && line !== 'END' && !line.includes('"done"')) {
                onChunk(line);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error streaming message:', error);
      onError(error instanceof Error ? error : new Error('Unknown streaming error'));
    }
  }
}

// Create a singleton instance
export const chatService = new ChatService();

// Custom hook for using the chat service
export function useChatService() {
  return chatService;
}