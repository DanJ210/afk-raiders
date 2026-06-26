namespace AfkRaiders.Api.Data;

public sealed class RaiderSave
{
    public Guid UserId { get; set; }
    public int SaveVersion { get; set; }
    public long Revision { get; set; }
    public int Seed { get; set; }
    public DateTimeOffset LastTickAt { get; set; }
    public string StateJson { get; set; } = "{}";
    public string Checksum { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public AppUser User { get; set; } = null!;
}