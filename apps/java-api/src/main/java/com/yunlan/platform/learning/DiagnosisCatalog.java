package com.yunlan.platform.learning;

import java.util.List;

public final class DiagnosisCatalog {
    private static final List<String> KNOWLEDGE_POINT_IDS = List.of(
            "equation-one-variable",
            "equation-simplify",
            "equation-transpose",
            "equation-coefficients",
            "equation-fractions",
            "equation-check"
    );
    private static final List<String> ERROR_TYPE_IDS = List.of(
            "SIGN_OR_TRANSPOSE_ERROR",
            "ARITHMETIC_ERROR",
            "DISTRIBUTIVE_PROPERTY_ERROR",
            "COEFFICIENT_DIVISION_ERROR",
            "FRACTION_OPERATION_ERROR",
            "UNDERSTANDING_ERROR"
    );
    private static final List<String> RESOURCE_IDS = List.of(
            "resource-equation-basics",
            "resource-equation-simplify",
            "resource-transpose-practice",
            "resource-coefficient-practice",
            "resource-fraction-basics",
            "resource-fraction-practice",
            "resource-distributive-property",
            "resource-negative-coefficients",
            "resource-equation-check",
            "resource-substitution-practice",
            "resource-mixed-review",
            "resource-word-problem-equations"
    );

    private DiagnosisCatalog() {
    }

    public static boolean hasKnowledgePoint(String id) {
        return KNOWLEDGE_POINT_IDS.contains(id);
    }

    public static boolean hasErrorType(String id) {
        return ERROR_TYPE_IDS.contains(id);
    }

    public static boolean hasResource(String id) {
        return RESOURCE_IDS.contains(id);
    }

    public static String errorTypeIdsForPrompt() {
        return String.join(", ", ERROR_TYPE_IDS);
    }

    public static String errorTypeGuidanceForPrompt() {
        return """
                Choose the primary error that caused the incorrect answer. Prefer a specific method error over ARITHMETIC_ERROR.
                SIGN_OR_TRANSPOSE_ERROR: applying an inverse operation or moving a term across the equality sign incorrectly.
                ARITHMETIC_ERROR: a numerical calculation is wrong after the algebraic method is otherwise correct; use this for an omitted or incorrect ordinary add, subtract, multiply, or divide step that is not a coefficient or fraction method error.
                DISTRIBUTIVE_PROPERTY_ERROR: failing to apply a factor to every term in parentheses, or simplifying a parenthesized expression while losing or changing a variable term. This includes evaluating only the constant inside parentheses while dropping the complete expression; choose this over ARITHMETIC_ERROR for that parenthesized-expression method error.
                COEFFICIENT_DIVISION_ERROR: removing a variable coefficient with the wrong operation, or mishandling the sign while dividing by a coefficient.
                FRACTION_OPERATION_ERROR: reversing a division or fraction operation incorrectly, including using the wrong sequence to isolate a variable in a fractional equation. If the fraction was correctly eliminated and the remaining mistake is an ordinary add, subtract, multiply, or divide step, use ARITHMETIC_ERROR instead.
                UNDERSTANDING_ERROR: a conceptual misuse of the task, such as an invalid substitution or verification, rather than a calculation mistake.
                """.trim();
    }

    public static String resourceIdsForPrompt() {
        return String.join(", ", RESOURCE_IDS);
    }
}
