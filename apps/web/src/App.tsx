import { useEffect, useState } from 'react';
import { fetchScenicArea } from './api/guideApi';
import { DigitalHumanStage } from './components/DigitalHumanStage';
import { GuidePanel } from './components/GuidePanel';
import { useGuideChat } from './hooks/useGuideChat';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import type { ScenicAreaSummary } from './types/guide';
import type { SpeechDriver } from './types/virtualHuman';
import './styles.css';

export function App() {
  const [scenicArea, setScenicArea] = useState<ScenicAreaSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [speechDriver, setSpeechDriver] = useState<SpeechDriver>('browser');
  const chat = useGuideChat();
  const speech = useSpeechSynthesis();

  useEffect(() => {
    fetchScenicArea()
      .then(setScenicArea)
      .catch(() => setLoadError('景区资料加载失败，请确认后端服务已启动。'));
  }, []);

  useEffect(() => {
    if (chat.latestAnswer && speechDriver === 'browser') {
      speech.speak(chat.latestAnswer);
    }
  }, [chat.latestAnswer, speech, speechDriver]);

  if (loadError) {
    return <main className="app-shell app-centered">{loadError}</main>;
  }

  if (!scenicArea) {
    return <main className="app-shell app-centered">正在加载云岚古镇资料...</main>;
  }

  return (
    <main className="app-shell">
      <GuidePanel
        scenicArea={scenicArea}
        messages={chat.messages}
        routeCards={chat.routeCards}
        loading={chat.loading}
        error={chat.error}
        onAsk={chat.ask}
      />
      <section className="digital-human-panel" aria-label="3D 数字人展示区">
        <DigitalHumanStage
          speaking={speech.speaking}
          answerText={chat.latestAnswer}
          onSpeechDriverChange={setSpeechDriver}
        />
      </section>
    </main>
  );
}
