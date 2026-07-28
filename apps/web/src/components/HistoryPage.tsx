import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock3, History, MessageCircle, Play, Trash2 } from 'lucide-react';
import type { TourismView } from '../routing/appRoute';
import type { GuideChatSession } from '../types/guide';
import { ChatMessages } from './ChatMessages';
import { TourismNav } from './TourismNav';

type HistoryPageProps = {
  sessions: GuideChatSession[];
  activeSessionId: string | null;
  onNavigate: (view: TourismView) => void;
  onResume: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onClear: () => void;
};

function formatSessionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function resolveSelectedSessionId(sessions: GuideChatSession[], activeSessionId: string | null) {
  if (activeSessionId && sessions.some((session) => session.id === activeSessionId)) {
    return activeSessionId;
  }

  return sessions[0]?.id ?? null;
}

export function HistoryPage({
  sessions,
  activeSessionId,
  onNavigate,
  onResume,
  onDelete,
  onClear
}: HistoryPageProps) {
  const [selectedSessionId, setSelectedSessionId] = useState(() =>
    resolveSelectedSessionId(sessions, activeSessionId)
  );

  useEffect(() => {
    if (!sessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(resolveSelectedSessionId(sessions, activeSessionId));
    }
  }, [activeSessionId, selectedSessionId, sessions]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  return (
    <main className="tourism-page history-page" data-tourism-page="history">
      <header className="tourism-page-header history-page-header">
        <button type="button" className="tourism-page-back" onClick={() => onNavigate('explore')}>
          <ArrowLeft size={19} aria-hidden="true" />
          <span>返回对话</span>
        </button>
        <div className="tourism-page-brand">
          <strong>智慧文旅 · 全息导游</strong>
          <small>Conversation Archive</small>
        </div>
      </header>

      <section className="history-page-content" aria-labelledby="history-page-title">
        <div className="history-page-heading">
          <span>GUIDE / HISTORY</span>
          <h1 id="history-page-title">对话历史</h1>
          <p>回看旅行问题与数字导游回答，随时接着上一次对话继续问。</p>
        </div>

        {sessions.length === 0 ? (
          <section className="history-empty" aria-label="暂无历史记录">
            <History size={34} aria-hidden="true" />
            <h2>还没有对话记录</h2>
            <p>在探索页向数字导游提问后，对话会自动保存在当前浏览器中。</p>
            <button type="button" onClick={() => onNavigate('explore')}>
              <MessageCircle size={18} aria-hidden="true" />
              开始对话
            </button>
          </section>
        ) : (
          <div className="history-workspace">
            <aside className="history-session-panel" aria-label="历史会话列表">
              <div className="history-session-toolbar">
                <strong>{sessions.length} 次对话</strong>
                <button type="button" onClick={onClear}>
                  <Trash2 size={16} aria-hidden="true" />
                  清空全部
                </button>
              </div>
              <div className="history-session-list">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={session.id === selectedSessionId ? 'is-selected' : ''}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <strong>{session.title}</strong>
                    <span>
                      <Clock3 size={14} aria-hidden="true" />
                      {formatSessionTime(session.updatedAt)}
                    </span>
                    <small>{session.messages.length} 条消息</small>
                  </button>
                ))}
              </div>
            </aside>

            {selectedSession ? (
              <section className="history-transcript" aria-label="对话内容">
                <header>
                  <div>
                    <span>当前记录</span>
                    <h2>{selectedSession.title}</h2>
                  </div>
                  <div className="history-transcript-actions">
                    <button type="button" onClick={() => onResume(selectedSession.id)}>
                      <Play size={17} aria-hidden="true" />
                      继续这次对话
                    </button>
                    <button
                      type="button"
                      className="history-delete-button"
                      aria-label="删除当前记录"
                      title="删除当前记录"
                      onClick={() => onDelete(selectedSession.id)}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                </header>
                <ChatMessages messages={selectedSession.messages} autoScroll={false} />
              </section>
            ) : null}
          </div>
        )}
      </section>

      <TourismNav activeView="history" onNavigate={onNavigate} />
    </main>
  );
}
