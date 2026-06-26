namespace AfkRaiders.Api.Data;

public sealed class AppUser
{
    public Guid Id { get; set; }
    public string AuthProvider { get; set; } = string.Empty;
    public string AuthSubject { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public RaiderSave? RaiderSave { get; set; }
}