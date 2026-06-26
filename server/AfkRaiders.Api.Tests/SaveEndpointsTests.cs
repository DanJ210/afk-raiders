using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AfkRaiders.Api.Data;
using AfkRaiders.Api.Save;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace AfkRaiders.Api.Tests;

public sealed class AfkRaidersApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureServices(services =>
        {
            var databaseName = $"afk-raiders-api-tests-{Guid.NewGuid()}";

            services.RemoveAll<IDbContextOptionsConfiguration<AfkRaidersDbContext>>();
            services.RemoveAll<DbContextOptions<AfkRaidersDbContext>>();
            services.AddDbContext<AfkRaidersDbContext>(options =>
                options.UseInMemoryDatabase(databaseName));
        });
    }
}

public sealed class SaveEndpointsTests(AfkRaidersApiFactory factory) : IClassFixture<AfkRaidersApiFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task Me_ReturnsProvisionedDevelopmentAccount()
    {
        using var client = CreateClient("handler-profile");

        var profile = await client.GetFromJsonAsync<AccountProfileResponse>("/api/me", JsonOptions);

        Assert.NotNull(profile);
        Assert.NotEqual(Guid.Empty, profile.UserId);
        Assert.Equal("development", profile.AuthProvider);
        Assert.Equal("Handler handler-profile", profile.DisplayName);
    }

    [Fact]
    public async Task PutSave_CreatesSaveAndPreservesLogConditionMetadata()
    {
        using var client = CreateClient("handler-save-create");
        var request = BuildUpload(0, """
            {
              "version": 7,
              "phase": "RAIDING",
              "log": [
                {
                  "id": "condition-overlap",
                  "conditions": ["EXTRACTING", "DOWNED"]
                }
              ]
            }
            """);

        var putResponse = await client.PutAsJsonAsync("/api/save", request, JsonOptions);

        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var saved = await putResponse.Content.ReadFromJsonAsync<RemoteSaveEnvelope>(JsonOptions);
        Assert.NotNull(saved);
        Assert.Equal(1, saved.Revision);
        Assert.Equal("EXTRACTING", saved.State.GetProperty("log")[0].GetProperty("conditions")[0].GetString());
        Assert.Equal("DOWNED", saved.State.GetProperty("log")[0].GetProperty("conditions")[1].GetString());

        var getResponse = await client.GetAsync("/api/save");
        var fetched = await getResponse.Content.ReadFromJsonAsync<RemoteSaveEnvelope>(JsonOptions);

        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        Assert.NotNull(fetched);
        Assert.Equal(saved.Revision, fetched.Revision);
        Assert.Equal("EXTRACTING", fetched.State.GetProperty("log")[0].GetProperty("conditions")[0].GetString());
    }

    [Fact]
    public async Task PutSave_ReturnsConflictForStaleRevision()
    {
        using var client = CreateClient("handler-stale-revision");

        var createRequest = BuildUpload(0, """{"version":7,"log":[]} """);
        var createResponse = await client.PutAsJsonAsync("/api/save", createRequest, JsonOptions);
        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);

        var staleRequest = BuildUpload(0, """{"version":7,"log":[]} """);
        var staleResponse = await client.PutAsJsonAsync("/api/save", staleRequest, JsonOptions);

        Assert.Equal(HttpStatusCode.Conflict, staleResponse.StatusCode);

        var conflict = await staleResponse.Content.ReadFromJsonAsync<SaveConflictResponse>(JsonOptions);
        Assert.NotNull(conflict);
        Assert.Equal(1, conflict.CurrentRevision);
    }

    [Fact]
    public async Task PutSave_RejectsUnsupportedLogConditions()
    {
        using var client = CreateClient("handler-invalid-condition");
        var request = BuildUpload(0, """
            {
              "version": 7,
              "log": [
                { "id": "bad", "conditions": ["SNEAKING"] }
              ]
            }
            """);

        var response = await client.PutAsJsonAsync("/api/save", request, JsonOptions);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var validation = await response.Content.ReadFromJsonAsync<ValidationErrorResponse>(JsonOptions);
        Assert.NotNull(validation);
        Assert.Contains(validation.Errors, error => error.Contains("Unsupported log condition", StringComparison.Ordinal));
    }

    [Fact]
    public async Task PutSave_RejectsMismatchedChecksum()
    {
        using var client = CreateClient("handler-bad-checksum");
        var request = BuildUpload(0, """{"version":7,"log":[]} """) with
        {
            Checksum = "not-the-right-checksum"
        };

        var response = await client.PutAsJsonAsync("/api/save", request, JsonOptions);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutSave_RejectsMissingStateWithoutThrowing()
    {
        using var client = CreateClient("handler-missing-state");
        var request = new
        {
            saveVersion = 7,
            revision = 0,
            seed = 12345,
            lastTickAt = DateTimeOffset.UtcNow,
            checksum = "missing-state"
        };

        var response = await client.PutAsJsonAsync("/api/save", request, JsonOptions);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var validation = await response.Content.ReadFromJsonAsync<ValidationErrorResponse>(JsonOptions);
        Assert.NotNull(validation);
        Assert.Contains("state is required.", validation.Errors);
    }

    private HttpClient CreateClient(string userId)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-AFK-Dev-User", userId);
        client.DefaultRequestHeaders.Add("X-AFK-Dev-Display-Name", $"Handler {userId}");
        return client;
    }

    private static SaveUploadRequest BuildUpload(long revision, string stateJson)
    {
        var state = ParseState(stateJson);
        var lastTickAt = DateTimeOffset.UtcNow;
        var checksum = SaveChecksum.Compute(7, 12345, lastTickAt, state);

        return new SaveUploadRequest(
            SaveVersion: 7,
            Revision: revision,
            Seed: 12345,
            LastTickAt: lastTickAt,
            State: state,
            Checksum: checksum);
    }

    private static JsonElement ParseState(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }
}