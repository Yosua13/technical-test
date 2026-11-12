using QuestPDF.Infrastructure;
using SiapBos.Report.Services;
using SiapBos.Shared.Security;

QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSiapBosCoreInfrastructure(builder.Configuration);
builder.Services.AddScoped<BosBopPdfGenerator>();
builder.Services.AddScoped<BosBopExcelGenerator>();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseSiapBosPipeline();

app.Run();
