---
name: deploy-check
description: Pre-merge deployment readiness check. Runs all tests, checks for pending Supabase migrations, creates a PR to develop, and verifies Railway deployment status. Use this skill whenever the user says "deploy check", "ship it", "ready to merge", "create PR", "deploy", wants to check if their branch is ready, or asks to run the full pre-merge checklist. Also trigger when the user asks to check Railway, check migrations, or run tests before merging.
---

# Deploy Check — Pre-Merge Readiness Workflow

This skill runs a full pre-merge checklist: tests, migration check, PR creation, and Railway deployment verification. Execute all steps in order, stopping early if a blocking issue is found.

## Step 1: Run All Tests

Run the unit/integration test suite:

```bash
npm test
```

**If tests fail:**
- Read the failing test files and the source code they test
- Try to fix the **source code** (not the tests) to make them pass
- Re-run the failing tests to confirm the fix
- If the fix requires modifying test files (e.g., tests are outdated or wrong), STOP and ask the user: "These tests need to be updated to match the new behavior: [list files]. Want me to update them?"
- If you can't figure out the fix after 2 attempts, stop and report the failures to the user

Do NOT run E2E tests automatically — they require a running dev server and take a long time. Ask the user: "Unit tests passed. Want me to also run E2E tests? (requires dev server at localhost:3000)"

## Step 2: Check Supabase Migrations

Check if any migration files exist that may not have been applied:

1. List all migration files in `supabase/migrations/`
2. Check git status to see if any migration files are **new/untracked or modified** — these are the ones that might not be applied yet
3. If new migrations are found, report them to the user:
   - "Found N new migration(s) that may need to be applied: [list files]"
   - "Have these been applied to your Supabase project?"
4. Also check for migration numbering issues (duplicate numbers like two `050_*.sql` files)
5. If no new migrations, report: "No pending migrations detected."

Do NOT attempt to run migrations — just detect and report.

## Step 3: Create PR to develop

Before creating the PR:

1. Run `git status` to check for uncommitted changes
   - If there are uncommitted changes (including fixes from Step 1), ask the user if they want to commit first
2. Run `git log develop..HEAD --oneline` to see all commits that will be in the PR
3. If there are no commits ahead of develop, tell the user and skip PR creation
4. Push the current branch to origin: `git push -u origin <branch-name>`
5. Create the PR targeting `develop`:

```bash
gh pr create --base develop --title "<title>" --body "$(cat <<'EOF'
## Summary
<bullet points summarizing all commits>

## Pre-merge Checklist
- [x] Unit tests passing
- [ ] E2E tests (manual)
- [x] Migration check: <status>
- [ ] Railway deployment verified

## Test plan
<what to verify after merge>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If a PR already exists for this branch, report it instead of creating a duplicate.

## Step 4: Check Railway Deployment

Check the latest Railway deployment status:

```bash
railway deployment list --environment production 2>&1 | head -20
```

If the environment is not linked, try:
```bash
railway deployment list 2>&1 | head -20
```

Report the deployment status to the user. If Railway CLI is not authenticated or the project isn't linked, tell the user:
- "Railway CLI needs to be linked. Run `railway link` to connect to your project."

Also check recent deploy logs for errors if a deployment is active:
```bash
railway logs --deployment -b --lines 50 2>&1 | tail -30
```

## Step 5: Summary Report

Present a clear summary:

```
## Deploy Check Results

| Check | Status |
|-------|--------|
| Unit Tests | ✅ Passing / ❌ N failures |
| E2E Tests | ⏭️ Skipped (manual) / ✅ Passing |
| Migrations | ✅ None pending / ⚠️ N new migration(s) |
| PR | ✅ Created: <URL> / ℹ️ Already exists: <URL> |
| Railway | ✅ Deployed / ⚠️ <status> |
```

If everything passed, end with: "Branch is ready for review."
If there are issues, list what needs attention before merging.
