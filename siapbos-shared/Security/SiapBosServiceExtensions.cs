using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SiapBos.Shared.Data;

namespace SiapBos.Shared.Security;

public static class SiapBosServiceExtensions
{
    public static IServiceCollection AddSiapBosCoreInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

        var connStr = Environment.GetEnvironmentVariable("SIAPBOS_DB_CONNECTION")
                      ?? configuration.GetConnectionString("DefaultConnection")
                      ?? "Host=localhost;Port=5432;Database=siapbos_dummy_db;Username=postgres;Password=postgres";

        services.AddDbContext<SiapBosDbContext>(options => options.UseNpgsql(connStr));

        services.AddSiapBosJwtAuthentication(configuration);

        services.AddCors(options =>
        {
            options.AddPolicy("AllowAllSiapBos", policy =>
                policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
        });

        services.AddControllers()
            .AddJsonOptions(opts =>
            {
                opts.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
                opts.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
            });

        services.AddHttpClient("IntegrationClient", client =>
        {
            var baseUrl = configuration["ServiceUrls:IntegrationServer"] ?? "http://localhost:5004";
            client.BaseAddress = new Uri(baseUrl);
            client.Timeout = TimeSpan.FromSeconds(15);
        });

        services.AddHttpClient("AuthClient", client =>
        {
            var baseUrl = configuration["ServiceUrls:AuthServer"] ?? "http://localhost:5001";
            client.BaseAddress = new Uri(baseUrl);
            client.Timeout = TimeSpan.FromSeconds(15);
        });

        services.AddEndpointsApiExplorer();
        return services;
    }

    public static WebApplication UseSiapBosPipeline(this WebApplication app)
    {
        app.UseCors("AllowAllSiapBos");
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();
        app.MapGet("/health", () => Results.Ok(new
        {
            status = "UP",
            service = AppDomain.CurrentDomain.FriendlyName,
            timestamp = DateTime.UtcNow
        }));
        return app;
    }
}
