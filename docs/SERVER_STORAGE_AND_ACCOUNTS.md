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
- Database: PostgreSQL for account/save metadata + JSONB payload
- API: HTTPS JSON endpoints for profile, save fetch/upload/reset, optional history
- Client persistence: localStorage remains local cache; signed-in users sync remote saves
- Conflict handling: optimistic concurrency via server `revision`

## Storage model

```sql
create table app_user (
  id uuid primary key,
  auth_provider text not null,
  auth_subject text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_provider, auth_subject)
);

create table raider_save (
  user_id uuid primary key references app_user(id) on delete cascade,
  save_version integer not null,
  revision bigint not null default 1,
  seed integer not null,
  last_tick_at timestamptz not null,
  state jsonb not null,
  checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table save_snapshot (
  id uuid primary key,
  user_id uuid not null references app_user(id) on delete cascade,
  revision bigint not null,
  save_version integer not null,
  seed integer not null,
  last_tick_at timestamptz not null,
  state jsonb not null,
  checksum text not null,
  created_at timestamptz not null default now(),
  unique (user_id, revision)
);

create index idx_raider_save_save_version on raider_save (save_version);
create index idx_raider_save_last_tick_at on raider_save (last_tick_at);
create index idx_raider_save_seed on raider_save (seed);

create index idx_save_snapshot_save_version on save_snapshot (save_version);
create index idx_save_snapshot_last_tick_at on save_snapshot (last_tick_at);
create index idx_save_snapshot_seed on save_snapshot (seed);
```

`raider_save.state` should store current `GameState` shape from `src/engine/types.ts`. Keep `seed`, `lastTickAt`, and `save_version` as top-level columns and index them outside payload for migration/catch-up checks. Log entries inside `state.log` may include ordered `conditions?: LogCondition[]` metadata for RAIDING overlays; the server should preserve this payload field and validate it only against supported condition labels, not derive it independently.

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
- Tests for authz, validation, version/reset behavior, offline sync, conflict paths

## Scope boundaries

- Do not move simulation to server in this phase.
- Do not introduce non-.NET backend runtime for this feature.
- Keep first backend phase narrow: accounts, authentication, save storage, reset, offline sync conflict handling.
- Defer social/leaderboard/other-Raider features.
