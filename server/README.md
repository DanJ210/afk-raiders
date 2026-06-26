# AFK Raiders Server

This is the first server-side storage slice for AFK Raiders. It stores authenticated save envelopes in Azure SQL Database/SQL Server while the Vue client remains offline-first and continues to run simulation locally.

## Projects

- `AfkRaiders.Api` - ASP.NET Core API for account profile and save storage endpoints.
- `AfkRaiders.Api.Tests` - xUnit endpoint tests using an in-memory EF store.

## Local Development

The development auth scheme is enabled only when `Authentication:AllowDevelopmentUsers` is true. In `Development`, requests can use these headers:

```http
X-AFK-Dev-User: local-dev
X-AFK-Dev-Display-Name: Local Handler
```

Run the API:

```powershell
dotnet run --project server/AfkRaiders.Api/AfkRaiders.Api.csproj
```

Run backend tests:

```powershell
dotnet test server/AfkRaiders.Server.slnx
```

Apply the initial SQL Server schema after configuring `ConnectionStrings:AfkRaiders`:

```powershell
dotnet ef database update --project server/AfkRaiders.Api/AfkRaiders.Api.csproj --startup-project server/AfkRaiders.Api/AfkRaiders.Api.csproj -- --environment Development
```

Use a `dotnet-ef` tool version compatible with the EF Core packages in the API project.

## Current Scope

Implemented now:

- `GET /health`
- `GET /api/me`
- `GET /api/save`
- `PUT /api/save`
- `POST /api/save/reset`
- `POST /api/auth/logout`
- SQL Server EF model and initial migration for `app_user` and `raider_save`
- Optimistic save revisions with `409 Conflict` on stale writes
- Save validation for version, timestamp, payload size, checksum, and supported log conditions

Not implemented in this slice: push notifications, friends/social graph, live presence, server-side catch-up, and server-side simulation.