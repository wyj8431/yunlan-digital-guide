CREATE TABLE ticket_creation_requests (
    id UUID PRIMARY KEY,
    actor_id UUID NOT NULL REFERENCES app_users(id),
    idempotency_key VARCHAR(120) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    ticket_id UUID NOT NULL UNIQUE REFERENCES tickets(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_ticket_creation_requests_actor_key UNIQUE (actor_id, idempotency_key)
);

CREATE INDEX idx_ticket_creation_requests_ticket ON ticket_creation_requests(ticket_id);
