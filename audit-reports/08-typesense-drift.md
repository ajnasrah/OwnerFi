# Audit 08 — Firestore ↔ Typesense Drift

Generated: 2026-04-16T19:10:52.478Z

## Headline Counts

- Total Firestore docs: **10580**
- Total Typesense docs: **3162**
- Expected-in-Typesense (active + dealTypes non-empty): **3408**
- Actual overlap (expected AND indexed): **3069**
- Missing from Typesense (expected but not indexed): **339**
- Orphans (in Typesense, not in Firestore): **0**
- In Typesense but Firestore isActive === false: **2**

## Missing from Typesense — source distribution

- `scraper-v2`: 306
- `apify-rebuild`: 19
- `agent_outreach`: 14

### Missing from Typesense — first 30 IDs

- zpid_1024575
- zpid_103378254
- zpid_103800897
- zpid_103911745
- zpid_105420201
- zpid_108431854
- zpid_108820035
- zpid_108870469
- zpid_109546798
- zpid_109559003
- zpid_112911832
- zpid_113023354
- zpid_113488398
- zpid_113973125
- zpid_114518796
- zpid_117600947
- zpid_118892124
- zpid_122765651
- zpid_122917271
- zpid_13454947
- zpid_141562877
- zpid_14982771
- zpid_15004012
- zpid_16301248
- zpid_172165993
- zpid_18051083
- zpid_18060452
- zpid_18578297
- zpid_19067713
- zpid_19098555

## Orphans in Typesense — first 30 IDs

_none_

## In Typesense but Firestore isActive === false — first 30 IDs

- zpid_385117753
- zpid_40311478

## Field-value drift (docs present in both)

| Field | Drift count |
|---|---:|
| price | 0 |
| dealTypes | 260 |
| isOwnerFinance | 208 |
| isCashDeal | 137 |
| city | 0 |
| state | 0 |
| zipCode | 0 |
| homeType | 0 |

### dealTypes — examples

- `zpid_102511019`: firestore=`["cash_deal","owner_finance"]` typesense=`["cash_deal"]`
- `zpid_102511484`: firestore=`["cash_deal","owner_finance"]` typesense=`["cash_deal"]`
- `zpid_103929384`: firestore=`["owner_finance"]` typesense=`["both"]`
- `zpid_105311603`: firestore=`["cash_deal","owner_finance"]` typesense=`["both"]`
- `zpid_105447340`: firestore=`["cash_deal","owner_finance"]` typesense=`["cash_deal"]`
- `zpid_105448213`: firestore=`["owner_finance"]` typesense=`["both"]`
- `zpid_106076904`: firestore=`["owner_finance"]` typesense=`["both"]`
- `zpid_106189671`: firestore=`["owner_finance"]` typesense=`["both"]`
- `zpid_106855421`: firestore=`["owner_finance"]` typesense=`["both"]`
- `zpid_107061780`: firestore=`["cash_deal","owner_finance"]` typesense=`["cash_deal"]`

### isOwnerFinance — examples

- `zpid_102511019`: firestore=`true` typesense=`false`
- `zpid_102511484`: firestore=`true` typesense=`false`
- `zpid_103929384`: firestore=`true` typesense=`false`
- `zpid_105311603`: firestore=`true` typesense=`false`
- `zpid_105447340`: firestore=`true` typesense=`false`
- `zpid_105448213`: firestore=`true` typesense=`false`
- `zpid_106076904`: firestore=`true` typesense=`false`
- `zpid_106189671`: firestore=`true` typesense=`false`
- `zpid_106855421`: firestore=`true` typesense=`false`
- `zpid_107061780`: firestore=`true` typesense=`false`

### isCashDeal — examples

- `zpid_103929384`: firestore=`true` typesense=`false`
- `zpid_105311603`: firestore=`true` typesense=`false`
- `zpid_105448213`: firestore=`true` typesense=`false`
- `zpid_106076904`: firestore=`true` typesense=`false`
- `zpid_106189671`: firestore=`true` typesense=`false`
- `zpid_106855421`: firestore=`true` typesense=`false`
- `zpid_107868407`: firestore=`true` typesense=`false`
- `zpid_116060306`: firestore=`true` typesense=`false`
- `zpid_126676930`: firestore=`true` typesense=`false`
- `zpid_1290641`: firestore=`true` typesense=`false`

## Owner-finance drift (most user-visible)

- Firestore active + owner_finance dealType: **3188**
- Missing from Typesense: **339**
- In Typesense but owner_finance flag missing: **168**

### owner_finance missing-from-Typesense — first 30

- zpid_1024575
- zpid_103378254
- zpid_103800897
- zpid_103911745
- zpid_105420201
- zpid_108431854
- zpid_108820035
- zpid_108870469
- zpid_109546798
- zpid_109559003
- zpid_112911832
- zpid_113023354
- zpid_113488398
- zpid_113973125
- zpid_114518796
- zpid_117600947
- zpid_118892124
- zpid_122765651
- zpid_122917271
- zpid_13454947
- zpid_141562877
- zpid_14982771
- zpid_15004012
- zpid_16301248
- zpid_172165993
- zpid_18051083
- zpid_18060452
- zpid_18578297
- zpid_19067713
- zpid_19098555

### owner_finance in Typesense w/ flag missing — first 30

- zpid_102511019
- zpid_102511484
- zpid_103929384
- zpid_105311603
- zpid_105447340
- zpid_105448213
- zpid_106076904
- zpid_106189671
- zpid_106855421
- zpid_107061780
- zpid_113082767
- zpid_116060306
- zpid_12363597
- zpid_125885550
- zpid_126676930
- zpid_12728303
- zpid_1290641
- zpid_138056898
- zpid_14895889
- zpid_168826595
- zpid_17276105
- zpid_193027849
- zpid_194155814
- zpid_19463111
- zpid_2062002013
- zpid_2062656698
- zpid_2062798627
- zpid_22093329
- zpid_22317816
- zpid_230606262
