import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchCozeAgentEvent,
  isCozeAgentEvent,
  subscribeCozeAgentEvents
} from '../src/lib/guideSpeechSync';

describe('Coze agent event contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches and subscribes to typed text and command messages', () => {
    const received: unknown[] = [];
    const unsubscribe = subscribeCozeAgentEvents((detail) => received.push(detail));

    dispatchCozeAgentEvent({
      role: 'assistant',
      content: '乌镇欢迎你',
      type: 'text',
      timestamp: Date.now()
    });
    dispatchCozeAgentEvent({
      role: 'assistant',
      content: '{"emotion":"warm"}',
      type: 'command',
      timestamp: Date.now()
    });
    unsubscribe();

    expect(received).toHaveLength(2);
    expect(received[0]).toMatchObject({ role: 'assistant', type: 'text' });
    expect(received[1]).toMatchObject({ role: 'assistant', type: 'command' });
  });

  it('rejects malformed event details', () => {
    const event = new CustomEvent('yunlan:coze-agent-event', {
      detail: { role: 'assistant', content: 'x', type: 'invalid', timestamp: 'now' }
    });

    expect(isCozeAgentEvent(event)).toBe(false);
  });
});
