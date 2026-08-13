export const GUIDE_AVATAR_EMOTIONS = ['neutral', 'warm', 'happy', 'thoughtful'] as const;
export type GuideAvatarEmotion = (typeof GUIDE_AVATAR_EMOTIONS)[number];

// These IDs are the controlled action catalogue returned by the virtual-human config route.
export const GUIDE_AVATAR_ACTION_IDS = [
  'A_LH_introduced_O',
  'A_RLH_introduced_O',
  'A_RH_introduced_O',
  'A_RH_introduced1_O',
  'A_RLH_welcome_O',
  'A_RLH_emphasize_O',
  'A_RH_emphasize_O',
  'A_RH_emphasize2_O',
  'A_RH_good_O',
  'A_RH_encourage_O',
  'A_RH_hello_O',
  'A_RH_bye_O',
  'A_H_listen_C'
] as const;
export type GuideAvatarActionId = (typeof GUIDE_AVATAR_ACTION_IDS)[number];

export type GuideAvatarDirective = {
  emotion?: GuideAvatarEmotion;
  action?: GuideAvatarActionId;
  scene?: string;
};

export type ParsedGuideDirective = {
  answer: string;
  avatarDirective?: GuideAvatarDirective;
};

const DIRECTIVE_OPEN_TAG = '<guide-directive>';
const DIRECTIVE_CLOSE_TAG = '</guide-directive>';
const TRAILING_DIRECTIVE = new RegExp(
  `\\s*${DIRECTIVE_OPEN_TAG}([\\s\\S]*?)${DIRECTIVE_CLOSE_TAG}\\s*$`,
  'i'
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGuideAvatarEmotion(value: unknown): value is GuideAvatarEmotion {
  return typeof value === 'string' && (GUIDE_AVATAR_EMOTIONS as readonly string[]).includes(value);
}

function isGuideAvatarActionId(value: unknown): value is GuideAvatarActionId {
  return (
    typeof value === 'string' && (GUIDE_AVATAR_ACTION_IDS as readonly string[]).includes(value)
  );
}

function parseDirectivePayload(value: unknown): GuideAvatarDirective | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const directive: GuideAvatarDirective = {};
  if (isGuideAvatarEmotion(value.emotion)) {
    directive.emotion = value.emotion;
  }
  if (isGuideAvatarActionId(value.action)) {
    directive.action = value.action;
  }
  if (typeof value.scene === 'string' && value.scene.trim().length > 0) {
    directive.scene = Array.from(value.scene.trim()).slice(0, 48).join('');
  }

  return Object.keys(directive).length > 0 ? directive : undefined;
}

/**
 * Extracts the optional, trailing avatar directive. The tag is always hidden from visitors,
 * including malformed or unsupported payloads, so model output cannot become UI commands.
 */
export function parseGuideDirective(rawAnswer: string): ParsedGuideDirective {
  const match = TRAILING_DIRECTIVE.exec(rawAnswer);
  if (match) {
    const answer = rawAnswer.slice(0, match.index).trimEnd();
    try {
      return { answer, avatarDirective: parseDirectivePayload(JSON.parse(match[1])) };
    } catch {
      return { answer };
    }
  }

  // 流式输出被截断时标签可能未闭合：剥离尾部残缺标签，防止其泄漏进答案文本与语音时间线。
  // 仅当最后一个 <guide-directive 之后没有闭合标签时才剥离，避免误伤正文。
  const openTagMatches = Array.from(rawAnswer.matchAll(/<guide-directive/gi));
  if (openTagMatches.length > 0) {
    const lastOpen = openTagMatches[openTagMatches.length - 1];
    const afterLastOpen = rawAnswer.slice(lastOpen.index);
    if (!/<\/guide-directive>/i.test(afterLastOpen)) {
      return { answer: rawAnswer.slice(0, lastOpen.index).trimEnd() };
    }
  }

  return { answer: rawAnswer };
}

/** Buffers a possible directive suffix so it is never emitted as a stream delta. */
export function createGuideDirectiveStreamSanitizer(onDelta: (delta: string) => void) {
  let pending = '';
  let withholdingDirective = false;

  const emitSafePrefix = () => {
    const lowerPending = pending.toLowerCase();
    const openTag = DIRECTIVE_OPEN_TAG.toLowerCase();
    const tagIndex = lowerPending.indexOf(openTag);
    if (tagIndex >= 0) {
      if (tagIndex > 0) {
        onDelta(pending.slice(0, tagIndex));
      }
      pending = pending.slice(tagIndex);
      withholdingDirective = true;
      return;
    }

    let suffixLength = 0;
    for (let length = Math.min(pending.length, openTag.length - 1); length > 0; length -= 1) {
      if (lowerPending.endsWith(openTag.slice(0, length))) {
        suffixLength = length;
        break;
      }
    }
    const safeLength = pending.length - suffixLength;
    if (safeLength > 0) {
      onDelta(pending.slice(0, safeLength));
      pending = pending.slice(safeLength);
    }
  };

  return {
    push(delta: string) {
      if (withholdingDirective) {
        pending += delta;
        return;
      }
      pending += delta;
      emitSafePrefix();
    },
    flush() {
      if (!withholdingDirective && pending) {
        onDelta(pending);
      }
      pending = '';
    }
  };
}
