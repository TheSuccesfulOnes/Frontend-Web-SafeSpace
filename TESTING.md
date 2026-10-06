# Frontend validation tests

Run `npm ci`, then `npm test` from this repository with Node 24 or newer. The command runs all retained Node tests and all Vitest tests, rejects failed/skipped/unclassified cases, requires at least 20 executed cases for each validation owner, checks that every file under `src/` is inventoried, and regenerates `tests/validation-inventory.json` and the table below. Parameterized rows are separate executed cases; loops and assertions inside a case are never counted separately.

On Windows, stop an existing Vite instance before a clean dependency reinstall because loaded native bindings can be locked. The local `npm ci` verification encountered EPERM on the loaded rolldown binding; `npm install` restored the dependencies successfully using the existing lockfile, with a cleanup warning for the locked temporary binding directory. No running user process was stopped. The test/build commands were rerun after recovery. Clean reinstall on this running workspace therefore remains unverified; the documented test command works with the restored locked versions.

`npm run test:validation` and `npm run test:legacy` run the individual runners for debugging. Use the full `npm test` after editing tests to keep the JSON and this document synchronized. `npm run test:typecheck` checks the tests, helpers and configuration; `npm run typecheck`, `npm run build` and `npm run lint` check the application. Raw Vitest results are ignored in `tests/.results/`; the concise machine-readable inventory is tracked. Its `sources` map contains suites, unit/integration distinction, actual counts, individual case names and pass statuses. `tests/validation-manifest.json` contains the exhaustive owner and exclusion decisions.

## Executed inventory

<!-- inventory:start -->
20 validation owners; 489 Vitest cases + 5 retained Node cases = 494 executed, all passed. 492 validation cases and 2 retained visual/render cases. No skipped cases.

| Source | Unit | Integration | Total | Suite(s) |
| --- | ---: | ---: | ---: | --- |
| src/contexts/authentication/domain/passwordPolicy.ts | 27 | 0 | 27 | tests/policies-storage.test.ts, tests/registration-password-policy.test.mjs |
| src/contexts/authentication/presentation/RegisterPage.tsx | 0 | 23 | 23 | tests/authentication.test.tsx |
| src/contexts/authentication/presentation/LoginPage.tsx | 0 | 23 | 23 | tests/authentication.test.tsx |
| src/contexts/profile/presentation/ProfilePage.tsx | 0 | 21 | 21 | tests/profile-settings.test.tsx |
| src/contexts/profile/presentation/SettingsPage.tsx | 0 | 22 | 22 | tests/profile-settings.test.tsx |
| src/contexts/survey/presentation/EmployeeSurveysPage.tsx | 0 | 49 | 49 | tests/surveys.test.tsx |
| src/contexts/ai/presentation/EmployeeAiPage.tsx | 0 | 28 | 28 | tests/ai.test.tsx |
| src/contexts/humanresources/presentation/HrManagementPage.tsx | 0 | 37 | 37 | tests/management.test.tsx |
| src/infrastructure/auth/sessionStorage.ts | 29 | 0 | 29 | tests/policies-storage.test.ts |
| src/infrastructure/preferences/preferenceStore.ts | 20 | 0 | 20 | tests/policies-storage.test.ts |
| src/infrastructure/api/apiClient.ts | 22 | 0 | 22 | tests/api.test.ts |
| src/infrastructure/auth/authService.ts | 0 | 20 | 20 | tests/services.test.ts |
| src/infrastructure/profile/profileService.ts | 0 | 22 | 22 | tests/services.test.ts |
| src/infrastructure/content/contentService.ts | 0 | 24 | 24 | tests/services.test.ts |
| src/infrastructure/ai/aiService.ts | 0 | 20 | 20 | tests/services.test.ts |
| src/app/App.tsx | 0 | 25 | 25 | tests/app.test.tsx |
| src/contexts/employee/presentation/EmployeeHomePage.tsx | 0 | 20 | 20 | tests/employee-home.test.tsx |
| src/contexts/report/presentation/HrReportsPage.tsx | 0 | 20 | 20 | tests/hr-reports.test.tsx |
| src/contexts/humanresources/presentation/HrHomePage.tsx | 0 | 20 | 20 | tests/hr-home.test.tsx |
| src/shared/hooks/useLiveRefresh.ts | 0 | 20 | 20 | tests/live-refresh.test.tsx |
<!-- inventory:end -->

The three existing password-policy Node cases remain counted as three cases, even though each performs multiple assertions. The existing password-color and render-visibility cases are retained and executed but are explicitly excluded from validation-owner quotas. Dedicated suites have a single primary source owner, so totals do not double-count component tests against the service files they also exercise. `alsoExercisedBy` documents cross-file flows without inflating counts.

## Local integration and isolation

Unit tests call password/storage/API policies directly. Local integration tests render actual React components inside the actual language provider, change form fields, click controls or submit forms, and use the actual services and API client with in-memory fetch responses. Service integration tests exercise serialization, response mapping and HTTP failure contracts at the same boundary. The live-refresh integration suite mounts the real hook and drives focus/visibility/timer events.

Every test starts with empty session/local storage, a fixed clock (`2026-01-01T12:00:00Z`), Spanish context and cleared theme. Cleanup unmounts components, restores mocks/globals, and resets fake timers. Refresh timing uses controlled timers and deferred promises; there are no long sleeps or network waits. Unmocked fetch calls are recorded and fail the case during teardown even if component error handling catches the thrown error. No Firebase, Gemini, Render or other real provider endpoint is contacted. Fixtures use example.test identities and fake tokens. These tests are local component/API-contract integration, not backend-live or browser end-to-end verification.

## Excluded scan candidates

All 37 files under `src/` were inventoried before exclusions: 20 validation owners and these 17 excluded candidates.

| Candidate | Reason |
| --- | --- |
| src/app/app.css | Presentation styles, no executable validator. |
| src/index.css | Style/token definitions; existing contrast check is visual, not a validation quota. |
| src/vite-env.d.ts | Compile-time declarations. |
| src/main.tsx | React bootstrap/provider wiring. |
| src/shared/ui/SuccessMessage.tsx | Presentation visibility and dismissal timer only. |
| src/shared/ui/StatusMessage.tsx | Status/error display conditionals only. |
| src/shared/ui/Spinner.tsx | Loading display only. |
| src/shared/ui/PasswordField.tsx | Password visibility and attribute forwarding; consuming forms own validation. |
| src/shared/ui/Logo.tsx | Branding/compact rendering. |
| src/shared/ui/LanguageSwitcher.tsx | Fixed choice buttons; preference policies own allowlist checks. |
| src/i18n/translations.ts | Static translation dictionary. |
| src/i18n/LanguageProvider.tsx | Context wiring and missing-provider programming guard, no input policy. |
| src/shared/layout/AppShell.tsx | Navigation/menu presentation and initials; route authorization belongs to App. |
| src/domain/types.ts | Compile-time domain types, not runtime validation. |
| src/infrastructure/config/legal.ts | Static legal link, no URL validator. |
| src/infrastructure/config/env.ts | Build-time URL fallback/trailing-slash normalization, no active user-data/security/business validation. |
| src/contexts/authentication/presentation/AuthLayout.tsx | Layout/branding only. |

No factory type checks, snapshots or hundreds of static source-match assertions were added to fill quotas. Coverage percentages are not claimed; no line/branch coverage instrument was enabled.

## Regression fixes and scope

`readSession` now rejects malformed JSON shapes, blank token/identity fields, unknown roles, and nonpositive/unsafe/noninteger user IDs. It removes unusable stored data when possible and returns null even if both reading and eviction throw. Valid EMPLOYEE, HR_MEMBER and SYSTEM_ADMIN persisted sessions keep their existing behavior; App continues to restrict the system-admin portal.

Login now rejects unsupported server roles while preserving the existing SYSTEM_ADMIN explanation and the supported employee/HR paths. Avatar upload now matches its advertised PNG/JPEG/WebP MIME allowlist, retaining the existing inclusive 1 MiB size boundary and local per-user persistence. No backend contracts or other production flows were changed.

## Limitations and remaining gaps

These are behavior/contract cases, not proof of complete branch coverage or authorization enforcement by the server. jsdom is not a real browser: native required/email checks and user typing length caps are exercised, while direct form-submit events deliberately bypass HTML constraints to exercise application guards and backend error propagation. Most form maxima are also tested by sending boundary content through the real services; unrestricted programmatic DOM mutations and every maxLength overflow are not comprehensively modeled.

The backend remains responsible for validating enum IDs, duplicates, whitespace-only fields without explicit frontend guards, response schemas, password policies at login, rate limits and permissions. The frontend services still trust most successful API response shapes; the runtime session-storage check is not cryptographic validation of a token. File MIME/size checks do not inspect image bytes; avatar FileReader/storage write failures and arbitrary preexisting local avatar URLs are not hardened by this change. Long-running day rollover, overlapping account/preference programmatic submissions, AI conversation races, malformed chart/report timestamps, and every possible failure/retry combination remain outside this suite. Survey publication/closure, activity closure, cached comments and percentage bounds have local integration cases. Refresh concurrency, current-token usage and cleanup are covered; no real daily backend rollover or paid AI service is used.

## Verification and dependency audit

Verified with Node v24.19.0:

- `npm test`: 489 Vitest cases in 13 test files and 5 retained Node cases; 494 passed, 0 failed/skipped. The inventory checks 20 owners, each with at least 20 cases. Of the total, 492 are validation cases and 2 are retained visual/render regressions.
- `npm run test:typecheck` and `npm run typecheck`: passed.
- `npm run build`: passed; TypeScript and Vite production build, 46 transformed modules.
- `npm run lint`: passed with no warnings.
- `npm run format:check`: passed.
- `npm audit`: 0 vulnerabilities, including dev dependencies.
- `npm audit --omit=dev`: 0 vulnerabilities in production dependencies.
- `npm ci`: could not finish in this Windows workspace due to a locked native binding; `npm install` recovery completed and reported 0 vulnerabilities.

Dev-only additions are Vitest 5.0.3, Testing Library React 16.3.3, user-event, jest-dom and jsdom 30.1.2. The existing transitive source-map-js was updated from 1.2.1 to the compatible patched 1.2.2 after an audit reported GHSA-68fv-2mgg-jv7q. Run both audit commands when checking dependency security because Vite is listed in this project's production dependency section. Test cases use only local mocked API calls; npm installation/auditing contacts the package registry.
