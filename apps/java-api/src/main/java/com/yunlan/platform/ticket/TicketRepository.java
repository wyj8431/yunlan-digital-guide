package com.yunlan.platform.ticket;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TicketRepository extends JpaRepository<Ticket, UUID> {
    List<Ticket> findAllByProjectIdInOrderByUpdatedAtDesc(List<UUID> projectIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select ticket from Ticket ticket where ticket.id = :id")
    Optional<Ticket> findByIdForUpdate(@Param("id") UUID id);
}
