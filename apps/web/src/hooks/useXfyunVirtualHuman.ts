import { useEffect, useRef, useState } from 'react';
import { fetchVirtualHumanConfig } from '../api/virtualHumanApi';
import {
  createXfyunVirtualHumanClient,
  type XfyunVirtualHumanClient
} from '../lib/xfyunVirtualHumanClient';
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
};

const FALLBACK_MESSAGE = '本地3D数字人待机';

function createFallback(message = FALLBACK_MESSAGE): UseXfyunVirtualHumanResult {
  return {
    config: null,
    status: 'fallback',
    message,
    active: false,
    speaking: false
  };
}

export function useXfyunVirtualHuman({
  answerText,
  streamDomId,
  onSpeechDriverChange
}: UseXfyunVirtualHumanOptions): UseXfyunVirtualHumanResult {
  const clientRef = useRef<XfyunVirtualHumanClient | null>(null);
  const lastDrivenTextRef = useRef('');
  const [state, setState] = useState<UseXfyunVirtualHumanResult>(() => createFallback());

  useEffect(() => {
    let disposed = false;

    async function startVirtualHuman() {
      try {
        const config = await fetchVirtualHumanConfig();

        if (disposed) {
          return;
        }

        if (!config.enabled) {
          setState(createFallback(config.reason));
          onSpeechDriverChange?.('browser');
          return;
        }

        setState({
          config,
          status: 'loading',
          message: '正在接入讯飞虚拟人',
          active: false,
          speaking: false
        });

        const wrapper = document.getElementById(streamDomId);
        if (!wrapper) {
          throw new Error('讯飞虚拟人画面容器不存在');
        }

        const client = createXfyunVirtualHumanClient(config, wrapper);

        if (disposed) {
          return;
        }

        await client.start();

        if (disposed) {
          await client.stop();
          return;
        }

        clientRef.current = client;
        setState({
          config,
          status: 'ready',
          message: '讯飞虚拟人已接入',
          active: true,
          speaking: false
        });
        onSpeechDriverChange?.('xfyun');
      } catch {
        if (!disposed) {
          clientRef.current = null;
          setState(createFallback('讯飞虚拟人接入失败，已切换本地3D数字人'));
          onSpeechDriverChange?.('browser');
        }
      }
    }

    startVirtualHuman();

    return () => {
      disposed = true;
      const client = clientRef.current;
      clientRef.current = null;
      onSpeechDriverChange?.('browser');
      client?.stop().catch(() => undefined);
    };
  }, [onSpeechDriverChange, streamDomId]);

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
      speaking: true
    }));

    clientRef.current
      .speak(text)
      .then(() => {
        if (!disposed) {
          setState((current) => ({
            ...current,
            status: 'ready',
            message: '讯飞虚拟人已接入',
            speaking: false
          }));
        }
      })
      .catch(() => {
        if (!disposed) {
          setState(createFallback('讯飞虚拟人文本驱动失败，已切换本地3D数字人'));
          clientRef.current = null;
          onSpeechDriverChange?.('browser');
        }
      });

    return () => {
      disposed = true;
    };
  }, [answerText, onSpeechDriverChange, state.status]);

  return state;
}
