import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  History,
  LogIn,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  changeTicketStatus,
  changeTicketAssignee,
  addTicketComment,
  createTicket,
  getTicketStats,
  listAlerts,
  listTicketComments,
  listTicketEvents,
  listTicketAssignmentEvents,
  listTicketNotifications,
  listPendingReviews,
  listProjectMembers,
  listProjects,
  listQuestions,
  listTickets,
  login,
  markTicketNotificationRead,
  reviewAttempt,
  submitAlert,
  submitAttempt,
  type JavaAlertGroup,
  type JavaAttempt,
  type JavaTicketComment,
  type JavaTicketEvent,
  type JavaTicketAssignmentEvent,
  type JavaTicketNotification,
  type JavaTicketStats,
  type JavaQuestion,
  type JavaTicket,
  type JavaProjectMember,
  type JavaProject
} from '../api/javaWorkOrdersApi';
import './java-work-orders.css';

const TOKEN_KEY = 'yunlan-java-api-token';
const ROLE_KEY = 'yunlan-java-api-role';
type Tab = 'tickets' | 'learning' | 'alerts';

function parseOptions(question: JavaQuestion): Array<[string, string]> {
  try {
    return Object.entries(JSON.parse(question.optionsJson) as Record<string, string>);
  } catch {
    return [];
  }
}

function formatDiagnosis(candidateJson: string): string {
  try {
    return JSON.stringify(JSON.parse(candidateJson), null, 2);
  } catch {
    return candidateJson;
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function nextStatus(status: JavaTicket['status']): JavaTicket['status'] | null {
  if (status === 'OPEN') return 'IN_PROGRESS';
  if (status === 'IN_PROGRESS') return 'RESOLVED';
  if (status === 'RESOLVED') return 'CLOSED';
  return null;
}

function assigneeLabel(members: JavaProjectMember[], userId: string | null): string {
  return members.find((member) => member.userId === userId)?.email ?? userId ?? 'Unassigned';
}

function userIdFromToken(token: string | null): string {
  if (!token) return '';
  try {
    const payload = token.split('.')[1];
    const paddedPayload = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const value = JSON.parse(atob(paddedPayload)) as { sub?: unknown };
    return typeof value.sub === 'string' ? value.sub : '';
  } catch {
    return '';
  }
}

export function JavaWorkOrdersPage() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [role, setRole] = useState(() => localStorage.getItem(ROLE_KEY) ?? '');
  const [currentUserId, setCurrentUserId] = useState(() =>
    userIdFromToken(localStorage.getItem(TOKEN_KEY))
  );
  const [email, setEmail] = useState('member@example.com');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<Tab>('tickets');
  const [tickets, setTickets] = useState<JavaTicket[]>([]);
  const [projects, setProjects] = useState<JavaProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectMembers, setProjectMembers] = useState<JavaProjectMember[]>([]);
  const [ticketStats, setTicketStats] = useState<JavaTicketStats | null>(null);
  const [notifications, setNotifications] = useState<JavaTicketNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [ticketComments, setTicketComments] = useState<JavaTicketComment[]>([]);
  const [ticketEvents, setTicketEvents] = useState<JavaTicketEvent[]>([]);
  const [ticketAssignmentEvents, setTicketAssignmentEvents] = useState<JavaTicketAssignmentEvent[]>(
    []
  );
  const [commentBody, setCommentBody] = useState('');
  const [questions, setQuestions] = useState<JavaQuestion[]>([]);
  const [alerts, setAlerts] = useState<JavaAlertGroup[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [attempt, setAttempt] = useState<JavaAttempt | null>(null);
  const [pendingReviews, setPendingReviews] = useState<JavaAttempt[]>([]);
  const [reviewDraft, setReviewDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assignmentDraft, setAssignmentDraft] = useState('');
  const [answer, setAnswer] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [alertDevice, setAlertDevice] = useState('demo-device-1');
  const [alertType, setAlertType] = useState('temperature');
  const [alertLevel, setAlertLevel] = useState('WARNING');
  const [alertMessage, setAlertMessage] = useState(
    'Temperature exceeded the configured threshold.'
  );

  const selectedQuestion =
    questions.find((question) => question.id === selectedQuestionId) ?? questions[0];
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const options = useMemo(
    () => (selectedQuestion ? parseOptions(selectedQuestion) : []),
    [selectedQuestion]
  );
  const isStaff = role === 'TEACHER' || role === 'ADMIN';
  const canChangeAssignee =
    selectedTicket !== null && (role === 'ADMIN' || selectedTicket.reporterId === currentUserId);

  async function loadData(activeToken: string, requestedProjectId = selectedProjectId) {
    setBusy(true);
    setError('');
    try {
      const canReview = ['TEACHER', 'ADMIN'].includes(localStorage.getItem(ROLE_KEY) ?? '');
      const projectResponse = await listProjects(activeToken);
      const activeProjectId = projectResponse.projects.some(
        (project) => project.id === requestedProjectId
      )
        ? requestedProjectId
        : (projectResponse.projects[0]?.id ?? '');
      const [
        ticketResponse,
        questionResponse,
        alertResponse,
        statsResponse,
        notificationResponse,
        pendingResponse,
        memberResponse
      ] = await Promise.all([
        activeProjectId
          ? listTickets(activeToken, activeProjectId)
          : Promise.resolve<{ tickets: JavaTicket[] }>({ tickets: [] }),
        listQuestions(activeToken),
        listAlerts(activeToken),
        activeProjectId
          ? getTicketStats(activeToken, activeProjectId)
          : Promise.resolve<JavaTicketStats>({
              total: 0,
              byStatus: { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 }
            }),
        listTicketNotifications(activeToken),
        canReview
          ? listPendingReviews(activeToken)
          : Promise.resolve<{ attempts: JavaAttempt[] }>({ attempts: [] }),
        activeProjectId
          ? listProjectMembers(activeToken, activeProjectId)
          : Promise.resolve<{ members: JavaProjectMember[] }>({ members: [] })
      ]);
      setTickets(ticketResponse.tickets);
      setProjects(projectResponse.projects);
      setSelectedProjectId(activeProjectId);
      setProjectMembers(memberResponse.members);
      setTicketStats(statsResponse);
      setNotifications(notificationResponse.notifications);
      setUnreadCount(notificationResponse.unreadCount);
      setQuestions(questionResponse.questions);
      setSelectedQuestionId((current) => current || questionResponse.questions[0]?.id || '');
      setAlerts(alertResponse.alerts);
      setPendingReviews(pendingResponse.attempts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Java API data loading failed.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (token) void loadData(token);
  }, [token]);

  async function loadTicketDetails(activeToken: string, ticketId: string) {
    try {
      const [commentsResponse, eventsResponse, assignmentsResponse] = await Promise.all([
        listTicketComments(activeToken, ticketId),
        listTicketEvents(activeToken, ticketId),
        listTicketAssignmentEvents(activeToken, ticketId)
      ]);
      setTicketComments(commentsResponse.comments);
      setTicketEvents(eventsResponse.events);
      setTicketAssignmentEvents(assignmentsResponse.assignments);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ticket details loading failed.');
    }
  }

  useEffect(() => {
    if (!token || !selectedTicketId) {
      setTicketComments([]);
      setTicketEvents([]);
      setTicketAssignmentEvents([]);
      return;
    }
    void loadTicketDetails(token, selectedTicketId);
  }, [token, selectedTicketId]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await login(email, password);
      localStorage.setItem(TOKEN_KEY, response.token);
      localStorage.setItem(ROLE_KEY, response.role);
      setToken(response.token);
      setRole(response.role);
      setCurrentUserId(response.userId);
      setNotice(`Signed in as ${response.email}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    setToken(null);
    setRole('');
    setCurrentUserId('');
    setTickets([]);
    setProjects([]);
    setSelectedProjectId('');
    setProjectMembers([]);
    setQuestions([]);
    setAlerts([]);
    setPendingReviews([]);
    setReviewDraft('');
    setTicketStats(null);
    setNotifications([]);
    setUnreadCount(0);
    setSelectedTicketId('');
    setTicketComments([]);
    setTicketEvents([]);
    setTicketAssignmentEvents([]);
    setAssignmentDraft('');
  }

  async function handleAddComment(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !selectedTicketId || !commentBody.trim()) return;
    setBusy(true);
    setError('');
    try {
      const comment = await addTicketComment(token, selectedTicketId, commentBody);
      setTicketComments((current) => [...current, comment]);
      setCommentBody('');
      setNotice('Comment added.');
      void loadData(token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Comment creation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReadNotification(notification: JavaTicketNotification) {
    if (!token || notification.readAt) return;
    try {
      await markTicketNotificationRead(token, notification.id);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Notification update failed.');
    }
  }

  async function handleCreateTicket(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !selectedProjectId) return;
    setBusy(true);
    setError('');
    try {
      await createTicket(token, {
        projectId: selectedProjectId,
        title: ticketTitle,
        description: ticketDescription,
        ...(assigneeId ? { assigneeId } : {})
      });
      setTicketTitle('');
      setTicketDescription('');
      setAssigneeId('');
      await loadData(token, selectedProjectId);
      setNotice('Ticket created.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ticket creation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(ticket: JavaTicket) {
    if (!token) return;
    const status = nextStatus(ticket.status);
    if (!status) return;
    setBusy(true);
    setError('');
    try {
      const updated = await changeTicketStatus(token, ticket, status);
      setTickets((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      await Promise.all([loadData(token, selectedProjectId), loadTicketDetails(token, ticket.id)]);
      setNotice(`Ticket moved to ${status}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Status update failed.');
    } finally {
      setBusy(false);
    }
  }

  function handleProjectChange(projectId: string) {
    if (!token) return;
    setSelectedTicketId('');
    setAssigneeId('');
    setAssignmentDraft('');
    void loadData(token, projectId);
  }

  function selectTicket(ticket: JavaTicket) {
    setSelectedTicketId(ticket.id);
    setAssignmentDraft(ticket.assigneeId ?? '');
  }

  async function handleAssigneeChange(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !selectedTicket) return;
    setBusy(true);
    setError('');
    try {
      const updated = await changeTicketAssignee(token, selectedTicket, assignmentDraft || null);
      setTickets((current) =>
        current.map((ticket) => (ticket.id === updated.id ? updated : ticket))
      );
      setAssignmentDraft(updated.assigneeId ?? '');
      await Promise.all([loadData(token, selectedProjectId), loadTicketDetails(token, updated.id)]);
      setNotice('Assignee updated.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Assignee update failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAttempt(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !selectedQuestion) return;
    setBusy(true);
    setError('');
    try {
      const result = await submitAttempt(token, {
        questionId: selectedQuestion.id,
        selectedAnswer: answer,
        reasoning
      });
      setAttempt(result);
      setReviewDraft(result.diagnosisJson ?? '');
      setNotice(
        result.correct ? 'Correct answer recorded.' : 'Diagnosis candidate created for review.'
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Attempt submission failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReview(status: 'CONFIRMED' | 'REJECTED') {
    if (!token || !attempt) return;
    setBusy(true);
    setError('');
    try {
      const updated = await reviewAttempt(
        token,
        attempt.id,
        status,
        status === 'CONFIRMED' ? reviewDraft : undefined
      );
      setAttempt(updated);
      setReviewDraft(updated.diagnosisJson ?? '');
      setPendingReviews((current) => current.filter((item) => item.id !== updated.id));
      setNotice(`Diagnosis ${status.toLowerCase()}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Diagnosis review failed.');
    } finally {
      setBusy(false);
    }
  }

  function selectPendingReview(selectedAttempt: JavaAttempt) {
    setAttempt(selectedAttempt);
    setReviewDraft(selectedAttempt.diagnosisJson ?? '');
    setNotice('Pending diagnosis selected for review.');
  }

  async function handleAlert(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const response = await submitAlert(token, {
        deviceId: alertDevice,
        alertType,
        level: alertLevel,
        message: alertMessage,
        occurredAt: new Date().toISOString()
      });
      setNotice(`Alert accepted. Queue size: ${response.queuedCount}.`);
      window.setTimeout(() => void loadData(token), 250);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Alert submission failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="java-work-orders-page java-work-orders-auth">
        <section className="java-work-orders-panel java-work-orders-login-panel">
          <div className="java-work-orders-kicker">
            <ShieldCheck size={16} /> Java work-order API
          </div>
          <h1>Work order workspace</h1>
          <p>Sign in to test tickets, learning diagnosis, and alert aggregation.</p>
          <form onSubmit={handleLogin} className="java-work-orders-form">
            <label>
              Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
              />
            </label>
            <label>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
              />
            </label>
            <button type="submit" disabled={busy}>
              <LogIn size={16} /> Sign in
            </button>
          </form>
          {error ? (
            <p className="java-work-orders-error" role="alert">
              {error}
            </p>
          ) : null}
          <small>Development seed accounts require APP_DEV_SEED_ENABLED=true.</small>
        </section>
      </main>
    );
  }

  return (
    <main className="java-work-orders-page">
      <header className="java-work-orders-header">
        <div>
          <div className="java-work-orders-kicker">
            <ClipboardList size={16} /> Java API workspace
          </div>
          <h1>Work orders</h1>
          <p>Tickets, verified learning diagnosis, and bounded alert processing.</p>
        </div>
        <div className="java-work-orders-account">
          <span>{role}</span>
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <nav className="java-work-orders-tabs" aria-label="Work-order domains">
        <button
          className={tab === 'tickets' ? 'is-active' : ''}
          onClick={() => setTab('tickets')}
          type="button"
        >
          Tickets
        </button>
        <button
          className={tab === 'learning' ? 'is-active' : ''}
          onClick={() => setTab('learning')}
          type="button"
        >
          Learning
        </button>
        <button
          className={tab === 'alerts' ? 'is-active' : ''}
          onClick={() => setTab('alerts')}
          type="button"
        >
          Alerts
        </button>
      </nav>
      {error ? (
        <div className="java-work-orders-error" role="alert">
          <AlertTriangle size={16} /> {error}
        </div>
      ) : null}
      {notice ? (
        <div className="java-work-orders-notice" role="status">
          <CheckCircle2 size={16} /> {notice}
        </div>
      ) : null}

      {tab === 'tickets' ? (
        <section className="java-work-orders-grid">
          <form
            className="java-work-orders-panel java-work-orders-form"
            onSubmit={handleCreateTicket}
          >
            <h2>Create ticket</h2>
            <label>
              Project
              <select
                value={selectedProjectId}
                onChange={(event) => handleProjectChange(event.target.value)}
                required
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input
                value={ticketTitle}
                onChange={(event) => setTicketTitle(event.target.value)}
                required
              />
            </label>
            <label>
              Description
              <textarea
                value={ticketDescription}
                onChange={(event) => setTicketDescription(event.target.value)}
                required
              />
            </label>
            <label>
              Assignee
              <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
                <option value="">Unassigned</option>
                {projectMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.email} ({member.role})
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={busy}>
              <Send size={16} /> Create ticket
            </button>
          </form>
          <section className="java-work-orders-panel">
            <div className="java-work-orders-section-heading">
              <h2>Project tickets</h2>
              <button
                type="button"
                onClick={() => token && void loadData(token)}
                title="Refresh tickets"
              >
                <RefreshCw size={15} />
              </button>
            </div>
            {ticketStats ? (
              <div className="java-work-orders-stat-strip">
                <strong>{ticketStats.total} total</strong>
                {Object.entries(ticketStats.byStatus).map(([status, count]) => (
                  <span key={status}>
                    {status}: {count}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="java-work-orders-list">
              {tickets.map((ticket) => {
                const next = nextStatus(ticket.status);
                return (
                  <article
                    className={`java-work-orders-item ${selectedTicketId === ticket.id ? 'is-selected' : ''}`}
                    key={ticket.id}
                  >
                    <div>
                      <button
                        className="java-work-orders-link"
                        type="button"
                        onClick={() => selectTicket(ticket)}
                      >
                        <strong>{ticket.title}</strong>
                      </button>
                      <p>{ticket.description}</p>
                      <small>Assignee: {assigneeLabel(projectMembers, ticket.assigneeId)}</small>
                    </div>
                    <div className="java-work-orders-item-meta">
                      <span>{ticket.status}</span>
                      {next ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleStatusChange(ticket)}
                        >
                          Move to {next}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
              {!tickets.length ? <p>No tickets yet.</p> : null}
            </div>
          </section>
          <section className="java-work-orders-panel">
            <div className="java-work-orders-section-heading">
              <h2>
                <MessageSquare size={17} /> Ticket collaboration
              </h2>
              {selectedTicketId ? <span>{ticketComments.length} comments</span> : null}
            </div>
            {selectedTicketId ? (
              <>
                {canChangeAssignee ? (
                  <form className="java-work-orders-form" onSubmit={handleAssigneeChange}>
                    <label>
                      Assignee
                      <select
                        value={assignmentDraft}
                        onChange={(event) => setAssignmentDraft(event.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {projectMembers.map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {member.email} ({member.role})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" disabled={busy}>
                      Update assignee
                    </button>
                  </form>
                ) : null}
                <div className="java-work-orders-events">
                  <h3>Assignment history</h3>
                  {ticketAssignmentEvents.map((event) => (
                    <small key={event.id}>
                      {assigneeLabel(projectMembers, event.previousAssigneeId)} to{' '}
                      {assigneeLabel(projectMembers, event.assigneeId)} -{' '}
                      {new Date(event.createdAt).toLocaleString()}
                    </small>
                  ))}
                  {!ticketAssignmentEvents.length ? (
                    <small>No assignment changes yet.</small>
                  ) : null}
                </div>
                <div className="java-work-orders-comments">
                  {ticketComments.map((comment) => (
                    <article key={comment.id}>
                      <p>{comment.body}</p>
                      <small>
                        {comment.authorId} · {new Date(comment.createdAt).toLocaleString()}
                      </small>
                    </article>
                  ))}
                  {!ticketComments.length ? <p>No comments yet.</p> : null}
                </div>
                <form className="java-work-orders-form" onSubmit={handleAddComment}>
                  <label>
                    Add comment
                    <textarea
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                      required
                    />
                  </label>
                  <button type="submit" disabled={busy}>
                    <Send size={16} /> Comment
                  </button>
                </form>
                <div className="java-work-orders-events">
                  <h3>
                    <History size={15} /> Status history
                  </h3>
                  {ticketEvents.map((event) => (
                    <small key={event.id}>
                      {event.fromStatus} → {event.toStatus} ·{' '}
                      {new Date(event.createdAt).toLocaleString()}
                    </small>
                  ))}
                </div>
              </>
            ) : (
              <p>Select a ticket to view comments and status history.</p>
            )}
          </section>
          <section className="java-work-orders-panel">
            <div className="java-work-orders-section-heading">
              <h2>
                <Bell size={17} /> Notifications
              </h2>
              <span>{unreadCount} unread</span>
            </div>
            <div className="java-work-orders-list">
              {notifications.map((notification) => (
                <article
                  className={`java-work-orders-item ${notification.readAt ? '' : 'is-unread'}`}
                  key={notification.id}
                >
                  <div>
                    <strong>{notification.type}</strong>
                    <p>{notification.message}</p>
                  </div>
                  {!notification.readAt ? (
                    <button type="button" onClick={() => void handleReadNotification(notification)}>
                      Mark read
                    </button>
                  ) : null}
                </article>
              ))}
              {!notifications.length ? <p>No notifications.</p> : null}
            </div>
          </section>
        </section>
      ) : null}

      {tab === 'learning' ? (
        <section className="java-work-orders-grid">
          <section className="java-work-orders-panel">
            <h2>Question bank</h2>
            <select
              value={selectedQuestion?.id ?? ''}
              onChange={(event) => setSelectedQuestionId(event.target.value)}
            >
              {questions.map((question) => (
                <option key={question.id} value={question.id}>
                  {question.stem}
                </option>
              ))}
            </select>
            {selectedQuestion ? (
              <>
                <p>{selectedQuestion.stem}</p>
                <div className="java-work-orders-options">
                  {options.map(([key, value]) => (
                    <button
                      className={answer === key ? 'is-selected' : ''}
                      key={key}
                      type="button"
                      onClick={() => setAnswer(key)}
                    >
                      <b>{key}</b>
                      {value}
                    </button>
                  ))}
                </div>
                <form className="java-work-orders-form" onSubmit={handleAttempt}>
                  <label>
                    Reasoning
                    <textarea
                      value={reasoning}
                      onChange={(event) => setReasoning(event.target.value)}
                    />
                  </label>
                  <button type="submit" disabled={busy || !answer}>
                    <Send size={16} /> Submit answer
                  </button>
                </form>
              </>
            ) : (
              <p>No questions available.</p>
            )}
          </section>
          <section className="java-work-orders-panel">
            <h2>Diagnosis result</h2>
            {attempt ? (
              <>
                <p>
                  {attempt.correct
                    ? 'Correct. No model diagnosis was requested.'
                    : attempt.reviewStatus === 'CONFIRMED'
                      ? 'The teacher confirmed this diagnosis.'
                      : 'Incorrect. The candidate diagnosis is held for teacher review.'}
                </p>
                {attempt.diagnosisJson ? (
                  <pre>{formatDiagnosis(attempt.diagnosisJson)}</pre>
                ) : (
                  <p>No diagnosis is available yet.</p>
                )}
                {isStaff && attempt.reviewStatus === 'PENDING' && attempt.diagnosisJson ? (
                  <form
                    className="java-work-orders-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleReview('CONFIRMED');
                    }}
                  >
                    <label>
                      Candidate diagnosis JSON
                      <textarea
                        value={reviewDraft}
                        onChange={(event) => setReviewDraft(event.target.value)}
                        required
                      />
                    </label>
                    <div className="java-work-orders-actions">
                      <button type="submit" disabled={busy}>
                        Confirm edited diagnosis
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleReview('REJECTED')}
                      >
                        Reject
                      </button>
                    </div>
                  </form>
                ) : null}
              </>
            ) : (
              <p>Submit an answer or select a pending review.</p>
            )}
          </section>
          {isStaff ? (
            <section className="java-work-orders-panel java-work-orders-review-queue">
              <div className="java-work-orders-section-heading">
                <h2>Pending reviews</h2>
                <span>{pendingReviews.length}</span>
              </div>
              <div className="java-work-orders-list">
                {pendingReviews.map((pending) => (
                  <button
                    className={`java-work-orders-review-item ${attempt?.id === pending.id ? 'is-selected' : ''}`}
                    key={pending.id}
                    type="button"
                    onClick={() => selectPendingReview(pending)}
                  >
                    <strong>Question {pending.questionId.slice(0, 8)}</strong>
                    <span>
                      Learner {pending.learnerId.slice(0, 8)} · Answer {pending.selectedAnswer}
                    </span>
                  </button>
                ))}
                {!pendingReviews.length ? <p>No pending diagnoses.</p> : null}
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

      {tab === 'alerts' ? (
        <section className="java-work-orders-grid">
          <form className="java-work-orders-panel java-work-orders-form" onSubmit={handleAlert}>
            <h2>Submit alert</h2>
            <label>
              Device
              <input
                value={alertDevice}
                onChange={(event) => setAlertDevice(event.target.value)}
                required
              />
            </label>
            <label>
              Type
              <input
                value={alertType}
                onChange={(event) => setAlertType(event.target.value)}
                required
              />
            </label>
            <label>
              Level
              <select value={alertLevel} onChange={(event) => setAlertLevel(event.target.value)}>
                <option>INFO</option>
                <option>WARNING</option>
                <option>CRITICAL</option>
              </select>
            </label>
            <label>
              Message
              <textarea
                value={alertMessage}
                onChange={(event) => setAlertMessage(event.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              <Send size={16} /> Submit
            </button>
          </form>
          <section className="java-work-orders-panel">
            <div className="java-work-orders-section-heading">
              <h2>Alert groups</h2>
              <button type="button" onClick={() => token && void loadData(token)}>
                <RefreshCw size={15} />
              </button>
            </div>
            <div className="java-work-orders-list">
              {alerts.map((alert) => (
                <article className="java-work-orders-item" key={alert.id}>
                  <div>
                    <strong>
                      {alert.deviceId} · {alert.alertType}
                    </strong>
                    <p>{alert.message}</p>
                  </div>
                  <div className="java-work-orders-item-meta">
                    <span>{alert.level}</span>
                    <small>{alert.repeatCount} repeats</small>
                    <small>First {formatDate(alert.firstSeenAt)}</small>
                    <small>Last {formatDate(alert.lastSeenAt)}</small>
                  </div>
                </article>
              ))}
              {!alerts.length ? <p>No alert groups yet.</p> : null}
            </div>
          </section>
        </section>
      ) : null}
    </main>
  );
}
