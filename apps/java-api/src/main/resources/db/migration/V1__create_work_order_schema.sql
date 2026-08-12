CREATE TABLE app_users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE project_members (
    project_id UUID NOT NULL REFERENCES projects(id),
    user_id UUID NOT NULL REFERENCES app_users(id),
    PRIMARY KEY (project_id, user_id)
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    reporter_id UUID NOT NULL REFERENCES app_users(id),
    assignee_id UUID REFERENCES app_users(id),
    status VARCHAR(32) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE ticket_events (
    id BIGSERIAL PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES tickets(id),
    actor_id UUID NOT NULL REFERENCES app_users(id),
    from_status VARCHAR(32) NOT NULL,
    to_status VARCHAR(32) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE (ticket_id, idempotency_key)
);

CREATE TABLE learning_questions (
    id UUID PRIMARY KEY,
    stem TEXT NOT NULL,
    options_json TEXT NOT NULL,
    correct_answer VARCHAR(8) NOT NULL,
    solution TEXT NOT NULL,
    knowledge_point_id VARCHAR(80) NOT NULL,
    difficulty VARCHAR(32) NOT NULL
);

CREATE TABLE learning_attempts (
    id UUID PRIMARY KEY,
    question_id UUID NOT NULL REFERENCES learning_questions(id),
    learner_id UUID NOT NULL REFERENCES app_users(id),
    selected_answer VARCHAR(8) NOT NULL,
    reasoning TEXT,
    correct BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE learning_diagnoses (
    id UUID PRIMARY KEY,
    attempt_id UUID NOT NULL UNIQUE REFERENCES learning_attempts(id),
    candidate_json TEXT NOT NULL,
    validation_status VARCHAR(32) NOT NULL,
    review_status VARCHAR(32) NOT NULL,
    reviewer_id UUID REFERENCES app_users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE alert_groups (
    id UUID PRIMARY KEY,
    device_id VARCHAR(120) NOT NULL,
    alert_type VARCHAR(120) NOT NULL,
    bucket_start TIMESTAMP WITH TIME ZONE NOT NULL,
    level VARCHAR(32) NOT NULL,
    message TEXT NOT NULL,
    repeat_count INTEGER NOT NULL,
    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE (device_id, alert_type, bucket_start)
);

CREATE INDEX idx_tickets_project_status ON tickets(project_id, status);
CREATE INDEX idx_ticket_events_ticket ON ticket_events(ticket_id, created_at);
CREATE INDEX idx_attempts_learner ON learning_attempts(learner_id, created_at);
CREATE INDEX idx_alert_groups_last_seen ON alert_groups(last_seen_at);
