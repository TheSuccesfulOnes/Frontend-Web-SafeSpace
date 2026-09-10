# SafeSpace Web

Frontend web de SafeSpace para las vistas de `EMPLOYEE` y `HR_MEMBER`.

## Stack

- React 19 + Vite 8.
- TypeScript estricto.
- CSS propio con tokens de diseño, tema claro/oscuro y responsive layout.
- `fetch` nativo para mantener una capa HTTP pequeña y auditable.

## Estructura DDD

```text
src/
├── app/                         # Composition root and shell styling
├── contexts/                    # Bounded contexts and presentation use cases
│   ├── authentication/
│   ├── employee/
│   ├── humanresources/
│   ├── survey/
│   ├── report/
│   ├── ai/
│   └── profile/
├── domain/                      # Shared domain types and value contracts
├── infrastructure/              # HTTP clients, auth session and persistence adapters
├── i18n/                        # Spanish/English application copy
└── shared/                      # Reusable layout and UI primitives
```

## Local execution

```text
npm install
npm run dev
```

The web client uses `http://localhost:8080` by default and serves on `http://127.0.0.1:5175`.
Copy `.env.example` to `.env` only when a different API URL is required.

## Security notes

- JWT is kept in `sessionStorage` for the current browser tab; no API key or backend secret is bundled.
- The UI filters roles for the mobile/web experience; backend authorization remains the security boundary.
- User-entered content is rendered as text, never as HTML.
- Account-scoped theme and language preferences are persisted by immutable `userId` and synchronized with the backend.

## Verification

```text
npm run typecheck
npm run lint
npm run format:check
npm run build
npm audit --omit=dev --audit-level=moderate
```
