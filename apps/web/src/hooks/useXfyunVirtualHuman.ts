import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchVirtualHumanConfig } from '../api/virtualHumanApi';
import {
  createXfyunVirtualHumanClient,
  type XfyunVirtualHumanClient
} from '../lib/xfyunVirtualHumanClient';
import { dispatchGuideSpeechDuration, dispatchGuideSpeechPlayback } from '../lib/guideSpeechSync';
import type { SpeechDriver, VirtualHumanConfig } from '../types/virtualHuman';

type XfyunVirtualHumanStatus = 'fallback' | 'loading' | 'ready' | 'speaking' | 'error';

type UseXfyunVirtualHumanOptions = {
  answerText?: string;
  streamDomId: string;
  onSpeechDriverChange?: (driver: SpeechDriver) => void;
};

type UseXfyunVirtualHumanResult = {
  config: VirtualHumanConfig | null;
  status: XfyunVirtualHumanStatus;
  message: string;
  active: boolean;
  speaking: boolean;
  acting: boolean;
  triggerAction: (actionId: string) => Promise<void>;
  retry: () => void;
};

const FALLBACK_MESSAGE = '本地 3D 数字人待命中';
const noopRetry = () => undefined;

function createFallback(
  message = FALLBACK_MESSAGE,
  retry: () => void = noopRetry
): UseXfyunVirtualHumanResult {
  return {
    config: null,
    status: 'fallback',
    message,
    active: false,
    speaking: false,
    acting: false,
    triggerAction: async () => {
      throw new Error('讯飞虚拟人尚未接入');
    },
    retry
  };
}

function createXfyunError(
  config: Extract<VirtualHumanConfig, { enabled: true }>,
  message: string,
  triggerAction: (actionId: string) => Promise<void>,
  retry: () => void
): UseXfyunVirtualHumanResult {
  return {
    config,
    status: 'error',
    message,
    active: false,
    speaking: false,
    acting: false,
    triggerAction,
    retry
  };
}

export function useXfyunVirtualHuman({
  answerText,
  streamDomId,
  onSpeechDriverChange
}: UseXfyunVirtualHumanOptions): UseXfyunVirtualHumanResult {
  const clientRef = useRef<XfyunVirtualHumanClient | null>(null);
  const lastDrivenTextRef = useRef('');
  const latestAnswerRef = useRef('');
  const [acting, setActing] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [state, setState] = useState<UseXfyunVirtualHumanResult>(() => createFallback());

  const retry = useCallback(() => {
    const client = clientRef.current;
    clientRef.current = null;
    lastDrivenTextRef.current = '';
    void client?.stop().catch(() => undefined);
    setRetryNonce((value) => value + 1);
  }, []);

  const triggerAction = useCallback(async (actionId: string) => {
    const client = clientRef.current;

    if (!client) {
      throw new Error('讯飞虚拟人尚未接入');
    }

    setActing(true);
    try {
      await client.triggerAction(actionId);
    } finally {
      setActing(false);
    }
  }, []);

  useEffect(() => {
    latestAnswerRef.current = answerText?.trim() ?? '';
  }, [answerText]);

  useEffect(() => {
    let disposed = false;
    let startTimer: number | null = null;
    let attemptedConfig: VirtualHumanConfig | null = null;

    async function startVirtualHuman() {
      try {
        const config = await fetchVirtualHumanConfig();
        attemptedConfig = config;

        if (disposed) {
          return;
        }

        if (!config.enabled) {
          setState(createFallback(config.reason, retry));
          onSpeechDriverChange?.('browser');
          return;
        }

        setState({
          config,
          status: 'loading',
          message: '正在接入讯飞虚拟人',
          active: false,
          speaking: false,
          acting: false,
          triggerAction,
          retry
        });

        const wrapper = document.getElementById(streamDomId);
        if (!wrapper) {
          throw new Error('讯飞虚拟人画面容器不存在');
        }

        const client = createXfyunVirtualHumanClient(config, wrapper, undefined, {
          onSpeechDuration: (durationMs, text) => {
            dispatchGuideSpeechDuration({ durationMs, text });
          }
        });

        if (disposed) {
          return;
        }

        await client.start();

        if (disposed) {
          await client.stop();
          return;
        }

        clientRef.current = client;
        lastDrivenTextRef.current = latestAnswerRef.current;
        setState({
          config,
          status: 'ready',
          message: '讯飞虚拟人已接入',
          active: true,
          speaking: false,
          acting: false,
          triggerAction,
          retry
        });
        onSpeechDriverChange?.('xfyun');
      } catch (caught) {
        if (!disposed) {
          console.error('讯飞虚拟人接入失败', caught);
          clientRef.current = null;
          setState(
            attemptedConfig?.enabled
              ? createXfyunError(
                  attemptedConfig,
                  '讯飞虚拟人接入失败，请关闭其他预览页后重试',
                  triggerAction,
                  retry
                )
              : createFallback('讯飞虚拟人接入失败，已切换本地 3D 数字人', retry)
          );
          onSpeechDriverChange?.('browser');
        }
      }
    }

    startTimer = window.setTimeout(() => {
      void startVirtualHuman();
    }, 150);

    return () => {
      disposed = true;
      if (startTimer !== null) {
        window.clearTimeout(startTimer);
      }
      const client = clientRef.current;
      clientRef.current = null;
      onSpeechDriverChange?.('browser');
      client?.stop().catch(() => undefined);
    };
  }, [onSpeechDriverChange, retry, retryNonce, streamDomId, triggerAction]);

  useEffect(() => {
    const text = answerText?.trim() ?? '';

    if (!text || text === lastDrivenTextRef.current || !clientRef.current) {
      return;
    }

    let disposed = false;
    lastDrivenTextRef.current = text;
    setState((current) => ({
      ...current,
      status: 'speaking',
      message: '讯飞虚拟人讲解中',
      speaking: true,
      acting,
      triggerAction,
      retry
    }));

    clientRef.current
      .speak(text)
      .then(() => {
        if (!disposed) {
          dispatchGuideSpeechPlayback({ text, phase: 'end' });
          setState((current) => ({
            ...current,
            status: 'ready',
            message: '讯飞虚拟人已接入',
            speaking: false,
            acting,
            triggerAction,
            retry
          }));
        }
      })
      .catch((caught) => {
        if (!disposed) {
          dispatchGuideSpeechPlayback({ text, phase: 'error' });
          console.error('讯飞虚拟人文本驱动失败', caught);
          setState((current) =>
            current.config?.enabled
              ? createXfyunError(
                  current.config,
                  '讯飞虚拟人文本驱动失败，请稍后重试',
                  triggerAction,
                  retry
                )
              : createFallback('讯飞虚拟人文本驱动失败，已切换本地 3D 数字人', retry)
          );
          clientRef.current = null;
          onSpeechDriverChange?.('browser');
        }
      });

    dispatchGuideSpeechPlayback({ text, phase: 'preparing' });
    dispatchGuideSpeechPlayback({ text, phase: 'start' });

    return () => {
      disposed = true;
    };
  }, [acting, answerText, onSpeechDriverChange, retry, triggerAction]);

  return {
    ...state,
    acting,
    triggerAction,
    retry
  };
}
