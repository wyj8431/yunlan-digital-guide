import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types/guide';

const CHAT_LOG_LABEL = '\u804a\u5929\u8bb0\u5f55';
const WELCOME_MESSAGE =
  '\u4f60\u597d\uff0c\u6211\u662f\u4e91\u5c9a\u53e4\u9547\u6570\u5b57\u5bfc\u6e38\u3002\u53ef\u4ee5\u95ee\u6211\u8def\u7ebf\u3001\u62cd\u7167\u70b9\u3001\u5f00\u653e\u65f6\u95f4\u6216\u4eb2\u5b50\u6e38\u5b89\u6392\u3002';

type ChatMessagesProps = {
  messages: ChatMessage[];
};

export function ChatMessages({ messages }: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (typeof container.scrollTo === 'function') {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div
        ref={containerRef}
        className="chat-messages chat-messages-empty"
        aria-label={CHAT_LOG_LABEL}
      >
        <article className="message message-assistant">
          <span>Digital Guide</span>
          <p>{WELCOME_MESSAGE}</p>
        </article>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="chat-messages" aria-label={CHAT_LOG_LABEL}>
      {messages.map((message) => (
        <article
          key={message.id}
          className={`message message-${message.role} ${message.streaming ? 'message-streaming' : ''}`}
        >
          <span>{message.role === 'user' ? 'Visitor' : 'Digital Guide'}</span>
          <p aria-live={message.streaming ? 'polite' : undefined}>
            {message.content}
            {message.streaming ? <i className="typewriter-caret" aria-hidden="true" /> : null}
          </p>
        </article>
      ))}
    </div>
  );
}
