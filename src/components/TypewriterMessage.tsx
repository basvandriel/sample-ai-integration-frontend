import { useTypewriterStream } from './useTypewriterStream';

interface TypewriterMessageProps {
  content: string;
  isStreaming?: boolean;
}

export function TypewriterMessage({ content, isStreaming }: TypewriterMessageProps) {
  const animated = useTypewriterStream(content, 5);
  return (
    <>
      {animated}
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 bg-blue-500 ml-1 rounded-sm"></span>
      )}
    </>
  );
}
