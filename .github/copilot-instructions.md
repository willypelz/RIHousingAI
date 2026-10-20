# Copilot Project Instructions

These instructions are for GitHub Copilot Chat and Agent mode in JetBrains IDEs. Follow them when working in this repository.

## 1. Start by understanding the project

Before editing code:

1. Inspect the repository structure and identify the language, framework, package manager, build system, and test tools.
2. Read relevant project documentation and existing agent instructions, including `README`, `AGENTS.md`, `.github/copilot-instructions.md`, and applicable files under `.github/instructions/`.
3. Inspect the implementation and tests related to the task. Follow established patterns instead of introducing a new architecture without a clear reason.
4. Check the working tree and preserve unrelated user changes. Never overwrite or discard work you did not create.
5. If important requirements are ambiguous, ask a concise clarifying question. Otherwise, state reasonable assumptions and proceed.

## 2. Plan and execute carefully

- For non-trivial work, briefly outline the implementation plan before editing.
- Prefer small, focused, reversible changes.
- Trace existing behavior and dependencies before changing public interfaces, database schemas, API contracts, or shared components.
- Do not claim a task is complete until you have run the relevant checks or clearly stated why they could not be run.
- Do not perform destructive operations, deploy to production, or make external changes without explicit authorization.

## 3. UI and frontend design

When a task involves a user interface:

- First identify the existing framework, design system, component library, styling approach, and routing conventions.
- Reuse existing components, tokens, typography, spacing, icons, and patterns where appropriate.
- Create a coherent, polished, distinctive interface rather than a generic template. Make design decisions that fit the product and its users.
- Establish a clear visual hierarchy, readable typography, balanced spacing, intentional color use, and consistent component states.
- Make layouts responsive across mobile, tablet, and desktop breakpoints.
- Support keyboard navigation, visible focus states, semantic HTML, accessible labels, and adequate color contrast.
- Include relevant loading, empty, error, disabled, and success states.
- Handle long text, missing data, validation errors, and narrow screens gracefully.
- Use the project's existing icon and image solutions. Avoid emoji as interface icons unless the product's established style calls for them.
- Avoid unnecessary animations, excessive gradients, decorative clutter, and layout changes unrelated to the task.
- Do not add a dependency when the existing stack can solve the problem cleanly.
- Follow the project's established approach to forms, validation, data fetching, state management, and error handling.
- If screenshots or a browser preview are available, inspect the result and fix visible layout or interaction problems.

## 4. Engineering quality

- Match the repository's naming, formatting, linting, and code organization conventions.
- Prefer clear, maintainable, typed code where the language and project support it.
- Keep functions and modules focused; avoid needless abstraction, duplication, and speculative generalization.
- Handle errors explicitly. Do not silently swallow exceptions or return fake success results.
- Preserve backwards compatibility unless a breaking change is requested and documented.
- Update relevant tests, documentation, types, and configuration when behavior changes.
- Do not add placeholder implementations, hard-coded production data, or TODOs as a substitute for required functionality.
- Do not modify generated files manually unless the project's workflow requires it.

## 5. Security and privacy

- Treat all external input as untrusted. Validate at appropriate system boundaries.
- Never hard-code secrets, tokens, passwords, private keys, or credentials. Use the project's approved secret-management approach and environment variables.
- Do not log sensitive data or expose secrets in UI messages, API responses, or error output.
- Apply least privilege, appropriate authorization checks, and safe defaults.
- Protect against common issues relevant to the stack, including injection, cross-site scripting, request forgery, insecure direct object references, unsafe deserialization, and path traversal.
- Use parameterized database queries and safe output encoding.
- Do not disable authentication, authorization, TLS verification, security checks, or tests merely to make a task pass.
- For AI/LLM features, treat model output and retrieved content as untrusted; validate tool arguments, enforce authorization outside the model, and avoid exposing secrets through prompts or logs.
- Do not upload project code or data to external services unless the task and configured tooling explicitly authorize it.

## 6. Testing and verification

After changes:

1. Run the narrowest relevant tests first.
2. Run applicable lint, type-check, build, and broader test commands when practical.
3. Add or update tests for new behavior, regressions, validation, and failure cases.
4. Review the diff for accidental changes, debugging code, secrets, unrelated formatting, and missing error handling.
5. Report the exact checks run and whether they passed. Never invent test results.

If a check cannot be run, state which check was skipped and why. Do not claim that code compiles, tests pass, or behavior was verified unless evidence supports that claim.

## 7. Git and change management

- Do not create commits, push branches, open pull requests, merge, or deploy unless explicitly asked.
- Do not reset, rebase, force-push, or discard user changes without explicit permission.
- Keep changes limited to the requested scope.
- When asked to review code, prioritize concrete bugs, security issues, regressions, and missing tests. Report findings with file paths and line references where possible.

## 8. Working with tools and dependencies

- Prefer repository scripts and documented commands over guessed commands.
- Check the lockfile and use the existing package manager.
- Do not upgrade packages or change runtime versions unless necessary for the task.
- Explain material trade-offs when multiple viable approaches exist.
- If a tool is unavailable, continue with the best safe alternative and disclose the limitation.

## 9. Communication

At the end of each task, provide a concise summary containing:

- **Implemented:** What changed and why.
- **Files:** The main files changed.
- **Verification:** Commands or tests run and their results.
- **Follow-ups:** Any remaining risks, assumptions, or work not completed.

Be direct and evidence-based. Distinguish facts from assumptions. Do not say work is complete if important requirements remain unmet.

## 10. Priority rule

Follow the user's explicit request and the repository's authoritative conventions, provided they do not conflict with security or safety requirements. These instructions supplement—not replace—framework documentation, repository-specific instructions, and tool-specific capabilities.
