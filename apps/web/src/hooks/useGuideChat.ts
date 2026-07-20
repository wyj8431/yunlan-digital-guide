import { useCallback, useState } from 'react';
import { askGuide } from '../api/guideApi';
import type { ChatMessage, RouteCard } from '../types/guide';

export function useGuideChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [routeCards, setRouteCards] = useState<RouteCard[]>([]);
  const [latestAnswer, setLatestAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(
    async (message: string) => {
      const trimmed = message.trim();

      if (!trimmed || loading) {
        return;
      }

      setLoading(true);
      setError(null);
      setLatestAnswer('');
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'user', content: trimmed }
      ]);

      try {
        const response = await askGuide(trimmed);
        setLatestAnswer(response.answer);
        setMessages((current) => [
          ...current,
          { id: crypto.randomUUID(), role: 'assistant', content: response.answer }
        ]);
        setRouteCards(response.cards);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : '数字导游暂时没有回答成功');
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  return { messages, routeCards, latestAnswer, loading, error, ask };
}
