# Repository Guide

## Scope

This repository contains the existing Node/Koa digital-human product and a Java 21/Spring Boot
implementation of three work-order domains. Keep the two systems isolated:

- `apps/server` remains the Node/Koa digital-human service.
- `apps/java-api` owns ticket collaboration, learning diagnosis, and device-alert processing.
- `apps/web` owns the React UI and proxies `/api/platform`, `/api/tickets`, `/api/learning`, and
  `/api/alerts` to the Java service during local development.

Do not move the digital-human APIs into the Java service or replace the existing Node/Koa application.

## Required Workflow

1. Read the affected controller, service, entity, repository, migration, and test before editing.
2. Describe the affected API, authorization, data, and rollback boundary before changing a Java
   write path or a database migration.
3. Add request validation, stable API errors, and focused tests for every new Java endpoint.
4. Keep React loading, error, refresh, and duplicate-submission states connected to real Java APIs.
5. Run the relevant focused tests before the full work-order harness.

## Java Work-Order Rules

- Ticket writes use project membership checks. Status and assignee changes must use optimistic
  versions and idempotency keys, and they must record the corresponding operation atomically.
- A ticket assignee must be a member of the ticket project. Only the reporter or an administrator
  may reassign an existing ticket.
- Learning grading stays deterministic. Model output is untrusted until it passes the controlled
  catalog and seven-day plan validation; learners see a diagnosis only after staff confirmation.
- Alert processing remains bounded: defaults are a queue of 100, four consumers, five-minute UTC
  buckets, atomic database aggregation, and graceful drain during shutdown.
- Flyway migrations are append-only. Never change an applied migration or bypass schema validation.

## Secrets And Data

- Do not place production keys, JWTs, connection strings, personal data, device identifiers, or
  production logs in source, tests, documentation, or AI prompts.
- Use the local H2 profile and seeded demo accounts only for local verification.
- Keep `.env` local. Update `.env.example` only with non-sensitive variable names and examples.

## Validation

Use the work-order harness after changes that touch the Java API or work-order UI:

```powershell
npm run check:work-orders
npm --workspace apps/web run test:e2e:work-orders
```

The E2E command requires the local Vite and Java services to be running. On a machine with GNU Make,
the static harness equivalent is `make check`. The harness runs root lint, work-order UI type checking,
and the Java Maven verification suite.

## Development Commands

```bash
npm run dev                          # server + web 并行启动
npm run typecheck                    # 全部 workspace 类型检查
npm test                             # 全部 workspace 单测
npm run lint                         # ESLint
npm run check:work-orders            # 工单静态 harness（lint + UI 类型检查 + Java Maven 验证）
npm run check:work-orders:e2e        # 工单 e2e（需 Vite + Java 已启动）
npm run check:work-orders:e2e:negative
npm run load:work-orders             # 压测
npm run evaluate:learning-golden     # learning 黄金样例评测
```

Java（git-bash 下 mvn 不在 PATH，用 `~/maven-dist/mvn-here.sh`；原生 cmd 用 `apps/java-api/mvnw.cmd`）：

```bash
~/maven-dist/mvn-here.sh -f apps/java-api/pom.xml test
```

## AI Collaboration Protocol (Loop & Evidence)

AI 协作开发必须遵循「生成 → 检查 → 修改 → 验证」循环，证据留存在 `artifacts/loop-N/`：

1. **生成**: 先读本文件与受影响代码，列出最小改动计划。
2. **检查**: 跑 typecheck / lint / compile，失败输出存 `artifacts/loop-N/test-fail.log`。
3. **修改**: 修复后重跑检查，直到全绿。
4. **验证**: 单测 + harness（`npm run check:work-orders`）+ **实测冒烟**（启动 server/web/java-api，浏览器打开页面走关键流程）。通过输出存 `artifacts/loop-N/test-pass.log` 与 `harness.log`。
5. **证据**: 每个 loop 目录至少含 `test-fail.log` / `test-pass.log` / `harness.log` / `review-round-N.md` / `README.md`，且独立 commit 可追溯。

**技能加载（Hermes）**: 在本仓库工作时必须加载 `dev-loop` 技能；改动 `apps/web` 的 React 代码时同时加载 `react-expert`（React 官方技能）。其他 Agent（Cursor / Claude Code / Codex）按本协议等效执行。

**React 开发注意**: 以 React 官方文档与源码行为为准，不依赖模型记忆中的旧模式；本仓库为 React 19 + Vite 7 + TypeScript 5.8。

## Out Of Scope Without Approval

- Changing the Java/Node service boundary or the Vite proxy contract.
- Changing authentication, role semantics, migration history, or alert response semantics.
- Guessing a legacy alert endpoint or payload contract that is not present in this repository.
- Adding external queues, worker threads, microservices, CI/CD, or Kubernetes.
