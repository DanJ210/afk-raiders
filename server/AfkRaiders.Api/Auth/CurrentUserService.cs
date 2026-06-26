using System.Security.Claims;
using AfkRaiders.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace AfkRaiders.Api.Auth;

public sealed class CurrentUserService(AfkRaidersDbContext dbContext, TimeProvider timeProvider)
{
    public async Task<AppUser> GetOrCreateAsync(ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var provider = principal.FindFirst(DevelopmentAuthenticationDefaults.ProviderClaimType)?.Value;
        var subject = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrWhiteSpace(provider) || string.IsNullOrWhiteSpace(subject))
        {
            throw new InvalidOperationException("Authenticated user is missing provider or subject claims.");
        }

        var user = await dbContext.AppUsers
            .SingleOrDefaultAsync(
                candidate => candidate.AuthProvider == provider && candidate.AuthSubject == subject,
                cancellationToken);

        var now = timeProvider.GetUtcNow();
        var displayName = principal.Identity?.Name;

        if (user is not null)
        {
            if (!string.Equals(user.DisplayName, displayName, StringComparison.Ordinal))
            {
                user.DisplayName = displayName;
                user.UpdatedAt = now;
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            return user;
        }

        user = new AppUser
        {
            Id = Guid.NewGuid(),
            AuthProvider = provider,
            AuthSubject = subject,
            DisplayName = displayName,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.AppUsers.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        return user;
    }
}