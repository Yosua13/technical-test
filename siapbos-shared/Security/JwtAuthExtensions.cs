using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using SiapBos.Shared.Entities;

namespace SiapBos.Shared.Security;

public static class JwtSettingsDefaults
{
    public const string Issuer = "SiapBosAuthServer";
    public const string Audience = "SiapBosMicroservices";
    public const string SecretKey = "SIAP_BOS_DKI_JAKARTA_TECHNICAL_TEST_SUPER_SECRET_KEY_2026_MIN_64_BYTES_LONG";
}

public static class ServiceCollectionAuthExtensions
{
    public static IServiceCollection AddSiapBosJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var issuer = configuration["Jwt:Issuer"] ?? JwtSettingsDefaults.Issuer;
        var audience = configuration["Jwt:Audience"] ?? JwtSettingsDefaults.Audience;
        var key = configuration["Jwt:Key"] ?? JwtSettingsDefaults.SecretKey;

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = issuer,
                ValidAudience = audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                ClockSkew = TimeSpan.FromMinutes(2)
            };
        });

        services.AddAuthorization();
        return services;
    }

    public static string GenerateToken(AppUser user, int tahunAnggaran, IConfiguration configuration)
    {
        var issuer = configuration["Jwt:Issuer"] ?? JwtSettingsDefaults.Issuer;
        var audience = configuration["Jwt:Audience"] ?? JwtSettingsDefaults.Audience;
        var key = configuration["Jwt:Key"] ?? JwtSettingsDefaults.SecretKey;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Username),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.NamaLengkap),
            new(ClaimTypes.Role, user.RoleCode),
            new("username", user.Username),
            new("nrk", user.Nrk),
            new("roleCode", user.RoleCode),
            new("wilayahSudin", user.WilayahSudin),
            new("tahunAnggaran", tahunAnggaran.ToString())
        };

        if (user.SekolahId.HasValue)
        {
            claims.Add(new Claim("sekolahId", user.SekolahId.Value.ToString()));
        }

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
