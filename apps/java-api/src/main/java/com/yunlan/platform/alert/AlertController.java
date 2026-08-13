package com.yunlan.platform.alert;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {
    // WO-3: alert intake and compatibility contract remain explicitly versioned.
    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    @PostMapping
    public ResponseEntity<AlertDtos.AcceptedResponse> submit(@Valid @RequestBody AlertDtos.SubmitRequest request) {
        return ResponseEntity.accepted().body(alertService.submit(request));
    }

    @PostMapping("/compat/v1")
    public ResponseEntity<AlertDtos.AcceptedResponse> submitCompatibility(
            @Valid @RequestBody AlertDtos.CompatibilitySubmitRequest request
    ) {
        return ResponseEntity.accepted().body(alertService.submit(request.toSubmitRequest()));
    }

    @GetMapping
    public Map<String, List<AlertDtos.AlertGroupResponse>> list() {
        return Map.of("alerts", alertService.list());
    }
}
