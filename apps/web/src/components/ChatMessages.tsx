import type { ChatMessage } from '../types/guide';

type ChatMessagesProps = {
  messages: ChatMessage[];
};

export function ChatMessages({ messages }: ChatMessagesProps) {
  if (messages.length === 0) {
    return <p className="empty-state">可以先问我路线、拍照点、开放时间或亲子游安排。</p>;
  }

  return (
    <div className="chat-messages" aria-label="聊天记录">
      {messages.map((message) => (
        <article key={message.id} className={`message message-${message.role}`}>
          <span>{message.role === 'user' ? '游客' : '数字导游'}</span>
          <p>{message.content}</p>
        </article>
      ))}
    </div>
  );
}
