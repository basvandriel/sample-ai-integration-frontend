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

// Stream event types yielded by streamResponse
export type StreamEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

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

  // Removed legacy callback-based sendMessageStream in favor of async generator streamResponse

  // New: Async generator that yields each streaming chunk. Consumer can use for await...of
  async *streamResponse(message: string, signal?: AbortSignal): AsyncGenerator<StreamEvent, void, void> {
    const resp = await fetch(`${this.baseUrl}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal,
    });

    if (!resp.ok) {
      throw new Error(`HTTP error! status: ${resp.status}`);
    }

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();

    try {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Split by newline and process complete lines
        const lines = buffer.split('\n');
        // Keep the last partial line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const contentLine = line.startsWith('data: ') ? line.slice(6) : line;
          if (contentLine === '[DONE]' || contentLine === 'DONE' || contentLine === 'END') {
            yield { type: 'done' };
            return;
          }
          try {
            const parsed = JSON.parse(contentLine);
            if (parsed.done === true) {
              yield { type: 'done' };
              return;
            }
            const content = parsed.content || parsed.message || parsed.text || parsed.delta?.content;
            if (content && typeof content === 'string') {
              yield { type: 'chunk', content };
            }
          } catch {
            // Not JSON, yield raw text (if not a completion marker)
            if (!contentLine.includes('\"done\"')) {
              yield { type: 'chunk', content: contentLine };
            }
          }
        }
      }
      // After stream ends, if buffer contains leftover content, try to parse/yield
      if (buffer.trim()) {
        const contentLine = buffer.startsWith('data: ') ? buffer.slice(6) : buffer;
        try {
          const parsed = JSON.parse(contentLine);
          if (parsed.done === true) {
            yield { type: 'done' };
          } else {
            const content = parsed.content || parsed.message || parsed.text || parsed.delta?.content;
            if (content && typeof content === 'string') {
              yield { type: 'chunk', content };
            }
          }
        } catch {
          if (!contentLine.includes('\"done\"')) {
            yield { type: 'chunk', content: contentLine };
          }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch {}
    }
  }
}

// Create a singleton instance
export const chatService = new ChatService();

// Custom hook for using the chat service
export function useChatService() {
  return chatService;
}
