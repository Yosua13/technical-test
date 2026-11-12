using QuestPDF.Infrastructure;
using SiapBos.Shared.Security;

QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSiapBosCoreInfrastructure(builder.Configuration);
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseSiapBosPipeline();

app.Run();
