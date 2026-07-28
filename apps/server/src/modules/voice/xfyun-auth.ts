import { createHmac } from 'node:crypto';

export type XfyunSignedUrlOptions = {
  url: string;
  apiKey: string;
  apiSecret: string;
  date?: string;
};

export function createXfyunSignedUrl({
  url,
  apiKey,
  apiSecret,
  date = new Date().toUTCString()
}: XfyunSignedUrlOptions): string {
  const target = new URL(url);
  const host = target.host;
  const path = `${target.pathname}${target.search}`;
  const requestLine = `GET ${path} HTTP/1.1`;
  const signatureOrigin = `host: ${host}\ndate: ${date}\n${requestLine}`;
  const signature = createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');
  const authorizationOrigin = [
    `api_key="${apiKey}"`,
    'algorithm="hmac-sha256"',
    'headers="host date request-line"',
    `signature="${signature}"`
  ].join(', ');
  const authorization = Buffer.from(authorizationOrigin).toString('base64');

  target.searchParams.set('authorization', authorization);
  target.searchParams.set('date', date);
  target.searchParams.set('host', host);
  return target.toString();
}
