import { useEffect, useState } from 'react';
import { fetchScenicArea } from './api/guideApi';
import { DigitalHumanStage } from './components/DigitalHumanStage';
import { GuidePanel } from './components/GuidePanel';
import { HistoryPage } from './components/HistoryPage';
import { HomeDestinationLinks } from './components/HomeDestinationLinks';
import { ScenicPanel } from './components/ScenicPanel';
import { TourismNav } from './components/TourismNav';
import { TourismPage } from './components/TourismPage';
import { useGuideChat } from './hooks/useGuideChat';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import type { TourismView } from './routing/appRoute';
import type { ScenicAreaSummary } from './types/guide';
import type { SpeechDriver } from './types/virtualHuman';
import { useVoiceGuideSession } from './voice/useVoiceGuideSession';
import './styles.css';

type AppProps = {
  activeView?: TourismView;
  onNavigate?: (view: TourismView) => void;
};

const ignoreNavigation = () => {};

export function App({ activeView = 'explore', onNavigate = ignoreNavigation }: AppProps) {
  const [scenicArea, setScenicArea] = useState<ScenicAreaSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [speechDriver, setSpeechDriver] = useState<SpeechDriver>('browser');
  const chat = useGuideChat();
  const speech = useSpeechSynthesis();
  const { speak, speaking } = speech;
  const voice = useVoiceGuideSession({
    onFinalTranscript: (sessionId, text) => {
      chat.beginExternalQuestion(sessionId, text);
    },
    onAnswer: (sessionId, response) => {
      chat.completeExternalQuestion(sessionId, response);
    },
    onError: (sessionId, message) => {
      chat.failExternalQuestion(sessionId, message);
    }
  });

  useEffect(() => {
    fetchScenicArea()
      .then(setScenicArea)
      .catch(() => setLoadError('景区资料加载失败，请确认后端服务已启动。'));
  }, []);

  useEffect(() => {
    if (chat.latestAnswer && speechDriver === 'browser') {
      speak(chat.latestAnswer);
    }
  }, [chat.latestAnswer, speak, speechDriver]);

  if (activeView === 'history') {
    return (
      <HistoryPage
        sessions={chat.historySessions}
        activeSessionId={chat.activeSessionId}
        onNavigate={onNavigate}
        onResume={(sessionId) => {
          if (chat.openConversation(sessionId)) {
            onNavigate('explore');
          }
        }}
        onDelete={chat.deleteConversation}
        onClear={chat.clearConversationHistory}
      />
    );
  }

  if (loadError) {
    return <main className="app-shell app-centered">{loadError}</main>;
  }

  if (!scenicArea) {
    return <main className="app-shell app-centered">正在加载乌镇景区资料...</main>;
  }

  const visibleRouteCards =
    chat.routeCards.length > 0
      ? chat.routeCards
      : scenicArea.routes.map((route) => ({
          type: 'route-step' as const,
          title: route.name,
          duration: route.duration,
          description: route.description
        }));

  if (activeView !== 'explore') {
    return (
      <TourismPage
        view={activeView}
        scenicArea={scenicArea}
        routeCards={visibleRouteCards}
        latestAnswer={chat.latestAnswer}
        voice={voice}
        onNavigate={onNavigate}
        onAsk={chat.ask}
        onToggleVoice={voice.toggle}
      />
    );
  }

  return (
    <main className="app-shell">
      <HomeDestinationLinks />
      <header className="app-title">
        <div className="app-title-row">
          <span aria-hidden="true" />
          <h1>智慧文旅 · 全息导游</h1>
          <span aria-hidden="true" />
        </div>
        <p>Smart Cultural Tourism · Holographic Guide</p>
      </header>

      <GuidePanel
        scenicArea={scenicArea}
        messages={chat.messages}
        loading={chat.loading}
        error={chat.error}
        onAsk={chat.ask}
        voice={voice}
        onNewConversation={chat.startNewConversation}
        onOpenHistory={() => onNavigate('history')}
      />

      <section className="digital-human-panel" aria-label="3D 数字人展示区">
        <DigitalHumanStage
          speaking={speaking || chat.loading}
          answerText={chat.latestAnswer}
          speechTimeline={chat.speechTimeline}
          onSpeechDriverChange={setSpeechDriver}
          onNavigate={onNavigate}
        />
      </section>

      <ScenicPanel scenicArea={scenicArea} routeCards={chat.routeCards} />
      <TourismNav activeView="explore" onNavigate={onNavigate} />
    </main>
  );
}
