import { createHmac, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Router from '@koa/router';
import WebSocket from 'ws';
import { readEnv } from '../../config/env.js';

const IAT_HOST = 'iat-api.xfyun.cn';
const IAT_PATH = '/v2/iat';
const IAT_URL = `wss://${IAT_HOST}${IAT_PATH}`;
const TTS_HOST = 'tts-api.xfyun.cn';
const TTS_PATH = '/v2/tts';
const TTS_URL = `wss://${TTS_HOST}${TTS_PATH}`;
const PCM_CHUNK_SIZE = 1280;
const FRAME_INTERVAL_MS = 40;
const ASR_TIMEOUT_MS = 25_000;
const TTS_TIMEOUT_MS = 25_000;

type SpeechTranscribeBody = {
  audioBase64?: string;
  mimeType?: string;
};

type SpeechSynthesizeBody = {
  text?: unknown;
};

type AsrCredentials = {
  appId: string;
  apiKey: string;
  apiSecret: string;
};

type TtsCredentials = AsrCredentials & {
  voice: string;
};

function createSignedIatUrl(apiKey: string, apiSecret: string): string {
  const date = new Date().toUTCString();
  const requestLine = `GET ${IAT_PATH} HTTP/1.1`;
  const signString = `host: ${IAT_HOST}\ndate: ${date}\n${requestLine}`;
  const signature = createHmac('sha256', apiSecret).update(signString).digest('base64');
  const authorization = Buffer.from(
    `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  ).toString('base64');

  return `${IAT_URL}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${IAT_HOST}`;
}

function createSignedTtsUrl(apiKey: string, apiSecret: string): string {
  const date = new Date().toUTCString();
  const requestLine = `GET ${TTS_PATH} HTTP/1.1`;
  const signString = `host: ${TTS_HOST}\ndate: ${date}\n${requestLine}`;
  const signature = createHmac('sha256', apiSecret).update(signString).digest('base64');
  const authorization = Buffer.from(
    `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  ).toString('base64');

  return `${TTS_URL}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${TTS_HOST}`;
}

function readAsrCredentials(): AsrCredentials | null {
  const env = readEnv();
  const appId = process.env.XFYUN_ASR_APP_ID || env.xfyunVirtualHumanAppId;
  const apiKey = process.env.XFYUN_ASR_API_KEY || env.xfyunVirtualHumanApiKey;
  const apiSecret = process.env.XFYUN_ASR_API_SECRET || env.xfyunVirtualHumanApiSecret;

  if (!appId || !apiKey || !apiSecret) {
    return null;
  }

  return { appId, apiKey, apiSecret };
}

function readTtsCredentials(): TtsCredentials | null {
  const env = readEnv();
  const appId = env.xfyunTtsAppId;
  const apiKey = env.xfyunTtsApiKey;
  const apiSecret = env.xfyunTtsApiSecret;
  const voice = env.xfyunTtsVoice;

  if (!appId || !apiKey || !apiSecret || !voice) {
    return null;
  }

  return { appId, apiKey, apiSecret, voice };
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { windowsHide: true });
    let stderr = '';

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`音频转码失败：${stderr.trim() || `ffmpeg exit ${code}`}`));
    });
  });
}

async function convertAudioToPcm(audio: Buffer, mimeType = 'audio/webm'): Promise<Buffer> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'yunlan-asr-'));
  const inputExt = mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  const inputPath = path.join(tempDir, `input-${randomUUID()}.${inputExt}`);
  const outputPath = path.join(tempDir, 'audio.pcm');

  try {
    await writeFile(inputPath, audio);
    await runFfmpeg(['-y', '-i', inputPath, '-ac', '1', '-ar', '16000', '-f', 's16le', outputPath]);
    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function readTextFromIatResult(result: unknown): string {
  if (typeof result !== 'object' || result === null || !('ws' in result)) {
    return '';
  }

  const words = (result as { ws?: Array<{ cw?: Array<{ w?: string }> }> }).ws ?? [];
  return words.map((word) => word.cw?.[0]?.w ?? '').join('');
}

async function transcribePcmWithXfyun(pcm: Buffer, credentials: AsrCredentials): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(createSignedIatUrl(credentials.apiKey, credentials.apiSecret));
    const textParts: string[] = [];
    let offset = 0;
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.close();
        reject(new Error('讯飞语音识别超时'));
      }
    }, ASR_TIMEOUT_MS);

    function settleText() {
      if (resolved) {
        return;
      }

      resolved = true;
      clearTimeout(timeout);
      socket.close();
      resolve(textParts.join('').trim());
    }

    function sendFrame(status: 0 | 1 | 2, audio = '') {
      const frame =
        status === 0
          ? {
              common: { app_id: credentials.appId },
              business: {
                language: 'zh_cn',
                domain: 'iat',
                accent: 'mandarin',
                vad_eos: 5000
              },
              data: { status, format: 'audio/L16;rate=16000', encoding: 'raw', audio }
            }
          : {
              data: { status, format: 'audio/L16;rate=16000', encoding: 'raw', audio }
            };

      socket.send(JSON.stringify(frame));
    }

    function sendNextChunk() {
      if (resolved) {
        return;
      }

      if (offset >= pcm.length) {
        sendFrame(2);
        return;
      }

      const end = Math.min(offset + PCM_CHUNK_SIZE, pcm.length);
      const audio = pcm.subarray(offset, end).toString('base64');
      sendFrame(offset === 0 ? 0 : 1, audio);
      offset = end;
      setTimeout(sendNextChunk, FRAME_INTERVAL_MS);
    }

    socket.on('open', sendNextChunk);
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString()) as {
        code?: number;
        message?: string;
        data?: {
          status?: number;
          result?: unknown;
        };
      };

      if (message.code && message.code !== 0) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          socket.close();
          reject(new Error(message.message || `讯飞语音识别失败：${message.code}`));
        }
        return;
      }

      const text = readTextFromIatResult(message.data?.result);
      if (text) {
        textParts.push(text);
      }

      if (message.data?.status === 2) {
        settleText();
      }
    });
    socket.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(error);
      }
    });
    socket.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

async function synthesizeTextWithXfyun(text: string, credentials: TtsCredentials): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(createSignedTtsUrl(credentials.apiKey, credentials.apiSecret));
    const chunks: Buffer[] = [];
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.close();
        reject(new Error('讯飞语音合成超时'));
      }
    }, TTS_TIMEOUT_MS);

    function settleAudio() {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      socket.close();
      resolve(Buffer.concat(chunks));
    }

    socket.on('open', () => {
      socket.send(
        JSON.stringify({
          common: { app_id: credentials.appId },
          business: {
            aue: 'lame',
            auf: 'audio/L16;rate=16000',
            vcn: credentials.voice,
            speed: 50,
            volume: 50,
            pitch: 50,
            tte: 'UTF8'
          },
          data: {
            status: 2,
            text: Buffer.from(text, 'utf8').toString('base64')
          }
        })
      );
    });
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString()) as {
        code?: number;
        message?: string;
        data?: {
          audio?: string;
          status?: number;
        };
      };

      if (message.code && message.code !== 0) {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          socket.close();
          reject(new Error(message.message || `讯飞语音合成失败：${message.code}`));
        }
        return;
      }

      if (message.data?.audio) {
        chunks.push(Buffer.from(message.data.audio, 'base64'));
      }

      if (message.data?.status === 2) {
        settleAudio();
      }
    });
    socket.on('error', (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(error);
      }
    });
    socket.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

export function createSpeechRouter(): Router {
  const router = new Router();

  router.post('/api/speech/transcribe', async (ctx) => {
    const body = ctx.request.body as SpeechTranscribeBody | undefined;
    const audioBase64 = body?.audioBase64;

    if (!audioBase64) {
      ctx.status = 400;
      ctx.body = { code: 'EMPTY_AUDIO', message: '请先录制语音后再识别。' };
      return;
    }

    const credentials = readAsrCredentials();
    if (!credentials) {
      ctx.status = 503;
      ctx.body = { code: 'ASR_NOT_CONFIGURED', message: '讯飞语音识别配置缺失。' };
      return;
    }

    try {
      const audio = Buffer.from(audioBase64, 'base64');
      const pcm = await convertAudioToPcm(audio, body?.mimeType);
      const text = await transcribePcmWithXfyun(pcm, credentials);

      if (!text) {
        ctx.status = 422;
        ctx.body = { code: 'EMPTY_TRANSCRIPT', message: '没有识别到语音内容。' };
        return;
      }

      ctx.body = { text };
    } catch (caught) {
      ctx.status = 502;
      ctx.body = {
        code: 'ASR_FAILED',
        message: caught instanceof Error ? caught.message : '语音识别失败。'
      };
    }
  });

  router.post('/api/speech/synthesize', async (ctx) => {
    const body = ctx.request.body as SpeechSynthesizeBody | undefined;
    const text = typeof body?.text === 'string' ? body.text.trim() : '';

    if (!text) {
      ctx.status = 400;
      ctx.body = { code: 'EMPTY_TEXT', message: '请先输入需要合成的文本。' };
      return;
    }

    const credentials = readTtsCredentials();
    if (!credentials) {
      ctx.status = 503;
      ctx.body = { code: 'TTS_NOT_CONFIGURED', message: '讯飞语音合成配置缺失。' };
      return;
    }

    try {
      const audio = await synthesizeTextWithXfyun(text, credentials);

      if (audio.length === 0) {
        ctx.status = 502;
        ctx.body = { code: 'EMPTY_TTS_AUDIO', message: '讯飞语音合成未返回音频。' };
        return;
      }

      ctx.type = 'audio/mpeg';
      ctx.body = audio;
    } catch (caught) {
      ctx.status = 502;
      ctx.body = {
        code: 'TTS_FAILED',
        message: caught instanceof Error ? caught.message : '语音合成失败。'
      };
    }
  });

  return router;
}
