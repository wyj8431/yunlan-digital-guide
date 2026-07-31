// 中央语音按钮根据会话状态切换开始、停止和错误提示。
import { Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type CenterVoiceControlProps = {
  disabled: boolean;
  onAsk: (question: string) => void;
};

type VoiceState = 'idle' | 'listening' | 'unsupported' | 'error';

export function CenterVoiceControl({ disabled, onAsk }: CenterVoiceControlProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [hint, setHint] = useState('按住说话');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');

  const voiceSupported =
    typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (!voiceSupported) {
      setVoiceState('unsupported');
      setHint('当前浏览器不支持语音输入');
    }

    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, [voiceSupported]);

  function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }

    onAsk(trimmed);
    setHint('已发送');
  }

  function start() {
    if (disabled || voiceState === 'listening') {
      return;
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceState('unsupported');
      setHint('当前浏览器不支持语音输入');
      return;
    }

    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';

    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interimText = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result[0];

        if (!alternative) {
          continue;
        }

        if (result.isFinal) {
          finalTranscriptRef.current += alternative.transcript;
        } else {
          interimText += alternative.transcript;
        }
      }

      interimTranscriptRef.current = interimText;
      const spokenText = (finalTranscriptRef.current || interimTranscriptRef.current).trim();
      if (spokenText) {
        setHint('松开后自动发送');
      }
    };
    recognition.onend = () => {
      setVoiceState('idle');
      recognitionRef.current = null;

      const spokenText = (finalTranscriptRef.current || interimTranscriptRef.current).trim();
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';

      if (spokenText) {
        submitQuestion(spokenText);
        return;
      }

      setHint('按住说话');
    };
    recognition.onerror = () => {
      setVoiceState('error');
      recognitionRef.current = null;
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      setHint('语音识别失败');
    };

    recognitionRef.current = recognition;
    setVoiceState('listening');
    setHint('正在聆听');
    recognition.start();
  }

  function stop() {
    recognitionRef.current?.stop();
  }

  return (
    <div className="center-voice-control">
      <div className="voice-meter" aria-hidden="true">
        {voiceState === 'listening' ? <span /> : null}
      </div>
      <button
        type="button"
        className={`voice-orb voice-orb--${voiceState}`}
        disabled={disabled || !voiceSupported}
        onMouseDown={start}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchEnd={stop}
        aria-label="语音提问"
      >
        {voiceState === 'listening' ? <Square size={30} /> : <Mic size={34} />}
      </button>
      <span className="voice-caption">{voiceState === 'listening' ? '松开 结束' : '按住说话'}</span>
      <small className="voice-hint">{hint}</small>
    </div>
  );
}
