package com.yunlan.platform.auth;

import com.yunlan.platform.ticket.Project;
import com.yunlan.platform.ticket.ProjectMember;
import com.yunlan.platform.ticket.ProjectMemberRepository;
import com.yunlan.platform.ticket.ProjectRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

@Configuration
@ConditionalOnProperty(name = "app.dev-seed-enabled", havingValue = "true")
public class DevDataInitializer {
    static final UUID ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID MEMBER_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");
    static final UUID TEACHER_ID = UUID.fromString("00000000-0000-0000-0000-000000000003");
    static final UUID LEARNER_ID = UUID.fromString("00000000-0000-0000-0000-000000000004");
    static final UUID DEMO_PROJECT_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");
    static final UUID OPERATIONS_PROJECT_ID = UUID.fromString("10000000-0000-0000-0000-000000000002");

    @Bean
    CommandLineRunner seedDevelopmentData(
            UserAccountRepository users,
            PasswordEncoder passwordEncoder,
            ProjectRepository projects,
            ProjectMemberRepository members
    ) {
        return args -> {
            createUser(users, passwordEncoder, ADMIN_ID, "admin@example.com", "ADMIN");
            createUser(users, passwordEncoder, MEMBER_ID, "member@example.com", "MEMBER");
            createUser(users, passwordEncoder, TEACHER_ID, "teacher@example.com", "TEACHER");
            createUser(users, passwordEncoder, LEARNER_ID, "learner@example.com", "LEARNER");

            if (!projects.existsById(DEMO_PROJECT_ID)) {
                projects.save(new Project(DEMO_PROJECT_ID, "Yunlan Work Orders"));
            }
            if (!projects.existsById(OPERATIONS_PROJECT_ID)) {
                projects.save(new Project(OPERATIONS_PROJECT_ID, "Yunlan Operations"));
            }
            if (!members.existsByProjectIdAndUserId(DEMO_PROJECT_ID, ADMIN_ID)) {
                members.save(new ProjectMember(DEMO_PROJECT_ID, ADMIN_ID));
            }
            if (!members.existsByProjectIdAndUserId(DEMO_PROJECT_ID, MEMBER_ID)) {
                members.save(new ProjectMember(DEMO_PROJECT_ID, MEMBER_ID));
            }
            if (!members.existsByProjectIdAndUserId(OPERATIONS_PROJECT_ID, ADMIN_ID)) {
                members.save(new ProjectMember(OPERATIONS_PROJECT_ID, ADMIN_ID));
            }
            if (!members.existsByProjectIdAndUserId(OPERATIONS_PROJECT_ID, MEMBER_ID)) {
                members.save(new ProjectMember(OPERATIONS_PROJECT_ID, MEMBER_ID));
            }
        };
    }

    private void createUser(
            UserAccountRepository users,
            PasswordEncoder passwordEncoder,
            UUID id,
            String email,
            String role
    ) {
        if (!users.existsById(id)) {
            users.save(new UserAccount(id, email, passwordEncoder.encode("change-me"), role));
        }
    }
}
