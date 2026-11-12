using SiapBos.Shared.Security;
using SiapBos.Shared.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSiapBosCoreInfrastructure(builder.Configuration);
builder.Services.AddScoped<BkuCoreService>();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseSiapBosPipeline();

app.Run();
