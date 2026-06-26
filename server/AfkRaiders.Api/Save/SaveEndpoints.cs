using System.Security.Claims;
using AfkRaiders.Api.Auth;
using AfkRaiders.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace AfkRaiders.Api.Save;

public static class SaveEndpoints
{
    public static IEndpointRouteBuilder MapSaveEndpoints(this IEndpointRouteBuilder routes)
    {
        var api = routes.MapGroup("/api").RequireAuthorization();

        api.MapGet("/me", GetProfileAsync);
        api.MapGet("/save", GetSaveAsync);
        api.MapPut("/save", PutSaveAsync);
        api.MapPost("/save/reset", ResetSaveAsync);
        api.MapPost("/auth/logout", () => Results.NoContent());

        return routes;
    }

    private static async Task<IResult> GetProfileAsync(
        ClaimsPrincipal principal,
        CurrentUserService currentUserService,
        CancellationToken cancellationToken)
    {
        var user = await currentUserService.GetOrCreateAsync(principal, cancellationToken);
        return Results.Ok(new AccountProfileResponse(user.Id, user.DisplayName, user.AuthProvider));
    }

    private static async Task<IResult> GetSaveAsync(
        ClaimsPrincipal principal,
        CurrentUserService currentUserService,
        AfkRaidersDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var user = await currentUserService.GetOrCreateAsync(principal, cancellationToken);
        var save = await dbContext.RaiderSaves
            .AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.UserId == user.Id, cancellationToken);

        return save is null ? Results.NotFound() : Results.Ok(ToEnvelope(save));
    }

    private static async Task<IResult> PutSaveAsync(
        SaveUploadRequest request,
        ClaimsPrincipal principal,
        CurrentUserService currentUserService,
        AfkRaidersDbContext dbContext,
        SavePayloadValidator validator,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var payload = request.ToPayload();
        var errors = validator.Validate(payload);
        if (errors.Count > 0)
        {
            return Results.BadRequest(new ValidationErrorResponse(errors));
        }

        var user = await currentUserService.GetOrCreateAsync(principal, cancellationToken);
        var save = await dbContext.RaiderSaves
            .SingleOrDefaultAsync(candidate => candidate.UserId == user.Id, cancellationToken);
        var now = timeProvider.GetUtcNow();

        if (save is null)
        {
            if (request.Revision != 0)
            {
                return Results.Conflict(new SaveConflictResponse(
                    "Remote save does not exist. Use revision 0 to create it.",
                    0,
                    null));
            }

            save = CreateSave(user, payload, revision: 1, now);
            dbContext.RaiderSaves.Add(save);
        }
        else
        {
            if (save.Revision != request.Revision)
            {
                return Results.Conflict(new SaveConflictResponse(
                    "Save revision is stale.",
                    save.Revision,
                    ToEnvelope(save)));
            }

            ApplyPayload(save, payload, save.Revision + 1, now);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(ToEnvelope(save));
    }

    private static async Task<IResult> ResetSaveAsync(
        ResetSaveRequest request,
        ClaimsPrincipal principal,
        CurrentUserService currentUserService,
        AfkRaidersDbContext dbContext,
        SavePayloadValidator validator,
        TimeProvider timeProvider,
        CancellationToken cancellationToken)
    {
        var payload = request.ToPayload();
        var errors = validator.Validate(payload);
        if (errors.Count > 0)
        {
            return Results.BadRequest(new ValidationErrorResponse(errors));
        }

        var user = await currentUserService.GetOrCreateAsync(principal, cancellationToken);
        var save = await dbContext.RaiderSaves
            .SingleOrDefaultAsync(candidate => candidate.UserId == user.Id, cancellationToken);
        var now = timeProvider.GetUtcNow();

        if (save is null)
        {
            save = CreateSave(user, payload, revision: 1, now);
            dbContext.RaiderSaves.Add(save);
        }
        else
        {
            ApplyPayload(save, payload, revision: 1, now);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Results.Ok(ToEnvelope(save));
    }

    private static RaiderSave CreateSave(AppUser user, SavePayload payload, long revision, DateTimeOffset now)
    {
        var save = new RaiderSave
        {
            UserId = user.Id,
            User = user,
            CreatedAt = now
        };

        ApplyPayload(save, payload, revision, now);

        return save;
    }

    private static void ApplyPayload(RaiderSave save, SavePayload payload, long revision, DateTimeOffset now)
    {
        save.SaveVersion = payload.SaveVersion;
        save.Revision = revision;
        save.Seed = payload.Seed;
        save.LastTickAt = payload.LastTickAt.ToUniversalTime();
        save.StateJson = payload.State.GetRawText();
        save.Checksum = payload.Checksum.Trim().ToLowerInvariant();
        save.UpdatedAt = now;
    }

    private static RemoteSaveEnvelope ToEnvelope(RaiderSave save) => new(
        save.UserId,
        save.SaveVersion,
        save.Revision,
        save.Seed,
        save.LastTickAt,
        save.UpdatedAt,
        SaveJson.ParseState(save.StateJson),
        save.Checksum);
}