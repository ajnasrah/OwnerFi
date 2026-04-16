# Audit #6 — Land Classification

Generated: 2026-04-16T19:09:06.735Z
Total properties: 10580

## homeType frequency table

| homeType | count | in-expected-set |
|---|---:|---|
| SINGLE_FAMILY | 7649 | NO |
| CONDO | 874 | NO |
| LOT | 604 | NO |
| MANUFACTURED | 450 | NO |
| MULTI_FAMILY | 318 | NO |
| (missing) | 308 | NO |
| TOWNHOUSE | 304 | NO |
| single-family | 54 | yes |
| HOME_TYPE_UNKNOWN | 12 | NO |
| APARTMENT | 6 | NO |
| condo | 1 | yes |

## Categories

### cat1_landHomeTypeButNotFlagged
- homeType says land/lot but isLand !== true
- count: 31
- first 20: zpid_2056813020, zpid_2064476069, zpid_2142112616, zpid_234962237, zpid_244449, zpid_30342677, zpid_307940, zpid_340349928, zpid_343948909, zpid_343949303, zpid_343949727, zpid_343956649, zpid_346893585, zpid_405819880, zpid_40946055, zpid_41259592, zpid_42137447, zpid_42291022, zpid_440149083, zpid_440149314

### cat2_flaggedLandButWrongHomeType
- isLand === true but homeType !== "land"
- count: 573
- first 20: zpid_103220726, zpid_103377328, zpid_103378254, zpid_108424200, zpid_108431854, zpid_108870469, zpid_109546798, zpid_109559003, zpid_112371545, zpid_112407862, zpid_113258846, zpid_119265968, zpid_121286563, zpid_122957840, zpid_124727215, zpid_125030789, zpid_141562877, zpid_18639166, zpid_19067713, zpid_1910341

### cat3_probableUnflaggedLand
- bd=0 ba=0 sf=0 lsf>0 and isLand !== true
- count: 42
- first 20: zpid_109235026, zpid_109237642, zpid_109312801, zpid_109374451, zpid_109414715, zpid_109458594, zpid_109505925, zpid_112942969, zpid_174725501, zpid_2064476069, zpid_2078413694, zpid_2142112616, zpid_235103855, zpid_243340613, zpid_244449, zpid_250273, zpid_307940, zpid_343948909, zpid_343949303, zpid_343949727

### cat5_unexpectedHomeType
- homeType not in expected normalized set
- count: 10217
- distinct values: {"CONDO":874,"SINGLE_FAMILY":7649,"TOWNHOUSE":304,"MANUFACTURED":450,"MULTI_FAMILY":318,"LOT":604,"HOME_TYPE_UNKNOWN":12,"APARTMENT":6}
- first 20: zpid_101317013, zpid_101344699, zpid_101446184, zpid_101489067, zpid_101694551, zpid_101699765, zpid_10201186, zpid_102107669, zpid_102146876, zpid_102166400, zpid_102230345, zpid_102264216, zpid_102351903, zpid_10238448, zpid_102440373, zpid_102457484, zpid_1024575, zpid_102476523, zpid_102503741, zpid_102511019

### cat6_landInCashDeals
- isLand=true but dealTypes includes cash_deal
- count: 17
- first 20: zpid_124727215, zpid_19463111, zpid_2062798627, zpid_234610, zpid_250322060, zpid_268933, zpid_29646833, zpid_299215639, zpid_350188754, zpid_363421, zpid_457102211, zpid_55112382, zpid_55308236, zpid_89033021, zpid_89260166, zpid_89296984, zpid_89317600

### cat7_landWithZestimate
- isLand=true but has non-zero zestimate
- count: 0
- first 20: 

### cat8_missingHomeTypeButActive
- homeType missing/null/empty but isActive=true
- count: 0
- first 20: 
