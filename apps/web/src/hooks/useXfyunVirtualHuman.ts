import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchVirtualHumanConfig } from '../api/virtualHumanApi';
import { dispatchGuideSpeechDuration, dispatchGuideSpeechPlayback } from '../lib/guideSpeechSync';
import {
  createMofaVirtualHumanClient,
  type MofaVirtualHumanClient
} from '../lib/mofaVirtualHumanClient';
import {
  createXfyunVirtualHumanClient,
  type XfyunVirtualHumanClient
} from '../lib/xfyunVirtualHumanClient';
import type { SpeechDriver, VirtualHumanConfig } from '../types/virtualHuman';

type VirtualHumanStatus = 'fallback' | 'loading' | 'ready' | 'speaking' | 'error';
type OnlineVirtualHumanClient = XfyunVirtualHumanClient | MofaVirtualHumanClient;
type EnabledVirtualHumanConfig = Extract<VirtualHumanConfig, { enabled: true }>;

type UseXfyunVirtualHumanOptions = {
  answerText?: string;
  streamDomId: string;
  onSpeechDriverChange?: (driver: SpeechDriver) => void;
};

type UseXfyunVirtualHumanResult = {
  config: VirtualHumanConfig | null;
  status: VirtualHumanStatus;
  message: string;
  active: boolean;
  speaking: boolean;
  acting: boolean;
  triggerAction: (actionId: string) => Promise<void>;
  retry: () => void;
};

const FALLBACK_MESSAGE = '本地 3D 数字人待命中';
const noopRetry = () => undefined;

function getProviderName(config?: EnabledVirtualHumanConfig | null): string {
  return config?.provider === 'mofa-xingyun' ? '魔珐星云数字人' : '讯飞虚拟人';
}

function getSpeechDriver(config: EnabledVirtualHumanConfig): SpeechDriver {
  return config.provider === 'mofa-xingyun' ? 'mofa' : 'xfyun';
}

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
      throw new Error('线上数字人尚未接入');
    },
    retry
  };
}

function createOnlineError(
  config: EnabledVirtualHumanConfig,
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

function createOnlineClient(
  config: EnabledVirtualHumanConfig,
  wrapper: HTMLElement,
  onFatalError?: (message: string) => void
): OnlineVirtualHumanClient {
  const options = {
    onSpeechDuration: (durationMs: number, text: string) => {
      dispatchGuideSpeechDuration({ durationMs, text });
    },
    onSpeechStart: (text: string) => {
      dispatchGuideSpeechPlayback({ text, phase: 'start' });
    },
    onFatalError
  };

  return config.provider === 'mofa-xingyun'
    ? createMofaVirtualHumanClient(config, wrapper, undefined, options)
    : createXfyunVirtualHumanClient(config, wrapper, undefined, options);
}

export function describeOnlineFailure(config: EnabledVirtualHumanConfig, caught: unknown): string {
  const rawMessage =
    caught instanceof Error
      ? `${caught.name}: ${caught.message}`
      : typeof caught === 'string'
        ? caught
        : JSON.stringify(caught);
  const normalized = rawMessage.toLowerCase();

  if (
    config.provider === 'xfyun-vms' &&
    (normalized.includes('http authentication failed') ||
      normalized.includes('connecterror') ||
      normalized.includes('401') ||
      normalized.includes('403') ||
      normalized.includes('not published') ||
      normalized.includes('未发布'))
  ) {
    return '讯飞虚拟人认证失败，通常是服务未发布、密钥无效或当前应用未授权，请先在讯飞控制台发布该服务后重试。';
  }

  if (
    config.provider === 'mofa-xingyun' &&
    (normalized.includes('10003') ||
      normalized.includes('积分不足') ||
      normalized.includes('token'))
  ) {
    return '魔珐星云接入失败，通常是账户积分不足或会话参数无效。';
  }

  return `${getProviderName(config)}接入失败，请稍后重试。`;
}

export function useXfyunVirtualHuman({
  answerText,
  streamDomId,
  onSpeechDriverChange
}: UseXfyunVirtualHumanOptions): UseXfyunVirtualHumanResult {
  const clientRef = useRef<OnlineVirtualHumanClient | null>(null);
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
      throw new Error('线上数字人尚未接入');
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

        const providerName = getProviderName(config);
        setState({
          config,
          status: 'loading',
          message: `正在接入${providerName}`,
          active: false,
          speaking: false,
          acting: false,
          triggerAction,
          retry
        });

        const wrapper = document.getElementById(streamDomId);
        if (!wrapper) {
          throw new Error('线上数字人画面容器不存在');
        }

        let fatalOnlineError = false;
        let client: OnlineVirtualHumanClient | null = null;
        const handleFatalOnlineError = (message: string) => {
          if (disposed || fatalOnlineError) {
            return;
          }

          fatalOnlineError = true;
          clientRef.current = null;
          lastDrivenTextRef.current = '';
          void client?.stop().catch(() => undefined);
          setState(createFallback(`${providerName}${message}，已切换本地 3D 数字人。`, retry));
          onSpeechDriverChange?.('browser');
        };

        client = createOnlineClient(config, wrapper, handleFatalOnlineError);

        if (disposed) {
          return;
        }

        await client.start();

        if (disposed) {
          await client.stop();
          return;
        }

        if (fatalOnlineError) {
          await client.stop().catch(() => undefined);
          return;
        }

        clientRef.current = client;
        lastDrivenTextRef.current = latestAnswerRef.current;
        setState({
          config,
          status: 'ready',
          message: `${providerName}已接入`,
          active: true,
          speaking: false,
          acting: false,
          triggerAction,
          retry
        });
        onSpeechDriverChange?.(getSpeechDriver(config));
      } catch (caught) {
        if (!disposed) {
          console.error('线上数字人接入失败', caught);
          clientRef.current = null;
          setState(
            attemptedConfig?.enabled
              ? createOnlineError(
                  attemptedConfig,
                  `${getProviderName(attemptedConfig)}接入失败，请关闭其他预览页后重试。`,
                  triggerAction,
                  retry
                )
              : createFallback('线上数字人接入失败，已切换本地 3D 数字人。', retry)
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
      message: `${getProviderName(current.config?.enabled ? current.config : null)}讲解中`,
      speaking: true,
      acting,
      triggerAction,
      retry
    }));

    dispatchGuideSpeechPlayback({ text, phase: 'preparing' });

    clientRef.current
      .speak(text)
      .then(() => {
        if (!disposed) {
          dispatchGuideSpeechPlayback({ text, phase: 'end' });
          setState((current) => ({
            ...current,
            status: 'ready',
            message: `${getProviderName(current.config?.enabled ? current.config : null)}已接入`,
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
          console.error('线上数字人文本驱动失败', caught);
          setState((current) =>
            current.config?.enabled
              ? createOnlineError(
                  current.config,
                  `${getProviderName(current.config)}文本驱动失败，请稍后重试。`,
                  triggerAction,
                  retry
                )
              : createFallback('线上数字人文本驱动失败，已切换本地 3D 数字人。', retry)
          );
          clientRef.current = null;
          onSpeechDriverChange?.('browser');
        }
      });

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
