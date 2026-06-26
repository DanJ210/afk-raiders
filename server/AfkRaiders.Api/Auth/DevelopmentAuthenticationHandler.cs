using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace AfkRaiders.Api.Auth;

public static class DevelopmentAuthenticationDefaults
{
    public const string Scheme = "Development";
    public const string Provider = "development";
    public const string ProviderClaimType = "afk:auth_provider";
}

public sealed class DevelopmentAuthenticationOptions : AuthenticationSchemeOptions
{
    public bool AllowDevelopmentUsers { get; set; }
}

public sealed class DevelopmentAuthenticationHandler(
    IOptionsMonitor<DevelopmentAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<DevelopmentAuthenticationOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Options.AllowDevelopmentUsers)
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var subject = Request.Headers["X-AFK-Dev-User"].FirstOrDefault()?.Trim();
        if (string.IsNullOrWhiteSpace(subject))
        {
            subject = "local-dev";
        }

        if (subject.Length > 128)
        {
            return Task.FromResult(AuthenticateResult.Fail("Development user id is too long."));
        }

        var displayName = Request.Headers["X-AFK-Dev-Display-Name"].FirstOrDefault()?.Trim();
        if (displayName?.Length > 80)
        {
            displayName = displayName[..80];
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, subject),
            new(DevelopmentAuthenticationDefaults.ProviderClaimType, DevelopmentAuthenticationDefaults.Provider),
            new(ClaimTypes.Name, string.IsNullOrWhiteSpace(displayName) ? subject : displayName)
        };

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}