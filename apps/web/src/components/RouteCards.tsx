// 将导游回答附带的结构化路线渲染为可快速浏览的卡片列表。
import type { RouteCard } from '../types/guide';

type RouteCardsProps = {
  cards: RouteCard[];
};

export function RouteCards({ cards }: RouteCardsProps) {
  if (cards.length === 0) {
    return <p className="empty-state">路线卡片会在导游推荐路线后出现。</p>;
  }

  return (
    <div className="route-cards" aria-label="路线步骤">
      {cards.map((card, index) => (
        <article key={`${card.title}-${index}`} className="route-card">
          <span>{index + 1}</span>
          <div>
            <h3>{card.title}</h3>
            <p className="route-duration">{card.duration}</p>
            <p>{card.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
