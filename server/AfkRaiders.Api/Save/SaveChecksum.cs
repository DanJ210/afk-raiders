using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace AfkRaiders.Api.Save;

public static class SaveChecksum
{
    public static string Compute(int saveVersion, int seed, DateTimeOffset lastTickAt, JsonElement state)
    {
        var checksumPayload = new ChecksumPayload(
            saveVersion,
            seed,
            lastTickAt.ToUniversalTime(),
            state);

        var json = JsonSerializer.Serialize(checksumPayload, SaveJson.SerializerOptions);
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(json));

        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static bool Matches(SavePayload payload)
    {
        var expected = Compute(payload.SaveVersion, payload.Seed, payload.LastTickAt, payload.State);
        return string.Equals(expected, payload.Checksum, StringComparison.OrdinalIgnoreCase);
    }

    private sealed record ChecksumPayload(
        int SaveVersion,
        int Seed,
        DateTimeOffset LastTickAt,
        JsonElement State);
}