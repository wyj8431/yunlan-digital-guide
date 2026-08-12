package com.yunlan.platform.ticket;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "project_members")
@IdClass(ProjectMember.Key.class)
public class ProjectMember {
    @Id
    @Column(name = "project_id")
    private UUID projectId;

    @Id
    @Column(name = "user_id")
    private UUID userId;

    protected ProjectMember() {
    }

    public ProjectMember(UUID projectId, UUID userId) {
        this.projectId = projectId;
        this.userId = userId;
    }

    public UUID getUserId() {
        return userId;
    }

    public static class Key implements Serializable {
        private UUID projectId;
        private UUID userId;

        public Key() {
        }

        public Key(UUID projectId, UUID userId) {
            this.projectId = projectId;
            this.userId = userId;
        }

        public UUID getProjectId() {
            return projectId;
        }

        public UUID getUserId() {
            return userId;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof Key key)) return false;
            return Objects.equals(projectId, key.projectId) && Objects.equals(userId, key.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(projectId, userId);
        }
    }
}
