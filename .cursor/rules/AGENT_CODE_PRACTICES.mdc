---
description: "Code practices: TypeScript, React, TanStack, Biome, helpers in lib, shadcn UI, GraphQL fetch pattern, granular components; confirm with user when unclear."
globs: ["**/*.ts", "**/*.tsx", "**/src/**"]
alwaysApply: true
---

# Code Practices

When writing or modifying frontend code, follow these practices.

## TypeScript

- Use explicit types for component props (interfaces or type aliases). Prefer `interface` for object shapes.
- Use `type` imports when importing only types: `import type { X } from "..."`.
- Avoid `any`; use `unknown` and narrow, or proper types. For third-party validator types, prefer type assertions only where necessary (e.g. `as any` on TanStack Form validators only when types don’t align).
- Define shared types in `@/data/*.types` or next to the module; keep route/component files focused.

## Helpers & utilities

- **Before adding a new helper:** Search the codebase (especially `@/lib`) for existing helpers that already do the job. Reuse or extend them instead of duplicating.
- Put new helper functions in the appropriate `@/lib` module (e.g. `@/lib/utils`, `@/lib/format`, or a new file under `@/lib`). Do not scatter one-off helpers inside components or routes.

## React & components

- Prefer **granular components** over large "big bang" components. Split by responsibility (e.g. list item, form section, dialog) so each component stays focused and testable.
- Follow **shadcn/ui** component patterns and practices: use the existing primitives in `@/components/ui/*` (e.g. Button, Card, Dialog, Select, Popover); compose with Radix UI where needed; keep the same prop patterns, styling with Tailwind + `cn()`, and accessibility behavior. Do not introduce one-off UI primitives that duplicate shadcn-style components.
- Prefer function components and named exports (e.g. `function OutboundRouteComponent()` then `export const Route = createFileRoute(...)`).
- Colocate state and handlers in the component that owns them; lift only when needed for sharing.
- Use the `@/` path alias for imports: `@/components/*`, `@/lib/*`, `@/data/*`, `@/routes/*`.

## TanStack

- **Router:** Define routes with `createFileRoute("/path")` and export `Route`; keep route component as a separate named function.
- **Query:** Use `useQuery` / `useMutation` with explicit `queryKey` arrays; invalidate with `queryClient.invalidateQueries({ queryKey: ["..."] })`.
- **Form:** Use `@tanstack/react-form` with `validators` (Zod schemas in `@/lib/*` when shared); keep `defaultValues` and field types in sync.

## Data & API

- Put GraphQL operations (queries/mutations) and shared types in `@/lib/graphql/*`; keep route/component code calling hooks or thin wrappers.

### GraphQL fetch pattern

- Use **TanStack Query** for GraphQL: `useQuery` / `useMutation` with a `queryFn` / `mutationFn` that calls `request` from `graphql-request`.
- **Endpoint:** `env.VITE_GRAPHQL_ENDPOINT` (from `@/env`).
- **Auth:** Send auth on every request. Build `Headers`, set `Authorization: Bearer <token>`. Prefer `getAccessToken()` from `@/lib/auth/auth-storage` when available; avoid hardcoding `localStorage.getItem('access_token')` in new code if a shared helper exists.
- **Shape:** `request(endpoint, document, variables, headers)`. Import the GraphQL document (e.g. `SKUS_AND_UOM_QUERY`) from `@/lib/graphql/*`.
- **Query keys:** Use explicit, stable `queryKey` arrays (e.g. `['skus']`, `['purchase-orders-list']`); use the same key when invalidating after mutations.

Example pattern (see `@/components/grn/sku-combobox.tsx` for reference):

```ts
const { data, isLoading } = useQuery({
  queryKey: ['skus'],
  queryFn: () => {
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${getAccessToken() ?? ''}`);
    return request(env.VITE_GRAPHQL_ENDPOINT, SKUS_AND_UOM_QUERY, {}, headers);
  },
});
```

- Use TanStack Query for server state; use local component state or TanStack Store only when appropriate.
- Validate API/forms with Zod; export schemas and inferred types from `@/lib` where reused.

## Tooling & style

- Use **Biome** for formatting and linting: run `pnpm run format` and `pnpm run lint` (or `pnpm run check`). Do not introduce ESLint/Prettier config that conflicts with Biome.
- Use **Tailwind** for styling; prefer utility classes and existing design tokens. Use `cn()` (or equivalent) for conditional classes.
- Keep files under ~400 lines; split by route, feature, or component when they grow.

## Before modifying

- **When something is unclear** (requirements, scope, existing behavior, or conflicting patterns): confirm with the user before making changes. Do not assume; ask for clarification when needed.

## What to avoid

- ESLint or Prettier config that duplicates or conflicts with Biome.
- Inline styles or new CSS files unless Tailwind cannot express the design.
- Broad `any` types or untyped event handlers.
- Logic or types that belong in `@/lib` or `@/data` living inside route or page components.
