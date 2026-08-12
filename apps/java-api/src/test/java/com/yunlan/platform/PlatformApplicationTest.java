package com.yunlan.platform;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
@ActiveProfiles("test")
class PlatformApplicationTest {
    @Test
    void applicationContextLoads() {
        assertNotNull(PlatformApplication.class);
    }
}
