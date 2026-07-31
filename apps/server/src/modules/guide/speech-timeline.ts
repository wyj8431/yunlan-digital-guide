// 根据回答文本生成轻量嘴型时间轴，供本地数字人无音素数据时使用。
export type GuideViseme = 'sil' | 'aa' | 'ee' | 'oo' | 'ih' | 'oh' | 'mouth-open' | 'mouth-closed';

export type GuideVisemeCue = {
  startMs: number;
  endMs: number;
  viseme: GuideViseme;
  mouthOpen: number;
};

export type GuideSpeechTimeline = {
  text: string;
  durationMs: number;
  visemes: GuideVisemeCue[];
  source: 'estimated';
};

const CJK_MS = 145;
const LATIN_MS = 72;
const SPACE_MS = 45;
const COMMA_MS = 190;
const SENTENCE_END_MS = 270;
const MIN_DURATION_MS = 900;

function isCjk(character: string): boolean {
  return /[\u3400-\u9fff]/.test(character);
}

function isSentenceEnd(character: string): boolean {
  return /[.!?]/.test(character) || ['。', '！', '？'].includes(character);
}

function isCommaPause(character: string): boolean {
  return /[,;:]/.test(character) || ['，', '、', '；', '：'].includes(character);
}

function getCharacterDurationMs(character: string): number {
  if (/\s/.test(character)) {
    return SPACE_MS;
  }

  if (isSentenceEnd(character)) {
    return SENTENCE_END_MS;
  }

  if (isCommaPause(character)) {
    return COMMA_MS;
  }

  if (isCjk(character)) {
    return CJK_MS;
  }

  return LATIN_MS;
}

function getCharacterViseme(character: string): Pick<GuideVisemeCue, 'viseme' | 'mouthOpen'> {
  if (/\s/.test(character) || isSentenceEnd(character) || isCommaPause(character)) {
    return { viseme: 'sil', mouthOpen: 0 };
  }

  if (/[aoouAOOU]/.test(character) || ['云', '古', '口', '游', '优', '票'].includes(character)) {
    return { viseme: 'oo', mouthOpen: 0.72 };
  }

  if (/[eiEI]/.test(character) || ['景', '岚', '里', '息', '宜'].includes(character)) {
    return { viseme: 'ee', mouthOpen: 0.48 };
  }

  if (/[fvpbmFVPMB]/.test(character) || ['门', '民', '票', '闭'].includes(character)) {
    return { viseme: 'mouth-closed', mouthOpen: 0.18 };
  }

  if (isCjk(character)) {
    return { viseme: 'aa', mouthOpen: 0.58 };
  }

  return { viseme: 'mouth-open', mouthOpen: 0.52 };
}

function closeCueAt(startMs: number): GuideVisemeCue {
  return {
    startMs,
    endMs: startMs + 80,
    viseme: 'mouth-closed',
    mouthOpen: 0
  };
}

export function createGuideSpeechTimeline(text: string): GuideSpeechTimeline {
  const characters = Array.from(text);
  const visemes: GuideVisemeCue[] = [];
  let cursorMs = 0;

  for (const character of characters) {
    const durationMs = getCharacterDurationMs(character);
    const { viseme, mouthOpen } = getCharacterViseme(character);
    const startMs = cursorMs;
    const endMs = cursorMs + durationMs;

    if (mouthOpen > 0 || viseme === 'sil') {
      visemes.push({ startMs, endMs, viseme, mouthOpen });
    }

    cursorMs = endMs;
  }

  const durationMs = Math.max(MIN_DURATION_MS, cursorMs);

  if (visemes.length === 0 || visemes[visemes.length - 1].viseme !== 'mouth-closed') {
    visemes.push(closeCueAt(durationMs));
  }

  return {
    text,
    durationMs,
    visemes,
    source: 'estimated'
  };
}
