package com.yunlan.platform.ticket;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, ProjectMember.Key> {
    boolean existsByProjectIdAndUserId(UUID projectId, UUID userId);

    List<ProjectMember> findAllByProjectId(UUID projectId);

    @Query("select member.projectId from ProjectMember member where member.userId = :userId")
    List<UUID> findProjectIdsByUserId(UUID userId);
}
