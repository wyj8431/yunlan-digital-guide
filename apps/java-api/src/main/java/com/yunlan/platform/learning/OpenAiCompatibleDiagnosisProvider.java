package com.yunlan.platform.learning;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.yunlan.platform.common.api.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Component
@Profile("real-learning-model")
public class OpenAiCompatibleDiagnosisProvider implements DiagnosisProvider {
    private final RestClient client;
    private final ObjectMapper objectMapper;
    private final DiagnosisValidator validator;
    private final String model;

    public OpenAiCompatibleDiagnosisProvider(
            RestClient.Builder builder,
            ObjectMapper objectMapper,
            DiagnosisValidator validator,
            @Value("${app.learning.model-base-url}") String baseUrl,
            @Value("${app.learning.model-api-key}") String apiKey,
            @Value("${app.learning.model:gpt-4o-mini}") String model,
            @Value("${app.learning.timeout-seconds:20}") long timeoutSeconds
    ) {
        if (baseUrl.isBlank() || apiKey.isBlank()) {
            throw new IllegalArgumentException("Learning model URL and API key are required in real-learning-model profile");
        }
        var httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(timeoutSeconds))
                .build();
        var requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
        this.client = builder
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
        this.objectMapper = objectMapper;
        this.validator = validator;
        this.model = model;
    }

    @Override
    public DiagnosisCandidate generate(Question question, Attempt attempt) {
        for (var attemptNumber = 0; attemptNumber < 2; attemptNumber++) {
            try {
                return generateOnce(question, attempt);
            } catch (ApiException exception) {
                if (attemptNumber == 0 && isFormatError(exception)) {
                    continue;
                }
                throw exception;
            } catch (JsonProcessingException exception) {
                if (attemptNumber == 0) {
                    continue;
                }
                throw new ApiException(
                        "LEARNING_MODEL_INVALID_RESPONSE",
                        org.springframework.http.HttpStatus.BAD_GATEWAY,
                        "Learning diagnosis model did not return valid JSON."
                );
            } catch (Exception exception) {
                throw new ApiException(
                        "LEARNING_MODEL_FAILED",
                        org.springframework.http.HttpStatus.BAD_GATEWAY,
                        "Learning diagnosis model did not return a valid response."
                );
            }
        }
        throw new ApiException(
                "LEARNING_MODEL_FAILED",
                org.springframework.http.HttpStatus.BAD_GATEWAY,
                "Learning diagnosis model did not return a valid response."
        );
    }

    private DiagnosisCandidate generateOnce(Question question, Attempt attempt) throws Exception {
        var response = client.post()
                .uri("/chat/completions")
                .body(Map.of(
                        "model", model,
                        "temperature", 0,
                        "response_format", Map.of("type", "json_object"),
                        "messages", List.of(
                                Map.of(
                                        "role", "system",
                                        "content", "Return JSON only with exactly knowledgePointId, errorTypeId, evidence, and a seven-item plan. Each plan item must contain day, task, resourceId. Do not return a standard answer or any field not listed. Use only the supplied catalog identifiers."
                                ),
                                Map.of(
                                        "role", "user",
                                        "content", buildPrompt(question, attempt)
                                )
                        )
                ))
                .retrieve()
                .body(JsonNode.class);
        var content = extractContent(response);
        var root = objectMapper.readTree(content);
        validator.validateJsonShape(root);
        var candidate = objectMapper.treeToValue(root, DiagnosisCandidate.class);
        validator.validate(candidate);
        return candidate;
    }

    private boolean isFormatError(ApiException exception) {
        return exception.code().equals("LEARNING_MODEL_INVALID_RESPONSE")
                || exception.code().equals("INVALID_DIAGNOSIS");
    }

    private String buildPrompt(Question question, Attempt attempt) {
        return "Question: " + question.getStem()
                + "\nOptions: " + question.getOptionsJson()
                + "\nCanonical solution: " + question.getSolution()
                + "\nLearner answer: " + attempt.getSelectedAnswer()
                + "\nLearner reasoning: " + (attempt.getReasoning() == null ? "(not provided)" : attempt.getReasoning())
                + "\nAllowed knowledge point: " + question.getKnowledgePointId()
                + "\nAllowed error type IDs: " + DiagnosisCatalog.errorTypeIdsForPrompt()
                + "\nError type guidance:\n" + DiagnosisCatalog.errorTypeGuidanceForPrompt()
                + "\nAllowed resource IDs: " + DiagnosisCatalog.resourceIdsForPrompt();
    }

    private String extractContent(JsonNode response) {
        var content = response == null ? null : response.path("choices").path(0).path("message").path("content");
        if (content == null || content.isMissingNode() || !content.isTextual() || content.asText().isBlank()) {
            throw new ApiException(
                    "LEARNING_MODEL_INVALID_RESPONSE",
                    org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "Learning model response did not contain JSON content."
            );
        }
        return content.asText();
    }
}
