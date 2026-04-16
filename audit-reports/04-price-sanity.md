# Audit #4: Price / Zestimate Sanity

Total docs scanned: **10580**

| # | Category | Count |
|---|---|---|
| 1 | `isCashDeal` true but price >= 0.8 * zest | 823 |
| 2 | `isCashDeal` true but zestimate missing/0 | 1039 |
| 3 | Not flagged cash deal but qualifies (non-land) | 15 |
| 4 | `price` vs `listPrice` differ >1% | 0 |
| 5 | Junk price (<=0 or >$10M) on active | 0 |
| 6 | `priceToZestimateRatio` mismatch >1% | 47 |
| 7 | `discountPercent` mismatch >2pts | 0 |
| 8 | `eightyPercentOfZestimate` mismatch >1% | 1166 |
| 9 | Zest >$5M and price <$100k | 0 |
| 10 | Land + `isCashDeal` true | 17 |

## First 20 IDs per category

### 1_cashDeal_but_doesnt_qualify (823)

- `zpid_101694551`
- `zpid_102511484`
- `zpid_102893817`
- `zpid_103779433`
- `zpid_103790945`
- `zpid_103791253`
- `zpid_10406337`
- `zpid_10410100`
- `zpid_10437320`
- `zpid_105208631`
- `zpid_105335058`
- `zpid_105589858`
- `zpid_106076904`
- `zpid_107061780`
- `zpid_107868407`
- `zpid_107983829`
- `zpid_108238854`
- `zpid_108794962`
- `zpid_109027211`
- `zpid_10965925`

### 2_cashDeal_but_zestimate_missing (1039)

- `zpid_101446184`
- `zpid_10201186`
- `zpid_102107669`
- `zpid_10238448`
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
- `zpid_106188785`
- `zpid_106201370`
- `zpid_106219438`

### 3_qualifies_but_not_flagged (15)

- `zpid_114518796`
- `zpid_2059764070`
- `zpid_246308499`
- `zpid_26215772`
- `zpid_26277892`
- `zpid_26385930`
- `zpid_294367`
- `zpid_300328287`
- `zpid_42172574`
- `zpid_461358173`
- `zpid_47114929`
- `zpid_47311958`
- `zpid_47348402`
- `zpid_89913926`
- `zpid_92189185`

### 4_price_vs_listPrice_diff_gt_1pct (0)

_(none)_

### 5_junk_price_on_active (0)

_(none)_

### 6_priceToZestimateRatio_mismatch (47)

- `zpid_103791253`
- `zpid_2098337157`
- `zpid_269258`
- `zpid_275183`
- `zpid_275661`
- `zpid_285500`
- `zpid_285930`
- `zpid_310043`
- `zpid_310480`
- `zpid_312342`
- `zpid_314932`
- `zpid_321706`
- `zpid_343517`
- `zpid_348124`
- `zpid_350875`
- `zpid_35734753`
- `zpid_42131092`
- `zpid_42140494`
- `zpid_42142390`
- `zpid_42142558`

### 7_discountPercent_mismatch (0)

_(none)_

### 8_eightyPercentOfZestimate_mismatch (1166)

- `zpid_101694551`
- `zpid_102511484`
- `zpid_102893817`
- `zpid_102983133`
- `zpid_103894763`
- `zpid_105062709`
- `zpid_105420201`
- `zpid_105425944`
- `zpid_106189671`
- `zpid_10823215`
- `zpid_108238854`
- `zpid_108427558`
- `zpid_108810958`
- `zpid_108820035`
- `zpid_108832327`
- `zpid_10916201`
- `zpid_10945793`
- `zpid_109630358`
- `zpid_10965925`
- `zpid_110535356`

### 9_huge_zest_tiny_price (0)

_(none)_

### 10_land_with_cashDeal (17)

- `zpid_124727215`
- `zpid_19463111`
- `zpid_2062798627`
- `zpid_234610`
- `zpid_250322060`
- `zpid_268933`
- `zpid_29646833`
- `zpid_299215639`
- `zpid_350188754`
- `zpid_363421`
- `zpid_457102211`
- `zpid_55112382`
- `zpid_55308236`
- `zpid_89033021`
- `zpid_89260166`
- `zpid_89296984`
- `zpid_89317600`


## Worst offenders — category 1 (flagged cash, ratio >= 0.8)

- `zpid_2067438321` price=$1,250,000 zest=$492,400 ratio=2.5386
- `zpid_93378863` price=$279,900 zest=$131,300 ratio=2.1318
- `zpid_87191175` price=$69,500 zest=$34,700 ratio=2.0029
- `zpid_42159420` price=$55,000 zest=$31,000 ratio=1.7742
- `zpid_27183174` price=$295,000 zest=$176,000 ratio=1.6761
- `zpid_130748391` price=$399,950 zest=$248,200 ratio=1.6114
- `zpid_14027259` price=$180,000 zest=$112,500 ratio=1.6
- `zpid_113779634` price=$247,500 zest=$169,100 ratio=1.4636
- `zpid_94966832` price=$650,000 zest=$444,100 ratio=1.4636
- `zpid_80639581` price=$299,900 zest=$208,700 ratio=1.437

## Worst offenders — category 5 (junk price, active)

_(none)_

## Worst offenders — category 9 (huge zest, tiny price)

_(none)_
