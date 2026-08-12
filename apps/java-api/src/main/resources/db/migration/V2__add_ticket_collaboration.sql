CREATE TABLE ticket_comments (
    id UUID PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES tickets(id),
    author_id UUID NOT NULL REFERENCES app_users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE ticket_notifications (
    id UUID PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES app_users(id),
    ticket_id UUID REFERENCES tickets(id),
    notification_type VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id, created_at);
CREATE INDEX idx_ticket_notifications_recipient ON ticket_notifications(recipient_id, created_at);
