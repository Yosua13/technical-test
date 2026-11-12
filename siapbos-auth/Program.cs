using SiapBos.Shared.Data;
using SiapBos.Shared.Security;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSiapBosCoreInfrastructure(builder.Configuration);
builder.Services.AddMemoryCache();
builder.Services.AddSwaggerGen();

var app = builder.Build();

try
{
    await DbSeeder.EnsureDatabaseAndSeedAsync(app.Services);
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Database initialization deferred or failed; verify PostgreSQL connection string.");
}

app.UseSwagger();
app.UseSwaggerUI();
app.UseSiapBosPipeline();

app.Run();
