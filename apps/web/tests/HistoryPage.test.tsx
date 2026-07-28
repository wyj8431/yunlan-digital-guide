import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryPage } from '../src/components/HistoryPage';
import type { GuideChatSession } from '../src/types/guide';

const sessions: GuideChatSession[] = [
  {
    id: 'session-2',
    title: '西湖亲子游怎么安排',
    createdAt: '2026-07-27T09:00:00.000Z',
    updatedAt: '2026-07-27T09:10:00.000Z',
    messages: [
      { id: 'u2', role: 'user', content: '西湖亲子游怎么安排？' },
      { id: 'a2', role: 'assistant', content: '建议上午游苏堤，下午去花港观鱼。' }
    ]
  },
  {
    id: 'session-1',
    title: '乌镇夜游路线',
    createdAt: '2026-07-26T09:00:00.000Z',
    updatedAt: '2026-07-26T09:05:00.000Z',
    messages: [
      { id: 'u1', role: 'user', content: '规划乌镇夜游路线' },
      { id: 'a1', role: 'assistant', content: '傍晚从西栅入口开始。' }
    ]
  }
];

afterEach(cleanup);

describe('HistoryPage', () => {
  it('shows saved conversations and lets the visitor inspect a transcript', () => {
    render(
      <HistoryPage
        sessions={sessions}
        activeSessionId="session-2"
        onNavigate={vi.fn()}
        onResume={vi.fn()}
        onDelete={vi.fn()}
        onClear={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: '对话历史' })).toBeInTheDocument();
    expect(screen.getByText('建议上午游苏堤，下午去花港观鱼。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /乌镇夜游路线/ }));

    expect(screen.getByText('傍晚从西栅入口开始。')).toBeInTheDocument();
  });

  it('can resume and delete the selected conversation', () => {
    const onResume = vi.fn();
    const onDelete = vi.fn();

    render(
      <HistoryPage
        sessions={sessions}
        activeSessionId="session-2"
        onNavigate={vi.fn()}
        onResume={onResume}
        onDelete={onDelete}
        onClear={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '继续这次对话' }));
    expect(onResume).toHaveBeenCalledWith('session-2');

    fireEvent.click(screen.getByRole('button', { name: '删除当前记录' }));
    expect(onDelete).toHaveBeenCalledWith('session-2');
  });

  it('renders an empty state without destructive controls', () => {
    render(
      <HistoryPage
        sessions={[]}
        activeSessionId={null}
        onNavigate={vi.fn()}
        onResume={vi.fn()}
        onDelete={vi.fn()}
        onClear={vi.fn()}
      />
    );

    expect(screen.getByText('还没有对话记录')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '清空全部' })).not.toBeInTheDocument();
  });

  it('selects the newest saved session when the current chat has not been saved yet', () => {
    render(
      <HistoryPage
        sessions={sessions}
        activeSessionId="new-empty-session"
        onNavigate={vi.fn()}
        onResume={vi.fn()}
        onDelete={vi.fn()}
        onClear={vi.fn()}
      />
    );

    expect(screen.getByText('建议上午游苏堤，下午去花港观鱼。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '继续这次对话' })).toBeInTheDocument();
  });
});
