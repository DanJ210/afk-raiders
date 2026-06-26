using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace AfkRaiders.Api.Save;

public sealed class SaveValidationOptions
{
    public const string SectionName = "SaveValidation";

    public int CurrentSaveVersion { get; set; } = 7;
    public int MaxStateBytes { get; set; } = 512_000;
    public int MaxFutureSkewMinutes { get; set; } = 5;
    public int MaxLogEntries { get; set; } = 200;
}

public sealed class SavePayloadValidator(IOptions<SaveValidationOptions> options, TimeProvider timeProvider)
{
    private static readonly HashSet<string> SupportedLogConditions = new(StringComparer.Ordinal)
    {
        "DOWNED",
        "EXTRACTING"
    };

    private readonly SaveValidationOptions validationOptions = options.Value;

    public IReadOnlyList<string> Validate(SavePayload payload)
    {
        var errors = new List<string>();

        if (payload.SaveVersion != validationOptions.CurrentSaveVersion)
        {
            errors.Add($"saveVersion must be {validationOptions.CurrentSaveVersion}.");
        }

        if (payload.LastTickAt == default)
        {
            errors.Add("lastTickAt is required.");
        }
        else if (payload.LastTickAt > timeProvider.GetUtcNow().AddMinutes(validationOptions.MaxFutureSkewMinutes))
        {
            errors.Add("lastTickAt cannot be in the far future.");
        }

        var hasState = payload.State.ValueKind is not JsonValueKind.Undefined;
        if (!hasState)
        {
            errors.Add("state is required.");
        }
        else if (payload.State.ValueKind is not JsonValueKind.Object)
        {
            errors.Add("state must be a JSON object.");
        }
        else
        {
            ValidateState(payload.State, payload.SaveVersion, errors);
        }

        if (hasState)
        {
            var stateBytes = Encoding.UTF8.GetByteCount(payload.State.GetRawText());
            if (stateBytes > validationOptions.MaxStateBytes)
            {
                errors.Add($"state payload exceeds {validationOptions.MaxStateBytes} bytes.");
            }
        }

        if (string.IsNullOrWhiteSpace(payload.Checksum))
        {
            errors.Add("checksum is required.");
        }
        else if (hasState && !SaveChecksum.Matches(payload))
        {
            errors.Add("checksum does not match payload.");
        }

        return errors;
    }

    private void ValidateState(JsonElement state, int saveVersion, List<string> errors)
    {
        if (state.TryGetProperty("version", out var stateVersion))
        {
            if (stateVersion.ValueKind is not JsonValueKind.Number || !stateVersion.TryGetInt32(out var version))
            {
                errors.Add("state.version must be a number when present.");
            }
            else if (version != saveVersion)
            {
                errors.Add("state.version must match saveVersion.");
            }
        }

        if (!state.TryGetProperty("log", out var log))
        {
            return;
        }

        if (log.ValueKind is not JsonValueKind.Array)
        {
            errors.Add("state.log must be an array when present.");
            return;
        }

        if (log.GetArrayLength() > validationOptions.MaxLogEntries)
        {
            errors.Add($"state.log cannot contain more than {validationOptions.MaxLogEntries} entries.");
        }

        var entryIndex = 0;
        foreach (var entry in log.EnumerateArray())
        {
            ValidateLogEntryConditions(entry, entryIndex, errors);
            entryIndex++;
        }
    }

    private static void ValidateLogEntryConditions(JsonElement entry, int entryIndex, List<string> errors)
    {
        if (entry.ValueKind is not JsonValueKind.Object || !entry.TryGetProperty("conditions", out var conditions))
        {
            return;
        }

        if (conditions.ValueKind is not JsonValueKind.Array)
        {
            errors.Add($"state.log[{entryIndex}].conditions must be an array when present.");
            return;
        }

        foreach (var condition in conditions.EnumerateArray())
        {
            if (condition.ValueKind is not JsonValueKind.String)
            {
                errors.Add($"state.log[{entryIndex}].conditions entries must be strings.");
                continue;
            }

            var conditionName = condition.GetString();
            if (conditionName is null || !SupportedLogConditions.Contains(conditionName))
            {
                errors.Add($"Unsupported log condition '{conditionName}' in state.log[{entryIndex}].conditions.");
            }
        }
    }
}