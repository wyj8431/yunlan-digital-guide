package com.yunlan.platform.ticket;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TicketTest {
    @Test
    void followsTheApprovedStatusMachine() {
        var ticket = new Ticket(
                UUID.randomUUID(),
                "Add status flow",
                "Implement it",
                UUID.randomUUID(),
                null
        );

        ticket.changeStatus(TicketStatus.IN_PROGRESS);
        ticket.changeStatus(TicketStatus.RESOLVED);
        ticket.changeStatus(TicketStatus.CLOSED);

        assertEquals(TicketStatus.CLOSED, ticket.getStatus());
    }

    @Test
    void rejectsIllegalStatusTransitions() {
        var ticket = new Ticket(
                UUID.randomUUID(),
                "Close directly",
                "Must not skip review",
                UUID.randomUUID(),
                null
        );

        assertThrows(IllegalStateException.class, () -> ticket.changeStatus(TicketStatus.CLOSED));
    }
}
