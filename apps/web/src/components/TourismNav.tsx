// 文旅页面的主导航，在桌面侧栏和移动底栏之间复用同一组选项。
import { CalendarDays, Compass, Home, MessageCircle, UserRound } from 'lucide-react';
import type { TourismView } from '../routing/appRoute';

type TourismNavProps = {
  activeView: TourismView;
  onNavigate: (view: TourismView) => void;
};

const NAV_ITEMS = [
  { view: 'home' as const, label: '首页', caption: 'Home', icon: Home },
  { view: 'guide' as const, label: '导览', caption: 'Guide', icon: MessageCircle },
  { view: 'explore' as const, label: '探索', caption: 'Explore', icon: Compass },
  { view: 'itinerary' as const, label: '行程', caption: 'Itinerary', icon: CalendarDays },
  { view: 'profile' as const, label: '我的', caption: 'My', icon: UserRound }
];

function getActiveNavView(view: TourismView) {
  if (view === 'narration' || view === 'voice' || view === 'history') {
    return 'guide';
  }

  if (view === 'map') {
    return 'explore';
  }

  return view;
}

export function TourismNav({ activeView, onNavigate }: TourismNavProps) {
  const activeNavView = getActiveNavView(activeView);

  return (
    <nav className="holo-bottom-nav tourism-bottom-nav" aria-label="主导航">
      {NAV_ITEMS.map(({ view, label, caption, icon: Icon }) => {
        const active = activeNavView === view;

        return (
          <button
            key={view}
            type="button"
            className={active ? 'is-active' : ''}
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(view)}
          >
            <Icon size={view === 'explore' ? 22 : 20} aria-hidden="true" />
            <span>{label}</span>
            <small>{caption}</small>
          </button>
        );
      })}
    </nav>
  );
}
