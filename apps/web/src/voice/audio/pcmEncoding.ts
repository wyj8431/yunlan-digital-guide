// 将浏览器音频采样率降到语音识别所需频率，同时保持连续采样。
export function downsampleFloat32(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (outputSampleRate > inputSampleRate) {
    throw new Error('Output sample rate cannot exceed input sample rate.');
  }

  if (outputSampleRate === inputSampleRate) {
    return new Float32Array(input);
  }

  const outputLength = Math.max(1, Math.floor((input.length * outputSampleRate) / inputSampleRate));
  const output = new Float32Array(outputLength);
  const ratio = inputSampleRate / outputSampleRate;

  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(input.length, Math.max(start + 1, Math.floor((index + 1) * ratio)));
    let total = 0;
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      total += input[sourceIndex] ?? 0;
    }
    output[index] = total / Math.max(1, end - start);
  }

  return output;
}

export function floatToPcm16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] ?? 0));
    output[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }

  return output;
}
