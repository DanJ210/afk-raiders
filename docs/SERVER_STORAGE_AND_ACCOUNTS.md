# Server-side storage and accounts plan

## Problem

AFK Raiders currently stores one anonymous local save in `localStorage` as `{ state, seed, lastTickAt, version }`. That works for MVP, but it does not provide per-user accounts, cross-device continuity, account recovery, or server-backed progress.

The intended next architecture is account-backed storage where each user owns their Raider and progress. The selected direction is **offline-first sync**: the client continues deterministic local simulation and syncs signed-in saves to the server when online.

Because the project is still early, preserving existing anonymous local saves is **not required**. Introducing accounts/server saves may intentionally reset or invalidate old local saves in exchange for a cleaner foundation.

## Proposed approach

Keep `src/engine/` pure and unchanged conceptually. The server does not simulate UI behavior. The first backend phase stores and validates save envelopes; the client still advances ticks locally with seeded RNG and uploads resulting saves.

Use:

- Runtime/framework: **.NET 8+** (preferably ASP.NET Core Web API)
- Authentication: ASP.NET Core auth middleware with external provider(s) mapped to an internal `user_id`
- Database: Azure SQL Database for account/save metadata + JSON save payload
- API: HTTPS JSON endpoints for profile, save fetch/upload/reset, optional history
- Client persistence: localStorage remains local cache; signed-in users sync remote saves
- Conflict handling: optimistic concurrency via server `revision`

## Storage model

```sql
create table app_user (
  id uniqueidentifier primary key,
  auth_provider nvarchar(64) not null,
  auth_subject nvarchar(256) not null,
  display_name nvarchar(80),
  created_at datetimeoffset not null default sysdatetimeoffset(),
  updated_at datetimeoffset not null default sysdatetimeoffset(),
  unique (auth_provider, auth_subject)
);

create table raider_save (
  user_id uniqueidentifier primary key references app_user(id) on delete cascade,
  save_version integer not null,
  revision bigint not null default 1,
  seed integer not null,
  last_tick_at datetimeoffset not null,
  state nvarchar(max) not null,
  checksum nvarchar(128) not null,
  created_at datetimeoffset not null default sysdatetimeoffset(),
  updated_at datetimeoffset not null default sysdatetimeoffset(),
  constraint ck_raider_save_state_is_json check (isjson(state) = 1)
);

create table save_snapshot (
  id uniqueidentifier primary key,
  user_id uniqueidentifier not null references app_user(id) on delete cascade,
  revision bigint not null,
  save_version integer not null,
  seed integer not null,
  last_tick_at datetimeoffset not null,
  state nvarchar(max) not null,
  checksum nvarchar(128) not null,
  created_at datetimeoffset not null default sysdatetimeoffset(),
  constraint ck_save_snapshot_state_is_json check (isjson(state) = 1),
  unique (user_id, revision)
);

create index idx_raider_save_save_version on raider_save (save_version);
create index idx_raider_save_last_tick_at on raider_save (last_tick_at);
create index idx_raider_save_seed on raider_save (seed);

create index idx_save_snapshot_save_version on save_snapshot (save_version);
create index idx_save_snapshot_last_tick_at on save_snapshot (last_tick_at);
create index idx_save_snapshot_seed on save_snapshot (seed);
```

`raider_save.state` should store current `GameState` shape from `src/engine/types.ts` as JSON text validated by `ISJSON`. Keep `seed`, `lastTickAt`, and `save_version` as top-level columns and index them outside payload for migration/catch-up checks. Log entries inside `state.log` may include ordered `conditions?: LogCondition[]` metadata for RAIDING overlays; the server should preserve this payload field and validate it only against supported condition labels, not derive it independently.

`save_snapshot` is optional in first cut; if used, cap retention to avoid unbounded growth.

## Save envelope

```ts
interface RemoteSaveEnvelope {
  userId: string
  saveVersion: number
  revision: number
  seed: number
  lastTickAt: string
  updatedAt: string
  state: GameState
  checksum: string
}

interface SaveUploadRequest {
  // Server derives userId from auth context, not request body.
  saveVersion: number
  revision: number
  seed: number
  lastTickAt: string
  state: GameState
  checksum: string
}
```

Local extension:

```ts
interface LocalSaveData {
  state: GameState
  seed: number
  lastTickAt: number
  version: number
  remote?: {
    userId: string
    revision: number
    updatedAt: string
    dirty: boolean
  }
}
```

## API shape

- `GET /api/me` -> authenticated account profile
- `GET /api/save` -> latest `RemoteSaveEnvelope` (or `404`)
- `PUT /api/save` -> upload `SaveUploadRequest` with expected `revision` (server derives `userId` and `updatedAt`)
- `POST /api/save/reset` -> create fresh save for signed-in user
- `POST /api/auth/logout` (or provider equivalent) -> clear auth session

`PUT /api/save` should return `409 Conflict` for stale revisions.

## Current implementation slice

The initial backend scaffold lives in `server/`:

- `server/AfkRaiders.Api` implements the first ASP.NET Core API slice with development auth, EF Core/SQL Server persistence, save validation, and the endpoints listed above.
- `server/AfkRaiders.Api.Tests` covers account provisioning, save create/fetch, stale revision conflicts, checksum validation, missing-state validation, and preservation of `state.log[*].conditions` metadata.
- `server/AfkRaiders.Api/Data/Migrations` contains the initial SQL Server migration for `app_user` and `raider_save`.

This slice intentionally uses a development auth scheme as a local stand-in for future external provider auth. Production config keeps development users disabled unless explicitly enabled.

## Azure hosting readiness and Docker decision

The current server project is a good local/API foundation, but it is not fully Azure-production-ready yet. It can build and run as an ASP.NET Core API, but hosted Azure environments still need production authentication, deployment infrastructure, secure configuration, database connectivity, CORS, and operational checks.

Recommended first hosting path:

1. Host the Vue PWA as a static site using the existing static deployment path, likely Azure Static Web Apps or equivalent static hosting.
2. Host `server/AfkRaiders.Api` on Azure App Service for ASP.NET Core.
3. Store saves in Azure SQL Database.
4. Configure secrets and connection strings through Azure app settings and, later, Key Vault references. Do not commit production connection strings.
5. Use managed identity where supported and least-privilege access for Azure resources.
6. Add Infrastructure as Code under `infra/`, preferably Bicep/azd, before real deployment. Preview/what-if deployments before applying infrastructure changes.

Docker is not required for the first hosted save API. Azure App Service can run the .NET API directly with fewer moving parts, which fits the current scope better than containerizing immediately.

Revisit Docker when one of these becomes true:

- The API moves to Azure Container Apps.
- Push notification workers, scheduled jobs, or background processors need the same deployable runtime shape as the API.
- Local development needs a repeatable multi-service stack for API + SQL Server + worker processes.
- Runtime dependencies become more complex than normal App Service deployment supports comfortably.

If Docker is introduced later, test the image locally before Azure deployment and ensure the container listening port matches the Azure Container Apps target port.

Azure readiness checklist before production use:

- Replace development auth with a real external provider mapped to `app_user.auth_provider` and `app_user.auth_subject`.
- Add CORS allowing only the deployed frontend origin.
- Add a database-backed health check in addition to the lightweight `/health` endpoint.
- Add Application Insights or equivalent structured logging/telemetry.
- Add deployment-time migration policy for Azure SQL Database. Migrations should run intentionally from CI/CD or a controlled deployment step, not accidentally from every app startup.
- Add CI validation for `dotnet test server/AfkRaiders.Server.slnx` alongside existing frontend checks.
- Add Azure configuration documentation for `ConnectionStrings:AfkRaiders`, auth settings, allowed origins, and save validation settings.
- Keep push notifications, friends, live presence, and server-side catch-up out of the first Azure hosting milestone unless the scope is explicitly reopened.

## Sync behavior

On app start:

1. Load local save immediately (offline-safe render).
2. If signed in and online, fetch `/api/save`.
3. If remote newer and local clean, replace local with remote.
4. If local dirty and remote changed, show conflict resolution.
5. If remote missing, upload local as revision 1.

During play:

1. Persist locally after each tick/action.
2. Mark local as dirty when gameplay state changes.
3. Debounce remote uploads.
4. Upload on major transitions (successful extraction, knocked-out recovery, reset, rename, app background, periodic online intervals).
5. Clear dirty only after accepted server write.

Offline progression remains required: the server is never required for normal tick processing.

## Push notifications and friends readiness

The account/save backend is the right prerequisite for push notifications and future friends/social features, but those should not be in the first storage implementation.

Push notifications need server-owned state beyond the save envelope:

- Browser/native push subscriptions tied to `user_id`
- Notification preferences and quiet hours
- A notification outbox with dedupe keys so one DOWNED event does not send repeatedly
- A sender worker/job that retries failed sends and removes expired subscriptions

With the selected offline-first model, reliable push notifications are split into two tiers:

1. **Client-observed notifications:** straightforward after accounts exist. When the open app advances a tick and uploads a save showing a new important event such as DOWNED, extraction success, KNOCKED_OUT recovery, or Signal cap, the server can enqueue a push from that accepted save upload.
2. **Closed-app notifications:** more complex. If the app is fully closed, the backend cannot know the Raider became DOWNED unless the backend can replay or predict simulation from the last uploaded `{ state, seed, lastTickAt }`. That implies a later server-side catch-up worker or shared deterministic simulation package. Do not add this to the first storage phase.

Friends/social visibility can also build on the same account/save foundation:

- A future friendship/follow table can grant read access to a small public Raider status projection.
- The first projection can be **last-known status** derived from the latest accepted save: Raider name, phase, active `LogEvent.conditions`/raid conditions, zone, danger level, updated timestamp, and maybe the most recent public-safe comms line.
- True **live raiding/DOWNED status** is possible but more complex. If the player has the app open, SignalR/WebSocket presence plus debounced status updates can make friends see near-live changes. If the player is offline or the PWA is closed, the status is only as fresh as the last synced save unless a later server catch-up worker exists.

Implementation recommendation: first ship authenticated save sync, then add public status projections, then add push subscriptions/outbox, and only then consider live presence or server-side catch-up.

## Early-stage reset policy

Old anonymous saves can be discarded during backend launch:

1. Bump `SAVE_VERSION`.
2. Clear/ignore incompatible old local saves.
3. Create fresh account-ready local save.
4. On first sign-in, bootstrap remote save from current local save.
5. If account already has remote save, prefer remote over old anonymous local data.

## Validation/security

Server-side validation should enforce:

- Authenticated user must match save owner
- Supported `saveVersion`
- Plausible `lastTickAt` (not far future)
- Payload size limits (especially log content)
- Checksum/canonical payload match

This first phase prioritizes integrity and isolation over anti-cheat hardening.

## Implementation surfaces

- `src/stores/gameStore.ts`: persistence abstraction for local + remote metadata
- `src/services/authService.ts`: sign-in/out/session restore/current user
- `src/services/saveSyncService.ts`: fetch/upload/conflict/dirty handling
- New account + sync UI
- New .NET 8+ backend project (auth, save API, persistence, migrations, health checks)
- Azure hosting readiness: production auth provider, App Service config, Azure SQL Database config, CORS, DB health checks, telemetry, and IaC under `infra/`
- Tests for authz, validation, version/reset behavior, offline sync, conflict paths
- Later services/tables for push subscriptions, notification outbox, friendships/follows, public status projection, and optional live presence

## Scope boundaries

- Do not move simulation to server in this phase.
- Do not implement push notifications, friends, live presence, or server-side catch-up in the first storage phase.
- Do not introduce non-.NET backend runtime for this feature.
- Keep first backend phase narrow: accounts, authentication, save storage, reset, offline sync conflict handling.
- Defer social/leaderboard/other-Raider features.
