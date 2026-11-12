using Microsoft.AspNetCore.Mvc;
using SiapBos.Shared.Constants;
using SiapBos.Shared.Controllers;
using SiapBos.Shared.Data;
using SiapBos.Shared.Services;

namespace SiapBop.Api.Controllers;

[Route("api-bop")]
public class BopBkuController : BaseBkuController
{
    protected override string DefaultSumberDana => SumberDanaTypes.Bop;

    public BopBkuController(SiapBosDbContext db, BkuCoreService core, IHttpClientFactory httpClientFactory)
        : base(db, core, httpClientFactory)
    {
    }
}
