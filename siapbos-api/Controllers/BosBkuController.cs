using Microsoft.AspNetCore.Mvc;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Controllers;
using SiapBos.Shared.Data;
using SiapBos.Shared.Services;

namespace SiapBos.Api.Controllers;

[Route("api")]
public class BosBkuController : BaseBkuController
{
    protected override string DefaultSumberDana => SumberDanaTypes.Bos;

    public BosBkuController(SiapBosDbContext db, BkuCoreService core, IHttpClientFactory httpClientFactory)
        : base(db, core, httpClientFactory)
    {
    }
}
