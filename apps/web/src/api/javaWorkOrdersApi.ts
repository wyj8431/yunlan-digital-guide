export type JavaLoginResponse = {
  token: string;
  tokenType: string;
  userId: string;
  email: string;
  role: string;
};

export type JavaTicket = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  reporterId: string;
  assigneeId: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type JavaTicketComment = {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type JavaTicketEvent = {
  id: number;
  ticketId: string;
  actorId: string;
  fromStatus: JavaTicket['status'];
  toStatus: JavaTicket['status'];
  idempotencyKey: string;
  createdAt: string;
};

export type JavaTicketAssignmentEvent = {
  id: number;
  ticketId: string;
  actorId: string;
  previousAssigneeId: string | null;
  assigneeId: string | null;
  createdAt: string;
};

export type JavaTicketNotification = {
  id: string;
  ticketId: string | null;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

export type JavaTicketStats = {
  total: number;
  byStatus: Record<JavaTicket['status'], number>;
};

export type JavaProjectMember = {
  userId: string;
  email: string;
  role: string;
};

export type JavaProject = {
  id: string;
  name: string;
};

export type JavaQuestion = {
  id: string;
  stem: string;
  optionsJson: string;
  knowledgePointId: string;
  difficulty: string;
};

export type JavaAttempt = {
  id: string;
  questionId: string;
  learnerId: string;
  correct: boolean;
  selectedAnswer: string;
  reasoning: string | null;
  diagnosisStatus: string | null;
  reviewStatus: 'PENDING' | 'CONFIRMED' | 'REJECTED' | null;
  diagnosisJson: string | null;
  createdAt: string;
};

export type JavaAlertGroup = {
  id: string;
  deviceId: string;
  alertType: string;
  bucketStart: string;
  level: string;
  message: string;
  repeatCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

type ErrorBody = { message?: unknown };

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(path, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as T & ErrorBody;
  if (!response.ok) {
    throw new Error(typeof body.message === 'string' ? body.message : 'Java API request failed.');
  }
  return body as T;
}

export function login(email: string, password: string) {
  return request<JavaLoginResponse>('/api/platform/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function listTickets(token: string, projectId?: string) {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return request<{ tickets: JavaTicket[] }>(`/api/tickets${query}`, token);
}

export async function createTicket(
  token: string,
  input: { projectId: string; title: string; description: string; assigneeId?: string },
  idempotencyKey: string
) {
  return request<JavaTicket>('/api/tickets', token, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input)
  });
}

export async function listProjectMembers(token: string, projectId: string) {
  return request<{ members: JavaProjectMember[] }>(
    `/api/tickets/members?projectId=${encodeURIComponent(projectId)}`,
    token
  );
}

export async function listProjects(token: string) {
  return request<{ projects: JavaProject[] }>('/api/tickets/projects', token);
}

export async function getTicketStats(token: string, projectId?: string) {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return request<JavaTicketStats>(`/api/tickets/stats${query}`, token);
}

export async function listTicketComments(token: string, ticketId: string) {
  return request<{ comments: JavaTicketComment[] }>(`/api/tickets/${ticketId}/comments`, token);
}

export async function addTicketComment(token: string, ticketId: string, body: string) {
  return request<JavaTicketComment>(`/api/tickets/${ticketId}/comments`, token, {
    method: 'POST',
    body: JSON.stringify({ body })
  });
}

export async function listTicketEvents(token: string, ticketId: string) {
  return request<{ events: JavaTicketEvent[] }>(`/api/tickets/${ticketId}/events`, token);
}

export async function listTicketAssignmentEvents(token: string, ticketId: string) {
  return request<{ assignments: JavaTicketAssignmentEvent[] }>(
    `/api/tickets/${ticketId}/assignments`,
    token
  );
}

export async function listTicketNotifications(token: string) {
  return request<{ notifications: JavaTicketNotification[]; unreadCount: number }>(
    '/api/tickets/notifications',
    token
  );
}

export async function markTicketNotificationRead(token: string, notificationId: string) {
  return request<JavaTicketNotification>(
    `/api/tickets/notifications/${notificationId}/read`,
    token,
    {
      method: 'POST'
    }
  );
}

export async function changeTicketStatus(
  token: string,
  ticket: JavaTicket,
  status: JavaTicket['status']
) {
  return request<JavaTicket>(`/api/tickets/${ticket.id}/status`, token, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ status, expectedVersion: ticket.version })
  });
}

export async function changeTicketAssignee(
  token: string,
  ticket: JavaTicket,
  assigneeId: string | null
) {
  return request<JavaTicket>(`/api/tickets/${ticket.id}/assignee`, token, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ assigneeId, expectedVersion: ticket.version })
  });
}

export async function listQuestions(token: string) {
  return request<{ questions: JavaQuestion[] }>('/api/learning/questions', token);
}

export async function submitAttempt(
  token: string,
  input: { questionId: string; selectedAnswer: string; reasoning: string }
) {
  return request<JavaAttempt>('/api/learning/attempts', token, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function listPendingReviews(token: string) {
  return request<{ attempts: JavaAttempt[] }>('/api/learning/reviews/pending', token);
}

export async function reviewAttempt(
  token: string,
  attemptId: string,
  status: 'CONFIRMED' | 'REJECTED',
  candidateJson?: string
) {
  return request<JavaAttempt>(`/api/learning/attempts/${attemptId}/review`, token, {
    method: 'POST',
    body: JSON.stringify({ status, ...(candidateJson?.trim() ? { candidateJson } : {}) })
  });
}

export async function listAlerts(token: string) {
  return request<{ alerts: JavaAlertGroup[] }>('/api/alerts', token);
}

export async function submitAlert(
  token: string,
  input: { deviceId: string; alertType: string; level: string; message: string; occurredAt: string }
) {
  return request<{ status: string; queuedCount: number }>('/api/alerts', token, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}
