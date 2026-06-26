using AfkRaiders.Api.Auth;
using AfkRaiders.Api.Data;
using AfkRaiders.Api.Save;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<SaveValidationOptions>(
    builder.Configuration.GetSection(SaveValidationOptions.SectionName));
builder.Services.AddSingleton(TimeProvider.System);

builder.Services
    .AddAuthentication(DevelopmentAuthenticationDefaults.Scheme)
    .AddScheme<DevelopmentAuthenticationOptions, DevelopmentAuthenticationHandler>(
        DevelopmentAuthenticationDefaults.Scheme,
        options =>
        {
            options.AllowDevelopmentUsers = builder.Configuration.GetValue(
                "Authentication:AllowDevelopmentUsers",
                builder.Environment.IsDevelopment());
        });

builder.Services.AddAuthorization();
builder.Services.AddScoped<CurrentUserService>();
builder.Services.AddScoped<SavePayloadValidator>();

builder.Services.AddDbContext<AfkRaidersDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("AfkRaiders");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException("ConnectionStrings:AfkRaiders must be configured.");
    }

    options.UseSqlServer(connectionString);
});

var app = builder.Build();

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapSaveEndpoints();

app.Run();

public partial class Program;
