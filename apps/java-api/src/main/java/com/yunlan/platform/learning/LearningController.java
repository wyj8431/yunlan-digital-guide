package com.yunlan.platform.learning;

import com.yunlan.platform.common.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/learning")
public class LearningController {
    private final LearningService learningService;

    public LearningController(LearningService learningService) {
        this.learningService = learningService;
    }

    @GetMapping("/questions")
    public Map<String, List<LearningDtos.QuestionResponse>> listQuestions() {
        return Map.of("questions", learningService.listQuestions());
    }

    @PostMapping("/attempts")
    public LearningDtos.AttemptResponse submit(
            @Valid @RequestBody LearningDtos.SubmitAttemptRequest request,
            Authentication authentication
    ) {
        return learningService.submit(request, CurrentUser.require(authentication));
    }

    @GetMapping("/attempts/{id}")
    public LearningDtos.AttemptResponse get(
            @PathVariable UUID id,
            Authentication authentication
    ) {
        return learningService.getAttempt(id, CurrentUser.require(authentication));
    }

    @GetMapping("/reviews/pending")
    public Map<String, List<LearningDtos.AttemptResponse>> listPendingReviews(Authentication authentication) {
        return Map.of("attempts", learningService.listPendingReviews(CurrentUser.require(authentication)));
    }

    @PostMapping("/attempts/{id}/review")
    public LearningDtos.AttemptResponse review(
            @PathVariable UUID id,
            @Valid @RequestBody LearningDtos.ReviewRequest request,
            Authentication authentication
    ) {
        return learningService.review(id, request, CurrentUser.require(authentication));
    }
}
