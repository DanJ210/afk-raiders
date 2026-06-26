using System.Text.Json;

namespace AfkRaiders.Api.Save;

public sealed record AccountProfileResponse(
    Guid UserId,
    string? DisplayName,
    string AuthProvider);

public sealed record RemoteSaveEnvelope(
    Guid UserId,
    int SaveVersion,
    long Revision,
    int Seed,
    DateTimeOffset LastTickAt,
    DateTimeOffset UpdatedAt,
    JsonElement State,
    string Checksum);

public sealed record SaveUploadRequest(
    int SaveVersion,
    long Revision,
    int Seed,
    DateTimeOffset LastTickAt,
    JsonElement State,
    string Checksum)
{
    public SavePayload ToPayload() => new(SaveVersion, Seed, LastTickAt, State, Checksum);
}

public sealed record ResetSaveRequest(
    int SaveVersion,
    int Seed,
    DateTimeOffset LastTickAt,
    JsonElement State,
    string Checksum)
{
    public SavePayload ToPayload() => new(SaveVersion, Seed, LastTickAt, State, Checksum);
}

public sealed record SaveConflictResponse(
    string Message,
    long CurrentRevision,
    RemoteSaveEnvelope? CurrentSave);

public sealed record ValidationErrorResponse(IReadOnlyList<string> Errors);

public readonly record struct SavePayload(
    int SaveVersion,
    int Seed,
    DateTimeOffset LastTickAt,
    JsonElement State,
    string Checksum);