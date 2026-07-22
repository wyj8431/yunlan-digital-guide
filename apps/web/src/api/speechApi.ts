async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : fallbackMessage;
    throw new Error(message);
  }

  return body as T;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary);
}

export async function transcribeSpeechAudio(audio: Blob): Promise<string> {
  const response = await fetch('/api/speech/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64: arrayBufferToBase64(await audio.arrayBuffer()),
      mimeType: audio.type || 'audio/webm'
    })
  });

  const result = await readJson<{ text: string }>(response, '语音识别失败');
  return result.text;
}

export async function synthesizeSpeechAudio(text: string): Promise<ArrayBuffer> {
  const response = await fetch('/api/speech/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    let message = '语音合成失败';

    try {
      const body = (await response.json()) as unknown;
      if (
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body.message === 'string'
      ) {
        message = body.message;
      }
    } catch {
      // Provider/proxy failures may return plain text or an empty body.
    }

    throw new Error(message);
  }

  return response.arrayBuffer();
}
