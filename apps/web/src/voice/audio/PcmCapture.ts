import { downsampleFloat32, floatToPcm16 } from './pcmEncoding';

type AudioContextWithWorklet = AudioContext & {
  audioWorklet: AudioWorklet;
};

export class PcmCapture {
  private context: AudioContextWithWorklet | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private activeState = false;

  constructor(
    private readonly options: {
      onChunk: (pcm: ArrayBuffer) => void;
      targetSampleRate?: 16000;
    }
  ) {}

  get active() {
    return this.activeState;
  }

  async start() {
    if (this.activeState) {
      return;
    }

    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前浏览器不支持实时语音输入。');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const context = new AudioContextConstructor() as AudioContextWithWorklet;
    this.context = context;
    await context.audioWorklet.addModule(new URL('./pcm-capture.worklet.js', import.meta.url));
    await context.resume();

    this.source = context.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(context, 'pcm-capture');
    const inputSampleRate = context.sampleRate;
    const targetSampleRate = this.options.targetSampleRate ?? 16000;

    this.node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (!this.activeState) {
        return;
      }

      const input = new Float32Array(event.data);
      const downsampled = downsampleFloat32(input, inputSampleRate, targetSampleRate);
      const pcm = floatToPcm16(downsampled);
      const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      const output = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(output).set(bytes);
      this.options.onChunk(output);
    };

    this.source.connect(this.node);
    this.node.connect(context.destination);
    this.activeState = true;
  }

  async stop() {
    if (!this.activeState && !this.stream && !this.context) {
      return;
    }

    this.activeState = false;
    this.node?.port.close();
    this.node?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    await this.context?.close();
    this.node = null;
    this.source = null;
    this.stream = null;
    this.context = null;
  }
}
