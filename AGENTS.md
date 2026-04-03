# Design Alignment Guide — SME Edaran Admin Frontend

**Context:** The `reports.tsx` page was redesigned with a cohesive visual language (amber accent, animated cards, staggered entry, help dialogs, loading overlay). This guide teaches another AI how to apply the same design to any other admin page.

---

## Reference Files
- **Gold standard page:** `smee-frontend/src/routes/admin/reports.tsx`
- **CSS definitions:** `smee-frontend/src/styles.css`
- **Secondary example:** `smee-frontend/src/routes/admin/grn.tsx`

---

## Prompt to Give Another AI

> You are updating the design of an admin page in a React/TypeScript frontend project. The project uses Tailwind CSS v4, shadcn/ui components, and TanStack Router.
>
> **Your job:** Read the target page file, then apply the design system described below. Preserve all existing logic and functionality — only change the JSX structure and className/style attributes.

---

## Step 1 — Add the page CSS class to `styles.css`

Every page needs a CSS block at the bottom of `smee-frontend/src/styles.css` (before the `/* App sidebar */` comment). Copy this template and replace `{page-name}` with the page's kebab-case name (e.g. `inventory`, `settings`):

```css
/* {Page Name} page: same tokens as dashboard/admin */
.{page-name}-page {
  --dashboard-display: "Plus Jakarta Sans", sans-serif;
  --dashboard-body: "Figtree", sans-serif;
  --dashboard-accent: oklch(0.706 0.158 70.697);
  --dashboard-accent-muted: oklch(0.92 0.04 70);
  --dashboard-surface: oklch(0.988 0.002 286);
}
.dark .{page-name}-page {
  --dashboard-accent: oklch(0.75 0.15 70);
  --dashboard-accent-muted: oklch(0.28 0.04 70);
  --dashboard-surface: oklch(0.18 0.008 286);
}
.{page-name}-page .dashboard-card {
  animation: dashboard-fade-up 0.45s ease-out both;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.{page-name}-page .dashboard-card:hover {
  transform: translateY(-2px);
}
```

If the page has a loading overlay with bar animation, also add:

```css
@keyframes {page-name}-bar-wave {
  0%, 100% { height: 8px; opacity: 0.45; }
  50% { height: 40px; opacity: 1; }
}
.{page-name}-page .{page-name}-bar-wave {
  animation: {page-name}-bar-wave 1s ease-in-out infinite;
}
```

---

## Step 2 — Update the `<main>` element

```tsx
<main
  className="{page-name}-page container mx-auto p-6 space-y-6"
  aria-labelledby="{page-name}-page-title"
  aria-describedby="{page-name}-page-description"
  aria-busy={isLoading}  {/* add if the page has any async loading state */}
>
```

---

## Step 3 — Use the shared `AdminPageHeader`

Instead of hand-rolling the header markup on every page, use the shared `AdminPageHeader` component:

```tsx
import { AdminPageHeader } from "@/components/admin-page-header";
import { PackageSearch } from "lucide-react";

<main
  className="inventory-page container mx-auto p-6 space-y-6"
  aria-labelledby="inventory-page-title"
  aria-describedby="inventory-page-description"
  aria-busy={isLoading}
>
  <AdminPageHeader
    icon={PackageSearch}
    title="Inventory"
    description="View inventory levels and stock sync status."
    titleId="inventory-page-title"
    descriptionId="inventory-page-description"
    // accentCssVar is optional; defaults to "--dashboard-accent"
  />
  {/* rest of page content */}
</main>
```

For pages with their own accent variable (e.g. RBAC uses `--rbac-accent`), pass it explicitly:

```tsx
<AdminPageHeader
  icon={Shield}
  title="Role-Based Access Control"
  description="Manage modules, roles, and user access across the system."
  titleId="rbac-page-title"
  descriptionId="rbac-page-description"
  accentCssVar="--rbac-accent"
/>
```

You can also pass a `rightSlot` (small help button, extra actions) to render on the right side:

```tsx
<AdminPageHeader
  icon={FileText}
  title="Reports"
  description="Generate and export operational reports."
  titleId="reports-page-title"
  descriptionId="reports-page-description"
  rightSlot={
    <Button /* ... */>
      How to use
    </Button>
  }
/>
```

If you ever need to inline the header (e.g. in a page that already has a complex document-style layout like invoice detail), you can still follow the structure above; `AdminPageHeader` is just the preferred default.

---

## Step 4 — Apply `.dashboard-card` to all cards

Every `<Card>` on the page should get `className="dashboard-card"`. For staggered entry on sibling cards, add inline `style={{ animationDelay: "Xms" }}`:

```tsx
<Card className="dashboard-card" style={{ animationDelay: "0ms" }}>...</Card>
<Card className="dashboard-card" style={{ animationDelay: "80ms" }}>...</Card>
<Card className="dashboard-card" style={{ animationDelay: "160ms" }}>...</Card>
```

Card titles should use the display font:
```tsx
<CardTitle style={{ fontFamily: "var(--dashboard-display)" }}>Title</CardTitle>
```

---

## Step 5 — Add a loading overlay (for pages with async actions)

When the page has a mutation or long-running fetch, show this overlay while `isLoading` is true:

```tsx
{isLoading && (
  <div
    className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
    aria-hidden="true"
  >
    <div className="absolute inset-0 bg-background/50 backdrop-blur-[3px]" />
    <div className="relative rounded-2xl border bg-card shadow-xl px-8 py-7 flex flex-col items-center gap-5 min-w-[220px]">
      {/* Animated bar chart */}
      <div className="flex items-end gap-[5px] h-10" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="{page-name}-bar-wave w-[6px] rounded-full"
            style={{ background: "var(--dashboard-accent)", animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--dashboard-display)" }}>
          Loading…
        </p>
        <p className="text-xs text-muted-foreground">This may take a moment</p>
      </div>
    </div>
  </div>
)}
```

Requires the bar-wave CSS keyframe from Step 1.

---

## Step 6 — Style accent-colored buttons

Any primary action button (submit, generate, confirm) should use the amber accent:

```tsx
<Button
  type="submit"
  className="gap-2 text-white disabled:opacity-50"
  style={{
    background: "var(--dashboard-accent)",
    borderColor: "var(--dashboard-accent)",
  }}
>
  <Download className="h-4 w-4" aria-hidden />
  Action Label
</Button>
```

---

## Step 7 — Update the help dialog (if one exists)

If the page has a multi-step help modal, replace its content with this pattern:

```tsx
<Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
  <DialogContent className="sm:max-w-lg" aria-describedby="{page-name}-help-description">
    <DialogHeader className="pb-1">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-md text-white text-xs font-bold shrink-0"
          style={{ background: "var(--dashboard-accent)" }}
          aria-hidden
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </span>
        <DialogTitle className="text-base" style={{ fontFamily: "var(--dashboard-display)" }}>
          Page Help
        </DialogTitle>
      </div>
      <DialogDescription id="{page-name}-help-description" className="sr-only">
        Step {helpStep + 1} of {HELP_STEPS.length}
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4 pt-1">
      {/* Screenshot */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted">
        <img src={HELP_STEPS[helpStep].image} alt="" className="h-full w-full object-contain object-top" />
        <span
          className="absolute top-2.5 left-2.5 flex h-6 min-w-[1.5rem] items-center justify-center rounded-md px-1.5 text-[10px] font-mono font-bold text-white shadow-sm"
          style={{ background: "var(--dashboard-accent)" }}
          aria-hidden
        >
          {String(helpStep + 1).padStart(2, "0")} / {HELP_STEPS.length}
        </span>
      </div>

      {/* Step text */}
      <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 space-y-1">
        <h3 className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--dashboard-display)" }}>
          {HELP_STEPS[helpStep].title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {HELP_STEPS[helpStep].description}
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <div className="flex gap-1.5" role="tablist" aria-label="Help steps">
          {HELP_STEPS.map((_, i) => (
            <button
              type="button" key={i} role="tab"
              aria-selected={i === helpStep}
              aria-label={`Go to step ${i + 1}`}
              onClick={() => setHelpStep(i)}
              className="h-2 rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              style={
                i === helpStep
                  ? { width: "1.5rem", background: "var(--dashboard-accent)" }
                  : { width: "0.5rem", background: "var(--muted-foreground)", opacity: 0.3 }
              }
            />
          ))}
        </div>
        <div className="flex gap-2">
          {helpStep > 0 && (
            <Button variant="outline" size="sm" onClick={() => setHelpStep(s => s - 1)}>
              <ChevronLeft className="h-4 w-4 mr-0.5" /> Previous
            </Button>
          )}
          {helpStep < HELP_STEPS.length - 1 ? (
            <Button size="sm" className="text-white"
              style={{ background: "var(--dashboard-accent)", borderColor: "var(--dashboard-accent)" }}
              onClick={() => setHelpStep(s => s + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-0.5" />
            </Button>
          ) : (
            <Button size="sm" className="text-white"
              style={{ background: "var(--dashboard-accent)", borderColor: "var(--dashboard-accent)" }}
              onClick={() => setIsHelpOpen(false)}>
              Got it
            </Button>
          )}
        </div>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

---

## Design Tokens Cheatsheet

| Token | Value (light) | Value (dark) | Usage |
|---|---|---|---|
| `--dashboard-accent` | `oklch(0.706 0.158 70.697)` | `oklch(0.75 0.15 70)` | Amber — buttons, icon boxes, active states, accents |
| `--dashboard-accent-muted` | `oklch(0.92 0.04 70)` | `oklch(0.28 0.04 70)` | Light amber tint — icon box backgrounds, hover fills |
| `--dashboard-surface` | `oklch(0.988 0.002 286)` | `oklch(0.18 0.008 286)` | Off-white page background |
| `--dashboard-display` | `"Plus Jakarta Sans", sans-serif` | same | Headings, card titles, display text |
| `--dashboard-body` | `"Figtree", sans-serif` | same | Body text, labels, descriptions |

To use amber as a text or background color in Tailwind classes where CSS vars aren't directly available, use: `text-amber-600 dark:text-amber-400` or `bg-[var(--dashboard-accent)]`.

---

## Pages Status & Remaining Header Updates

As of the latest pass, these admin pages **already use the new design system** (page class, `.dashboard-card`, amber accents) and **`AdminPageHeader`** where appropriate:

| Page | File | Header implementation |
|---|---|---|
| Inventory | `routes/admin/inventory.tsx` | Uses `AdminPageHeader` with `inventory-page` |
| Invoices | `routes/admin/invoices.tsx` | Uses `AdminPageHeader` with `invoices-page` and pill-tab CSS |
| RBAC | `routes/admin/rbac.tsx` | Uses `AdminPageHeader` with `rbac-page` and `--rbac-accent` |
| Audit Log | `routes/admin/audit-log.tsx` | Uses `AdminPageHeader`-style header pattern with `audit-log-page` |
| Settings | `routes/admin/settings.tsx` | Uses updated header pattern (document-style gradient); candidate to migrate to `AdminPageHeader` later |
| Invoice Detail | `routes/admin/invoice-detail.tsx` | Uses updated document-style header; candidate to partially wrap title/description with `AdminPageHeader` |

Other admin routes that **should eventually align their headers** to this pattern (either by adopting `AdminPageHeader` directly or mirroring its structure) include:

| Page | File | Notes |
|---|---|---|
| Dashboard | `routes/admin/dashboard.tsx` | Main admin landing; ensure header matches reports/inventory style |
| GRN | `routes/admin/grn.tsx` | Already uses tokens + cards; can swap inline header for `AdminPageHeader` |
| Outbound | `routes/admin/outbound.tsx` | Same as GRN — align header via `AdminPageHeader` |
| User Management | `routes/admin/user-management.tsx` | Complex page but should use shared header component |
| Proof of Delivery | `routes/admin/proof-of-delivery.tsx` | Align header and primary buttons |
| Exceptions | `routes/admin/exceptions.tsx` | Use shared header; keep any special status UI |
| Exception Detail | `routes/admin/exception-detail.tsx` | Align detail header to invoice-detail / reports pattern |
| Deliveries / DO-related pages | `routes/admin/deliveries.tsx`, `routes/admin/do-work-queue.tsx`, `routes/admin/do-detail.tsx`, `routes/admin/es-do.tsx` | Use `AdminPageHeader` for top-of-page context; preserve existing workflow-specific UI |
| Settlement pages | `routes/admin/settlement.tsx`, `routes/admin/settlement.$id.tsx` | Align list + detail headers; consider `accentCssVar` if they get a distinct accent |

When updating any of the remaining pages, prefer:

- Using `AdminPageHeader` where the header is a simple “page title + description + optional actions”.
- Mirroring its structure (icon box, title, description, accent bar) manually only when the layout is truly bespoke (e.g. document-style screens with back buttons).

---

## Things to Never Change

- All business logic, state management, queries, mutations
- Existing `aria-*` accessibility attributes (only add, never remove)
- The `shadcn/ui` component imports (Card, Button, Dialog, etc.)
- TypeScript types
- Route configuration (`createFileRoute`, `beforeLoad`)

---

# TODO

## GRN (Goods Receipt Note)
- [x] Auto-generate GRN Number (format: GRN-YYYYMMDD-0001, e.g. GRN-20260316-0001)
- [x] Rename "PO Reference" field to "End User PO"
- [x] Add required marker to "Supplier DO" field and enforce it in validation
- [x] Fix Rack creation order: Row → Level → Column (currently Row → Column → Level)
- [x] Format "Received Date" to Malaysian date format (DD/MM/YYYY)

## Permissions
- [ ] Management role → Read & Approval only
- [ ] Admin role → All permissions
- [ ] Storekeeper role → Read access for GRN

## Outbound (Delivery Orders)
- [ ] Add descriptive labels for each status type (e.g., "Packing" — explain its purpose)
- [ ] Update status flow order: New → Preparing → In Transit → Delivered
- [ ] Remove the testing switch/toggle on Outbound

## Invoice
- [ ] Change invoice number prefix from "INV" to "PI" (Proforma Invoice)

## Reports
- [ ] Remove inventory report
- [ ] Update Proforma Invoice Summary Report:
  - Rename column "Expected Arrival Date" → "Invoice Date"
  - Ensure columns are: Proforma Invoice No | Invoice Date | PO No | DO No | Outlet | Region | CTN | Amount

## Stock Count
- [ ] Add button to start stock count activity
- [ ] Print stock count receipt on activity start
- [ ] Manual stock count → requires approval
- [ ] Tally stock count → requires approval
