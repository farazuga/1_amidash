# Customer Portal Two-Column Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the customer portal from a single-column stack to a two-column layout (status+contact left, builder blocks right, history bottom full-width).

**Architecture:** Partition template blocks by type into 3 zones (left/right/bottom) in the renderer. Left column always shows current_status and poc_info. Right column gets all other blocks from the template. Bottom row always shows status_history. On mobile, collapses to single column.

**Tech Stack:** Next.js, Tailwind CSS (grid), existing BlockRenderer and portal components.

---

### Task 1: Add two-column layout to public portal page

**Files:**
- Modify: `src/app/status/[token]/page.tsx:257-315`

**Step 1: Replace the single-column block rendering with zone-partitioned two-column grid**

Replace the `<main>` content (lines 283-299) with:

```tsx
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Two-column layout: left (status+contact) / right (builder blocks) */}
        <div className="md:grid md:grid-cols-2 md:gap-6">
          {/* Left column: always current_status + poc_info */}
          <div>
            {leftBlocks.map((block) => (
              <BlockRenderer
                key={block.id}
                block={block}
                data={portalData}
              />
            ))}
          </div>

          {/* Right column: all other blocks from template (except status_history) */}
          {rightBlocks.length > 0 && (
            <div>
              {rightBlocks.map((block) => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  data={portalData}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bottom row: status_history full-width */}
        {bottomBlocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            data={portalData}
          />
        ))}
```

Add this block-partitioning logic right before the `return` statement (after line 255, before line 257):

```tsx
  // Partition blocks into zones
  const LEFT_TYPES = new Set(['current_status', 'poc_info']);
  const BOTTOM_TYPES = new Set(['status_history']);

  const leftBlocks = templateBlocks.filter((b) => LEFT_TYPES.has(b.type));
  const rightBlocks = templateBlocks.filter(
    (b) => !LEFT_TYPES.has(b.type) && !BOTTOM_TYPES.has(b.type)
  );
  const bottomBlocks = templateBlocks.filter((b) => BOTTOM_TYPES.has(b.type));

  // Ensure left always has current_status and poc_info even if missing from template
  if (!leftBlocks.some((b) => b.type === 'current_status')) {
    leftBlocks.unshift({ id: 'blk_status_fallback', type: 'current_status' });
  }
  if (!leftBlocks.some((b) => b.type === 'poc_info')) {
    leftBlocks.push({ id: 'blk_poc_fallback', type: 'poc_info' });
  }
  // Ensure bottom always has status_history
  if (!bottomBlocks.some((b) => b.type === 'status_history')) {
    bottomBlocks.push({ id: 'blk_history_fallback', type: 'status_history' });
  }

  const portalData = {
    project: project as any,
    currentStatus,
    filteredStatuses,
    isOnHold,
    clientVisibleHistory,
    projectToken: token,
    fileUploads,
    addressConfirmation,
  };
```

Also widen `max-w-3xl` to `max-w-5xl` on the `<main>` tag to accommodate two columns.

**Step 2: Verify the page renders correctly**

Run the dev server and visit a portal page at `/status/[token]`. Verify:
- Desktop: two columns side by side, history below
- Mobile (resize narrow): single stacked column

**Step 3: Commit**

```bash
git add src/app/status/[token]/page.tsx
git commit -m "feat: two-column layout for public customer portal"
```

---

### Task 2: Apply same two-column layout to authenticated customer project detail page

**Files:**
- Modify: `src/app/(customer)/customer/projects/[id]/page.tsx:123-297`

**Step 1: Restructure the render section to use the same two-column grid**

The authenticated page currently renders hardcoded cards. Restructure to:

```tsx
  return (
    <div className="space-y-4">
      {/* Back button */}
      <Link href="/customer">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
      </Link>

      {/* Two-column layout */}
      <div className="md:grid md:grid-cols-2 md:gap-6 space-y-4 md:space-y-0">
        {/* Left column: Status + Contact */}
        <div className="space-y-4">
          {/* Main Status Card */}
          <Card className="border-[#023A2D]/20 overflow-hidden">
            {/* ... existing status card content (lines 135-204) unchanged ... */}
          </Card>

          {/* Contact Information */}
          <Card className="border-[#023A2D]/20">
            {/* ... existing contact card content (lines 228-282) unchanged ... */}
          </Card>
        </div>

        {/* Right column: Schedule + any future blocks */}
        <div className="space-y-4">
          {/* Project Schedule */}
          {(project.start_date || project.end_date) && (
            <Card className="border-[#023A2D]/20">
              {/* ... existing schedule card content (lines 207-225) unchanged ... */}
            </Card>
          )}
        </div>
      </div>

      {/* Bottom row: Status History (full-width) */}
      <Card className="border-[#023A2D]/20">
        {/* ... existing status history card content (lines 285-294) unchanged ... */}
      </Card>
    </div>
  );
```

The inner card contents stay exactly the same. Only the wrapping structure changes.

**Step 2: Verify the authenticated portal page**

Visit `/customer/projects/[id]` and verify the same two-column layout.

**Step 3: Commit**

```bash
git add src/app/(customer)/customer/projects/[id]/page.tsx
git commit -m "feat: two-column layout for authenticated customer project detail page"
```

---

### Task 3: Visual polish and edge cases

**Files:**
- Modify: `src/app/status/[token]/page.tsx`
- Modify: `src/app/(customer)/customer/projects/[id]/page.tsx`

**Step 1: Handle empty right column gracefully**

If `rightBlocks.length === 0` on the public portal, ensure the left column expands properly. The current implementation already handles this since we conditionally render the right column div. Verify by testing with a template that only has `current_status`, `poc_info`, and `status_history`.

**Step 2: Ensure vertical alignment**

Both columns should start from the top. Add `items-start` to the grid container if blocks have different heights:

```tsx
<div className="md:grid md:grid-cols-2 md:gap-6 items-start">
```

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: vertical alignment and empty right column handling"
```
