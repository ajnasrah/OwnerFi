# Audit #3: Deal Type Flag Consistency

Total docs scanned: **10580**

## Counts

| # | Violation | Count |
|---|-----------|------:|
| v1 | v1 dealTypes has OF but isOwnerfinance !== true | 338 |
| v2 | v2 isOwnerfinance true but dealTypes missing owner_finance | 200 |
| v3 | v3 dealTypes has cash but isCashDeal !== true | 0 |
| v4 | v4 isCashDeal true but dealTypes missing cash_deal | 1201 |
| v5 | v5 ownerFinanceVerified true but dealTypes missing owner_finance | 54 |
| v6 | v6 agentConfirmedOwnerfinance true but dealTypes missing owner_finance | 2 |
| v7 | v7 financingType/allFinancingTypes OF-like but dealTypes missing owner_finance | 12 |
| v8 | v8 empty dealTypes + active + source scraper-v2/agent_outreach | 905 |
| v9 | v9 both flags false but dealTypes non-empty | 79 |
| v10 | v10 unknown dealTypes strings | 0 |

### v1 — dealTypes has owner_finance but isOwnerfinance !== true — 338

First 20 IDs:

- `zpid_102511019`
- `zpid_102511484`
- `zpid_104547261`
- `zpid_105447340`
- `zpid_107061780`
- `zpid_107983829`
- `zpid_108238854`
- `zpid_108794962`
- `zpid_109156754`
- `zpid_109180810`
- `zpid_1111092`
- `zpid_11126634`
- `zpid_113082767`
- `zpid_113258846`
- `zpid_114518796`
- `zpid_117600947`
- `zpid_117791423`
- `zpid_11831400`
- `zpid_119715094`
- `zpid_120306659`

### v2 — isOwnerfinance === true but dealTypes missing owner_finance — 200

First 20 IDs:

- `zpid_101446184`
- `zpid_102107669`
- `zpid_1029674`
- `zpid_103996688`
- `zpid_105258885`
- `zpid_105428079`
- `zpid_107868407`
- `zpid_108078898`
- `zpid_10846302`
- `zpid_110302389`
- `zpid_111839498`
- `zpid_113168042`
- `zpid_114123758`
- `zpid_116126741`
- `zpid_117967800`
- `zpid_126831704`
- `zpid_163421255`
- `zpid_18809059`
- `zpid_201529791`
- `zpid_2063178649`

### v3 — dealTypes has cash_deal but isCashDeal !== true — 0

_none_

### v4 — isCashDeal === true but dealTypes missing cash_deal — 1201

First 20 IDs:

- `zpid_101446184`
- `zpid_10201186`
- `zpid_102107669`
- `zpid_10238448`
- `zpid_102893817`
- `zpid_1029674`
- `zpid_103037424`
- `zpid_103118438`
- `zpid_103125609`
- `zpid_103145385`
- `zpid_103929384`
- `zpid_103996688`
- `zpid_104255489`
- `zpid_105164810`
- `zpid_105258885`
- `zpid_105336743`
- `zpid_105428079`
- `zpid_105448213`
- `zpid_106076904`
- `zpid_106188785`

### v5 — ownerFinanceVerified === true but dealTypes missing owner_finance — 54

First 20 IDs:

- `zpid_106128096`
- `zpid_113766328`
- `zpid_115624275`
- `zpid_115765916`
- `zpid_119741752`
- `zpid_126188664`
- `zpid_190078306`
- `zpid_193862067`
- `zpid_2056351059`
- `zpid_2068638183`
- `zpid_2086277842`
- `zpid_21771229`
- `zpid_21807257`
- `zpid_2305389`
- `zpid_247564223`
- `zpid_26234465`
- `zpid_2666392`
- `zpid_28071771`
- `zpid_29594883`
- `zpid_299168305`

### v6 — agentConfirmedOwnerfinance === true but dealTypes missing owner_finance — 2

First 20 IDs:

- `zpid_42144324`
- `zpid_42253899`

### v7 — financingType OF-like but dealTypes missing owner_finance — 12

First 20 IDs:

- `zpid_115769832`
- `zpid_2065913203`
- `zpid_2113458639`
- `zpid_222871051`
- `zpid_29992299`
- `zpid_359223333`
- `zpid_36916718`
- `zpid_457505701`
- `zpid_46430160`
- `zpid_6037081`
- `zpid_72808333`
- `zpid_89449263`

### v8 — empty dealTypes + isActive + source scraper-v2/agent_outreach — 905

First 20 IDs:

- `zpid_102983133`
- `zpid_106128096`
- `zpid_109099696`
- `zpid_111371942`
- `zpid_112936056`
- `zpid_112942013`
- `zpid_112942798`
- `zpid_112942969`
- `zpid_113766328`
- `zpid_115624275`
- `zpid_115765916`
- `zpid_115769832`
- `zpid_119348358`
- `zpid_119542507`
- `zpid_120139022`
- `zpid_123162192`
- `zpid_126188664`
- `zpid_161588498`
- `zpid_161594157`
- `zpid_161603811`

### v9 — both flags false but dealTypes non-empty — 79

First 20 IDs:

- `zpid_109156754`
- `zpid_113258846`
- `zpid_114518796`
- `zpid_117600947`
- `zpid_122917271`
- `zpid_16301248`
- `zpid_18051083`
- `zpid_18060452`
- `zpid_19463026`
- `zpid_2057637761`
- `zpid_2059509138`
- `zpid_2066791488`
- `zpid_2068424069`
- `zpid_2069920458`
- `zpid_2074154780`
- `zpid_209206738`
- `zpid_2097338909`
- `zpid_2125093845`
- `zpid_216784310`
- `zpid_22030081`

### v10 — unknown dealTypes strings — 0

_none_
