import { FileText, FileUp, Mic, Send, Square, X } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { transcribeSpeechAudio } from '../api/speechApi';
import type { GuideAttachment, GuideAttachmentKind } from '../types/guide';

// 提问组件统一管理文本、附件、浏览器语音识别和录音上传四种输入路径。
import type { VoiceGuideState } from '../voice/useVoiceGuideSession';

type QuestionInputProps = {
  disabled: boolean;
  onAsk: (question: string, attachment?: GuideAttachment | null) => void;
  voice?: VoiceGuideState;
};

type VoiceState = 'idle' | 'listening' | 'processing' | 'unsupported' | 'error';

type BrowserWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const NO_SPEECH_TIMEOUT_MS = 7000;
const SILENCE_AUTO_SEND_MS = 1300;
const MANUAL_STOP_FALLBACK_MS = 700;
const VOICE_RMS_THRESHOLD = 0.025;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const HINT_READY =
  '\u53ef\u4ee5\u76f4\u63a5\u8f93\u5165\uff0c\u4e5f\u53ef\u4ee5\u6309\u9ea6\u514b\u98ce\u8bf4\u5b8c\u81ea\u52a8\u53d1\u9001\u3002';
const HINT_SENT = '\u5df2\u53d1\u9001\uff0c\u6b63\u5728\u7b49\u5f85\u56de\u590d\u3002';
const HINT_NO_RECORDING =
  '\u6ca1\u6709\u5f55\u5230\u58f0\u97f3\uff0c\u53ef\u4ee5\u518d\u8bf4\u4e00\u6b21\u6216\u76f4\u63a5\u8f93\u5165\u3002';
const HINT_RECOGNIZING = '\u6b63\u5728\u8bc6\u522b\u8bed\u97f3...';
const HINT_EMPTY_TRANSCRIPT =
  '\u6ca1\u6709\u8bc6\u522b\u5230\u5185\u5bb9\uff0c\u53ef\u4ee5\u518d\u8bf4\u4e00\u6b21\u6216\u76f4\u63a5\u8f93\u5165\u3002';
const HINT_VOICE_SENT =
  '\u5df2\u53d1\u9001\u8bed\u97f3\u95ee\u9898\uff0c\u6b63\u5728\u7b49\u5f85\u56de\u590d\u3002';
const HINT_RECOGNITION_FAILED =
  '\u8bed\u97f3\u8bc6\u522b\u5931\u8d25\uff0c\u8bf7\u518d\u8bd5\u4e00\u6b21\u3002';
const HINT_LISTENING_AUTO_SEND =
  '\u6b63\u5728\u8046\u542c\uff0c\u505c\u987f\u4e00\u4e0b\u4f1a\u81ea\u52a8\u53d1\u9001\u3002';
const HINT_RECORDING_FAILED =
  '\u5f55\u97f3\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u9ea6\u514b\u98ce\u6743\u9650\u540e\u518d\u8bd5\u3002';
const HINT_LISTENING =
  '\u6b63\u5728\u8046\u542c\uff0c\u8bf7\u8bf4\u5b8c\u6574\u7684\u95ee\u9898\u3002';
const HINT_NO_SPEECH =
  '\u6ca1\u6709\u542c\u5230\u58f0\u97f3\uff0c\u53ef\u4ee5\u518d\u8bf4\u4e00\u6b21\u6216\u76f4\u63a5\u8f93\u5165\u3002';
const HINT_MIC_PERMISSION =
  '\u9ea6\u514b\u98ce\u6743\u9650\u4e0d\u53ef\u7528\uff0c\u8bf7\u5141\u8bb8\u6d4f\u89c8\u5668\u4f7f\u7528\u9ea6\u514b\u98ce\u3002';
const HINT_UNSUPPORTED =
  '\u5f53\u524d\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u8bed\u97f3\u8f93\u5165\uff0c\u53ef\u4ee5\u76f4\u63a5\u6253\u5b57\u63d0\u95ee\u3002';
const HINT_HEARD =
  '\u5df2\u542c\u5230\uff0c\u505c\u987f\u4e00\u4e0b\u4f1a\u81ea\u52a8\u53d1\u9001\u3002';
const HINT_NO_MATCH =
  '\u6ca1\u6709\u542c\u6e05\uff0c\u53ef\u4ee5\u518d\u8bf4\u4e00\u6b21\u6216\u76f4\u63a5\u8f93\u5165\u3002';
const HINT_RECOGNITION_PERMISSION_FAILED =
  '\u8bed\u97f3\u8bc6\u522b\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u9ea6\u514b\u98ce\u6743\u9650\u540e\u518d\u8bd5\u3002';
const HINT_RECOGNITION_START_FAILED =
  '\u8bed\u97f3\u8bc6\u522b\u542f\u52a8\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u6216\u68c0\u67e5\u9ea6\u514b\u98ce\u6743\u9650\u3002';
const PLACEHOLDER_SCENIC_QUESTION = '\u8be2\u95ee\u666f\u533a\u4fe1\u606f...';
const INPUT_LABEL = '\u5411\u6570\u5b57\u5bfc\u6e38\u63d0\u95ee';
const VOICE_INPUT_LABEL = '\u8bed\u97f3\u8f93\u5165';
const STOP_VOICE_INPUT_LABEL = '\u505c\u6b62\u8bed\u97f3\u8f93\u5165';
const SEND_QUESTION_LABEL = '\u53d1\u9001\u95ee\u9898';
const ATTACH_FILE_LABEL = '上传图片或文档';
const ATTACHMENT_FILE_INPUT_LABEL = '选择附件文件';
const REMOVE_ATTACHMENT_LABEL = '移除附件';
const HINT_ATTACHMENT_READY = '附件已添加，可以输入问题并发送。';
const HINT_ATTACHMENT_TOO_LARGE = '附件太大，请压缩到 10MB 以内再发送。';
const HINT_ATTACHMENT_UNSUPPORTED =
  '仅支持 PNG、JPG、WebP、Word、PowerPoint、Excel、CSV 和 Markdown 文件。';
const ATTACHMENT_ACCEPT = [
  'image/png',
  'image/jpeg',
  'image/webp',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.csv',
  '.md'
].join(',');
const ATTACHMENT_TYPES: Record<string, { kind: GuideAttachmentKind; mimeType: string }> = {
  png: { kind: 'image', mimeType: 'image/png' },
  jpg: { kind: 'image', mimeType: 'image/jpeg' },
  jpeg: { kind: 'image', mimeType: 'image/jpeg' },
  webp: { kind: 'image', mimeType: 'image/webp' },
  doc: { kind: 'document', mimeType: 'application/msword' },
  docx: {
    kind: 'document',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  },
  ppt: { kind: 'presentation', mimeType: 'application/vnd.ms-powerpoint' },
  pptx: {
    kind: 'presentation',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  },
  xls: { kind: 'spreadsheet', mimeType: 'application/vnd.ms-excel' },
  xlsx: {
    kind: 'spreadsheet',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  },
  csv: { kind: 'spreadsheet', mimeType: 'text/csv' },
  md: { kind: 'markdown', mimeType: 'text/markdown' }
};

function getAttachmentType(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ATTACHMENT_TYPES[extension] ?? null;
}

async function readGuideAttachment(file: File): Promise<GuideAttachment> {
  // 前端只读取并编码附件，真实内容解析和安全校验仍由服务端执行。
  const attachmentType = getAttachmentType(file);
  if (!attachmentType) {
    throw new Error(HINT_ATTACHMENT_UNSUPPORTED);
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(HINT_ATTACHMENT_TOO_LARGE);
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(HINT_ATTACHMENT_UNSUPPORTED));
    reader.readAsDataURL(file);
  });
  const dataUrl = rawDataUrl.replace(
    /^data:[^;,]*;base64,/,
    `data:${attachmentType.mimeType};base64,`
  );

  return {
    name: file.name,
    mimeType: attachmentType.mimeType,
    kind: attachmentType.kind,
    dataUrl,
    sizeBytes: file.size
  };
}

function chooseRecorderMimeType(): string {
  // 按浏览器支持顺序选择录音格式，保证 Safari 和 Chromium 都能工作。
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  for (const mimeType of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return '';
}

export function QuestionInput({ disabled, onAsk, voice }: QuestionInputProps) {
  // 多个 ref 保存异步回调需要读取的最新状态，避免闭包使用过期值。
  const [question, setQuestion] = useState('');
  const [attachment, setAttachment] = useState<GuideAttachment | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceHint, setVoiceHint] = useState(HINT_READY);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const monitorFrameRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const speechDetectedRef = useRef(false);
  const lastVoiceAtRef = useRef(0);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const voiceFinishedRef = useRef(false);
  const noSpeechTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const manualStopTimerRef = useRef<number | null>(null);

  const recorderSupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined';
  const speechRecognitionSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const legacyVoiceSupported = recorderSupported || speechRecognitionSupported;
  const streamingVoiceActive = Boolean(voice && !['idle', 'error'].includes(voice.status));
  const effectiveVoiceSupported = voice
    ? voice.supported || legacyVoiceSupported
    : legacyVoiceSupported;
  const effectiveVoiceState: VoiceState = streamingVoiceActive
    ? voice?.status === 'thinking' || voice?.status === 'speaking'
      ? 'processing'
      : 'listening'
    : voice?.status === 'error'
      ? 'error'
      : voiceState;
  const effectiveVoiceHint = voice?.error
    ? voice.error
    : voice?.transcript
      ? HINT_HEARD
      : streamingVoiceActive
        ? HINT_LISTENING_AUTO_SEND
        : voiceHint;

  function clearTimer(timerRef: MutableRefObject<number | null>) {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function clearVoiceTimers() {
    clearTimer(noSpeechTimerRef);
    clearTimer(silenceTimerRef);
    clearTimer(manualStopTimerRef);
  }

  function cancelVolumeMonitor() {
    if (monitorFrameRef.current !== null) {
      window.cancelAnimationFrame(monitorFrameRef.current);
      monitorFrameRef.current = null;
    }
  }

  function stopMediaResources() {
    cancelVolumeMonitor();
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
  }

  function readSpokenText() {
    return (finalTranscriptRef.current || interimTranscriptRef.current).trim();
  }

  function resetTranscript() {
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
  }

  function submitQuestion(
    nextQuestion: string,
    nextHint = HINT_SENT,
    nextAttachment: GuideAttachment | null = attachment
  ) {
    const trimmed = nextQuestion.trim();

    if (!trimmed && !nextAttachment) {
      return;
    }

    onAsk(trimmed, nextAttachment);
    setQuestion('');
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setVoiceHint(nextHint);
  }

  async function handleRecordingStop(mimeType: string) {
    clearVoiceTimers();
    stopMediaResources();

    if (discardRecordingRef.current) {
      audioChunksRef.current = [];
      discardRecordingRef.current = false;
      setVoiceState('idle');
      return;
    }

    const chunks = audioChunksRef.current;
    audioChunksRef.current = [];

    if (chunks.length === 0) {
      setVoiceState('idle');
      setVoiceHint(HINT_NO_RECORDING);
      return;
    }

    setVoiceState('processing');
    setVoiceHint(HINT_RECOGNIZING);

    try {
      const text = (
        await transcribeSpeechAudio(new Blob(chunks, { type: mimeType || 'audio/webm' }))
      ).trim();

      if (!text) {
        setVoiceState('idle');
        setVoiceHint(HINT_EMPTY_TRANSCRIPT);
        return;
      }

      setQuestion(text);
      submitQuestion(text, HINT_VOICE_SENT);
      setVoiceState('idle');
    } catch (caught) {
      setVoiceState('error');
      setVoiceHint(caught instanceof Error ? caught.message : HINT_RECOGNITION_FAILED);
    }
  }

  function stopMediaRecording() {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === 'inactive') {
      return;
    }

    clearVoiceTimers();
    recorder.stop();
  }

  function discardMediaRecording(hint: string) {
    discardRecordingRef.current = true;
    setVoiceHint(hint);
    stopMediaRecording();
  }

  function monitorVolume(analyser: AnalyserNode) {
    const data = new Uint8Array(analyser.fftSize);

    function tick() {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== 'recording') {
        return;
      }

      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const sample of data) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / data.length);
      const now = Date.now();
      if (rms >= VOICE_RMS_THRESHOLD) {
        speechDetectedRef.current = true;
        lastVoiceAtRef.current = now;
        clearTimer(noSpeechTimerRef);
        setVoiceHint(HINT_LISTENING_AUTO_SEND);
      }

      if (speechDetectedRef.current && now - lastVoiceAtRef.current >= SILENCE_AUTO_SEND_MS) {
        stopMediaRecording();
        return;
      }

      monitorFrameRef.current = window.requestAnimationFrame(tick);
    }

    monitorFrameRef.current = window.requestAnimationFrame(tick);
  }

  async function startMediaRecorderInput() {
    clearVoiceTimers();
    audioChunksRef.current = [];
    discardRecordingRef.current = false;
    speechDetectedRef.current = false;
    lastVoiceAtRef.current = Date.now();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      const mimeType = chooseRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const AudioContextCtor = window.AudioContext ?? (window as BrowserWindow).webkitAudioContext;

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        audioContextRef.current = audioContext;
        monitorVolume(analyser);
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        void handleRecordingStop(recorder.mimeType || mimeType);
      };
      recorder.onerror = () => {
        stopMediaResources();
        setVoiceState('error');
        setVoiceHint(HINT_RECORDING_FAILED);
      };

      setVoiceState('listening');
      setVoiceHint(HINT_LISTENING);
      noSpeechTimerRef.current = window.setTimeout(() => {
        discardMediaRecording(HINT_NO_SPEECH);
      }, NO_SPEECH_TIMEOUT_MS);
      recorder.start(250);
    } catch {
      stopMediaResources();
      setVoiceState('error');
      setVoiceHint(HINT_MIC_PERMISSION);
    }
  }

  function finishSpeechRecognition(emptyHint = HINT_EMPTY_TRANSCRIPT) {
    if (voiceFinishedRef.current) {
      return;
    }

    voiceFinishedRef.current = true;
    clearVoiceTimers();
    setVoiceState('idle');
    recognitionRef.current = null;

    const spokenText = readSpokenText();
    resetTranscript();

    if (spokenText) {
      submitQuestion(spokenText, HINT_VOICE_SENT);
      return;
    }

    setVoiceHint(emptyHint);
  }

  function scheduleRecognitionSilenceAutoSend() {
    clearTimer(silenceTimerRef);
    silenceTimerRef.current = window.setTimeout(() => {
      recognitionRef.current?.stop();
      finishSpeechRecognition();
    }, SILENCE_AUTO_SEND_MS);
  }

  function startSpeechRecognitionInput() {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceState('unsupported');
      setVoiceHint(HINT_UNSUPPORTED);
      return;
    }

    clearVoiceTimers();
    resetTranscript();
    voiceFinishedRef.current = false;

    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
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
      const spokenText = readSpokenText();

      if (spokenText) {
        clearTimer(noSpeechTimerRef);
        setQuestion(spokenText);
        setVoiceHint(HINT_HEARD);
        scheduleRecognitionSilenceAutoSend();
      }
    };
    recognition.onspeechend = () => {
      if (readSpokenText()) {
        recognition.stop();
        finishSpeechRecognition();
      }
    };
    recognition.onaudioend = () => finishSpeechRecognition();
    recognition.onnomatch = () => finishSpeechRecognition(HINT_NO_MATCH);
    recognition.onend = () => finishSpeechRecognition();
    recognition.onerror = () => {
      clearVoiceTimers();
      setVoiceState('error');
      recognitionRef.current = null;
      resetTranscript();
      voiceFinishedRef.current = true;
      setVoiceHint(HINT_RECOGNITION_PERMISSION_FAILED);
    };

    recognitionRef.current = recognition;
    setVoiceState('listening');
    setVoiceHint(HINT_LISTENING);
    noSpeechTimerRef.current = window.setTimeout(() => {
      recognitionRef.current?.stop();
      finishSpeechRecognition(HINT_NO_SPEECH);
    }, NO_SPEECH_TIMEOUT_MS);

    try {
      recognition.start();
    } catch {
      clearVoiceTimers();
      recognitionRef.current = null;
      setVoiceState('error');
      setVoiceHint(HINT_RECOGNITION_START_FAILED);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuestion(question);
  }

  async function handleAttachmentChange(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const nextAttachment = await readGuideAttachment(file);
      setAttachment(nextAttachment);
      setVoiceHint(HINT_ATTACHMENT_READY);
    } catch (caught) {
      setAttachment(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setVoiceState('error');
      setVoiceHint(caught instanceof Error ? caught.message : HINT_ATTACHMENT_UNSUPPORTED);
    }
  }

  function removeAttachment() {
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setVoiceHint(HINT_READY);
  }

  useEffect(() => {
    if (!voice && !legacyVoiceSupported) {
      setVoiceState('unsupported');
      setVoiceHint(HINT_UNSUPPORTED);
    }

    return () => {
      clearVoiceTimers();
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      stopMediaResources();
    };
  }, [legacyVoiceSupported, voice]);

  useEffect(() => {
    if (voice?.transcript) {
      setQuestion(voice.transcript);
    }
  }, [voice?.transcript]);

  async function startVoiceInput() {
    if (disabled || effectiveVoiceState === 'listening' || effectiveVoiceState === 'processing') {
      return;
    }

    if (voice?.supported) {
      voice.toggle();
      return;
    }

    if (recorderSupported) {
      await startMediaRecorderInput();
      return;
    }

    startSpeechRecognitionInput();
  }

  function stopVoiceInput() {
    if (streamingVoiceActive) {
      voice?.cancel();
      return;
    }

    if (mediaRecorderRef.current) {
      stopMediaRecording();
      return;
    }

    clearTimer(manualStopTimerRef);
    recognitionRef.current?.stop();
    manualStopTimerRef.current = window.setTimeout(() => {
      finishSpeechRecognition();
    }, MANUAL_STOP_FALLBACK_MS);
  }

  const voiceLabel =
    effectiveVoiceState === 'listening' ? STOP_VOICE_INPUT_LABEL : VOICE_INPUT_LABEL;

  return (
    <div className="question-input-shell">
      <form className="question-input" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          className="question-attachment-input"
          type="file"
          accept={ATTACHMENT_ACCEPT}
          onChange={(event) => void handleAttachmentChange(event.target.files?.[0])}
          aria-label={ATTACHMENT_FILE_INPUT_LABEL}
        />
        <input
          value={question}
          disabled={disabled || effectiveVoiceState === 'processing' || streamingVoiceActive}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={PLACEHOLDER_SCENIC_QUESTION}
          aria-label={INPUT_LABEL}
        />
        <div className="question-actions">
          <button
            type="button"
            disabled={disabled || effectiveVoiceState === 'processing'}
            onClick={() => fileInputRef.current?.click()}
            aria-label={ATTACH_FILE_LABEL}
            title={ATTACH_FILE_LABEL}
          >
            <FileUp size={16} />
          </button>
          <button
            type="button"
            disabled={disabled || !effectiveVoiceSupported || effectiveVoiceState === 'processing'}
            onClick={
              effectiveVoiceState === 'listening' ? stopVoiceInput : () => void startVoiceInput()
            }
            aria-label={voiceLabel}
            title={voiceLabel}
          >
            {effectiveVoiceState === 'listening' ? <Square size={16} /> : <Mic size={16} />}
          </button>
          <button
            type="submit"
            disabled={
              disabled ||
              effectiveVoiceState === 'processing' ||
              streamingVoiceActive ||
              (!question.trim() && !attachment)
            }
            aria-label={SEND_QUESTION_LABEL}
          >
            <Send size={16} />
          </button>
        </div>
      </form>
      {attachment ? (
        <div className="question-attachment-preview">
          {attachment.kind === 'image' ? (
            <img src={attachment.dataUrl} alt="" />
          ) : (
            <FileText size={22} aria-hidden="true" />
          )}
          <span>
            <strong>{attachment.name}</strong>
            <small>
              {attachment.kind === 'image'
                ? '图片'
                : attachment.kind === 'document'
                  ? 'Word 文档'
                  : attachment.kind === 'presentation'
                    ? 'PowerPoint'
                    : attachment.kind === 'spreadsheet'
                      ? '表格'
                      : 'Markdown'}
            </small>
          </span>
          <button
            type="button"
            onClick={removeAttachment}
            aria-label={REMOVE_ATTACHMENT_LABEL}
            title={REMOVE_ATTACHMENT_LABEL}
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
      <p className={`question-status question-status--${effectiveVoiceState}`} aria-live="polite">
        {effectiveVoiceHint}
      </p>
    </div>
  );
}
