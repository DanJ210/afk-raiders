# AFK Raiders — CI/CD to Azure Static Web Apps

This repository uses GitHub Actions + Azure Static Web Apps to validate changes and deploy `main`.

## Branching

- Use a dedicated work branch for CI/CD edits (example: `ci/azure-main-deploy`).
- Open a PR into `main`.
- Direct pushes to `main` should be disabled with branch protection.

## Workflows

### 1) CI (`.github/workflows/ci.yml`)
- Trigger: `pull_request` to `main`
- Steps:
  1. `npm ci`
  2. `npm test`
  3. `npm run build`
- Behavior: fail-fast validation for PR quality gates.

### 2) Production CD (`.github/workflows/cd-azure.yml`)
- Trigger: `push` to `main` and `workflow_dispatch`
- Steps:
  1. Re-run validation (`npm ci`, `npm test`, `npm run build`)
  2. Upload `dist` as a versioned artifact (`dist-<sha>`, retention 30 days)
  3. Deploy artifact to Azure Static Web Apps production
  4. Smoke-check deployed URL when available
  5. Publish deployment summary in workflow output

### 3) Optional PR staging previews (`.github/workflows/azure-preview.yml`)
- Trigger: PR open/sync/reopen/close to `main`
- Behavior:
  - Deploy preview environment for open PRs
  - Close preview environment when PR closes

## Required secrets

Configure in **GitHub → Settings → Secrets and variables → Actions**:

- `AZURE_STATIC_WEB_APPS_API_TOKEN`  
  Deployment token from Azure Static Web Apps.

`GITHUB_TOKEN` is provided automatically by GitHub Actions.

## Azure setup

1. Create an Azure Static Web App resource.
2. Connect it to this repository.
3. Copy the deployment token from Azure and store it as `AZURE_STATIC_WEB_APPS_API_TOKEN`.
4. Confirm:
   - Production environment tracks `main`
   - Pull request environments are enabled for previews

## Release controls for `main` (GitHub settings)

Create a branch protection rule for `main`:

1. Require a pull request before merging
2. Require at least one approving review
3. Require status checks to pass before merging:
   - `Test and Build` (CI)
   - `Validate for Production` (CD pre-deploy validation)
4. Restrict who can push to `main` (or disable direct pushes entirely)

## Rollback process

Use one of these approaches:

1. **Re-run a known-good `CD - Azure Static Web Apps` workflow run** for the commit you want to restore.
2. If needed, identify the prior successful run from Actions history and redeploy that commit by re-running its workflow.

Each deployment keeps a `dist-<sha>` artifact for 30 days to provide traceable build references.

## Observability and health checks

- Workflow run history in GitHub Actions provides deployment timeline and logs.
- Deployment summary includes commit SHA, run URL, and deployed app URL (when available).
- The CD workflow runs a basic HTTP smoke check against the deployed URL.
