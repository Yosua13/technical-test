using SiapBos.Shared.Security;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSiapBosCoreInfrastructure(builder.Configuration);
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseSiapBosPipeline();

app.Run();
