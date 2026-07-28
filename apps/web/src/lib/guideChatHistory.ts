import type { ChatMessage, GuideAttachmentKind, GuideChatSession } from '../types/guide';

export const GUIDE_CHAT_HISTORY_STORAGE_KEY = 'yunlan-guide-chat-history-v1';

const MAX_HISTORY_SESSIONS = 30;
const ATTACHMENT_KINDS = new Set<GuideAttachmentKind>([
  'image',
  'document',
  'spreadsheet',
  'presentation',
  'markdown'
]);

function sanitizeMessage(message: ChatMessage): ChatMessage | null {
  if (
    typeof message?.id !== 'string' ||
    (message.role !== 'user' && message.role !== 'assistant') ||
    typeof message.content !== 'string'
  ) {
    return null;
  }

  const attachmentKind = ATTACHMENT_KINDS.has(message.attachmentKind as GuideAttachmentKind)
    ? message.attachmentKind
    : undefined;

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    ...(typeof message.attachmentName === 'string'
      ? { attachmentName: message.attachmentName }
      : {}),
    ...(attachmentKind ? { attachmentKind } : {}),
    ...(Array.isArray(message.retrievedKnowledge)
      ? { retrievedKnowledge: message.retrievedKnowledge }
      : {})
  };
}

function sanitizeSession(session: GuideChatSession): GuideChatSession | null {
  if (
    typeof session?.id !== 'string' ||
    typeof session.title !== 'string' ||
    typeof session.createdAt !== 'string' ||
    typeof session.updatedAt !== 'string' ||
    !Array.isArray(session.messages)
  ) {
    return null;
  }

  const messages = session.messages
    .map(sanitizeMessage)
    .filter((message): message is ChatMessage => message !== null);

  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages
  };
}

function writeSessions(sessions: GuideChatSession[]) {
  try {
    localStorage.setItem(GUIDE_CHAT_HISTORY_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // History is a convenience feature; a full or unavailable browser store must not break chat.
  }
}

export function loadGuideChatHistory(): GuideChatSession[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(GUIDE_CHAT_HISTORY_STORAGE_KEY) ?? '[]'
    );
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((session) => sanitizeSession(session as GuideChatSession))
      .filter((session): session is GuideChatSession => session !== null)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, MAX_HISTORY_SESSIONS);
  } catch {
    return [];
  }
}

export function saveGuideChatHistory(session: GuideChatSession): GuideChatSession[] {
  const sanitized = sanitizeSession(session);
  if (!sanitized) {
    return loadGuideChatHistory();
  }

  const sessions = [sanitized, ...loadGuideChatHistory().filter((item) => item.id !== session.id)]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_HISTORY_SESSIONS);
  writeSessions(sessions);
  return sessions;
}

export function removeGuideChatHistory(sessionId: string): GuideChatSession[] {
  const sessions = loadGuideChatHistory().filter((session) => session.id !== sessionId);
  writeSessions(sessions);
  return sessions;
}

export function clearGuideChatHistory() {
  try {
    localStorage.removeItem(GUIDE_CHAT_HISTORY_STORAGE_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
}
