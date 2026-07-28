import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearGuideChatHistory,
  loadGuideChatHistory,
  removeGuideChatHistory,
  saveGuideChatHistory
} from '../src/lib/guideChatHistory';

describe('guideChatHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists messages without keeping image data URLs or streaming state', () => {
    saveGuideChatHistory({
      id: 'session-1',
      title: '分析西湖照片',
      createdAt: '2026-07-27T10:00:00.000Z',
      updatedAt: '2026-07-27T10:01:00.000Z',
      messages: [
        {
          id: 'message-1',
          role: 'user',
          content: '这是什么景点？',
          attachmentName: 'west-lake.png',
          attachmentKind: 'image',
          attachmentPreviewUrl: 'data:image/png;base64,secret-image'
        },
        {
          id: 'message-2',
          role: 'assistant',
          content: '这是西湖。',
          streaming: true
        }
      ]
    });

    expect(JSON.stringify(localStorage)).not.toContain('secret-image');
    expect(loadGuideChatHistory()).toEqual([
      {
        id: 'session-1',
        title: '分析西湖照片',
        createdAt: '2026-07-27T10:00:00.000Z',
        updatedAt: '2026-07-27T10:01:00.000Z',
        messages: [
          {
            id: 'message-1',
            role: 'user',
            content: '这是什么景点？',
            attachmentName: 'west-lake.png',
            attachmentKind: 'image'
          },
          {
            id: 'message-2',
            role: 'assistant',
            content: '这是西湖。'
          }
        ]
      }
    ]);
  });

  it('orders updated sessions first and supports removing or clearing history', () => {
    saveGuideChatHistory({
      id: 'older',
      title: '旧会话',
      createdAt: '2026-07-27T08:00:00.000Z',
      updatedAt: '2026-07-27T08:10:00.000Z',
      messages: [{ id: 'old-1', role: 'user', content: '旧问题' }]
    });
    saveGuideChatHistory({
      id: 'newer',
      title: '新会话',
      createdAt: '2026-07-27T09:00:00.000Z',
      updatedAt: '2026-07-27T09:10:00.000Z',
      messages: [{ id: 'new-1', role: 'user', content: '新问题' }]
    });

    expect(loadGuideChatHistory().map((session) => session.id)).toEqual(['newer', 'older']);

    removeGuideChatHistory('newer');
    expect(loadGuideChatHistory().map((session) => session.id)).toEqual(['older']);

    clearGuideChatHistory();
    expect(loadGuideChatHistory()).toEqual([]);
  });

  it('recovers from malformed browser storage', () => {
    localStorage.setItem('yunlan-guide-chat-history-v1', '{bad json');

    expect(loadGuideChatHistory()).toEqual([]);
  });
});
