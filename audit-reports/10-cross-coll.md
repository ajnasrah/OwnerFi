# Audit #10 — Cross-Collection Coherence (properties ↔ agent_outreach_queue)

Generated: 2026-04-16T19:10:47.754Z
Properties: 10580   Queue docs: 2649

## Property `source` frequency

| source | count |
|---|---:|
| scraper-v2 | 5196 |
| apify-rebuild | 4257 |
| backfill-blast | 923 |
| agent_outreach | 102 |
| agent_outreach_system | 100 |
| manual-add-v2 | 2 |

## Queue `status` distribution

| status | count |
|---|---:|
| sent_to_ghl | 1340 |
| sent | 464 |
| agent_no | 408 |
| property_off_market | 303 |
| agent_yes | 116 |
| agent_pending | 14 |
| no_response | 3 |
| sold | 1 |

## Categories

| category | count |
|---|---:|
| cat1 queue-yes-no-property | 16 |
| cat2 property-agent_outreach-no-queue | 5 |
| cat3 stuck sent_to_ghl (>30d, no resp) | 390 |
| cat4 phone+address dupes (groups) | 118 |
| cat5 confirmed-but-no-owner_finance | 2 |
| cat6 property-ghl-no-queue | 0 |
| cat7 yes-response-wrong-status | 0 |
| cat9 stale-response-re-scraped | 131 |
| cat10 manual_admin verified | 1 |

### cat1 queue-yes-no-property
- count: 16
- sample ids: 19dNzZdxqvxFLpvmiXhq, Bl8RtgSLP7Wb7IqZkSUz, Hl17M2CKwpUunu08E5Ay, Kkrj43Adc045utlkwz4q, MDVXfXMrKB3Rhjig4jDz, S5GAnAj4RnKHIlJ0jxCN, UJltgBrt7f61FXROGmbS, aPVGh1r6Ncfj6jZPtTMa, ddBnOIh5QMw2FJxULHPb, eONeCDfCaDOp3qb8SoJN, hBaLk7Cx2gYIoFnaDWzP, konFP0GFCnaQCx4JWhSF, moJwP2Dzh8rmNoAfFIM0, sEohmDbgViu7nH2Cu6hQ, ut4P9bJbP2ULq4KTOCjg, yNnspXAiTvTA17T3Q1Ob

### cat2 property-agent_outreach-no-queue
- count: 5
- sample ids: zpid_42174317, zpid_42227520, zpid_42253899, zpid_42346296, zpid_89322899

### cat3 stuck sent_to_ghl (>30d, no resp)
- count: 390
- sample ids: 0BvmeQfVivqmog6Gp735, 0ErapfcMWhQC4lQMslXS, 0OZa4x5KS6GA7evMj4AD, 0g5YJECGfLDtHkKhD98h, 0gqUNsQniIKFQaQ7b8ei, 0o4oK8febLOWuRu7VUr7, 1E530PtCb3Y9yL8vkeEp, 1EVs4XB6BaXUOcyU6hVg, 1YcBTGOMPHN1AJyko53X, 1vSHN4PkLYJS5ePRe9SY, 1z14sQscmet8lcb6eAPw, 21vOOvtlSrZzhTPIDg9X, 29qDKsbQZgzEkaNl1kKF, 2IDFOto5114lzScRKezW, 2XwFVQnN10jktgVzn7mx, 2rvolL75dzfBT3VVIgkt, 2vDBfP9H9DU4uu7WwvnO, 38X3mkAfihLlkdKTcPMr, 3GOiXzll4hR1sX1vNE76, 3IQIl9LuPZmLDduzbo6x

### cat4 phone+address dupes (groups)
- count: 118

### cat5 confirmed-but-no-owner_finance
- count: 2
- sample ids: zpid_42144324, zpid_42253899

### cat6 property-ghl-no-queue
- count: 0
- sample ids: 

### cat7 yes-response-wrong-status
- count: 0
- sample ids: 

### cat9 stale-response-re-scraped
- count: 131
- sample ids: 0hEknVPfVLmMi9OAWBTm, 0kEGdc1RFsWM80iZlExZ, 1a4xtlLXwQRe23BfG3xB, 1dM8Kj893lWKKpfAvvcN, 1vFmmzz0mfmfATtn93yS, 2IbhtbUMubyh5gaWc6OR, 2ZXz1Z5TiBSrb3Yxry8u, 3UIZ5RRzis06mFmEk333, 3luQequ7NQTYZfdCsqfN, 6d2EEHZ7Qs1PDov6hZgV, 6tjHMgD0XzmRW3Bsll3g, 7iUOEAnxYJO7V7xC90hy, 8D8M2fW65WErT1KkiFKB, 8JhHnPQn8TDlfOuGwGWr, 8gncKhKDo8vT3KF8Hmn9, 8mi6iP3fSE0xg4CPglhd, 8pyFmTPTEiHGdacFU7bZ, 99lolQRVaaQ2p1bihzp9, AQ38PULQV4GowmFdSkKy, AcFaxQ5njdQs1Dr8kGpO

### cat10 manual_admin verified
- count: 1
- sample ids: zpid_460701363

### cat4 dupe top groups (first 20)
- `+19018598562||3573 hanna dr` × 3: 2JVMhg2xH2k26S1Mh92Q, Q1SdyVJkFJKL3ppnNmDB, ljXkjWDEKmsJyqXRCYeC
- `+19018598562||3447 scenic hwy` × 3: 4oeLj8ySz6XAVgWI383u, BBNsnBqOla0mDLHs65eU, mD9g5jWrX4aCG8v4eiJN
- `+16468986901||1707 wainwright ct` × 2: 0F5bDkDQq1oH0BSPzCtQ, WjoihYqHlh8TMO67tfn0
- `5019511755||18 westglen cv` × 2: 0L5IhkpDELelvSP2XuDV, FeeP4O4GgsjXxOPoVW3E
- `5016581508||(undisclosed address)` × 2: 0XBNM4hS32C6j3Pc4r63, fq4qQhk1OaEhKs8e3Loa
- `+19014063224||9342 salem rd` × 2: 0ZrqTHWrngdGnaW76oyc, Hi6E7FCZ0xuS9Zadt16G
- `5017435444||13324 alexander rd` × 2: 19dNzZdxqvxFLpvmiXhq, D3FxIwhl2jP490mAP5MG
- `+19014128208||974 tatum rd` × 2: 1cNBZS9XwvRyriVDxfLr, H89rfZhIAnPWkSTIoog9
- `+19015504359||740 shotwell st lot 6` × 2: 1sge2OCK2SqEaTgFNHO6, POwpEmLmnyv1MfkoJLcd
- `+19013348895||318 simpson ave` × 2: 1wsvDcl0EHZE7GN779v3, qdYOk8lEleMCTO3k4noH
- `+15014145494||18720 johns ln` × 2: 24XHRslDxuPuKsTEVaH4, Z3MMvSf7ISEBe6mBZP9B
- `+19014123141||8021 brooxie cv` × 2: 2Df2iNF6gltp7Neu6bhr, qdezq3x2ciOJCBhnCgOC
- `9016120431||440 saint andrews dr` × 2: 2IDFOto5114lzScRKezW, JRAxn3o7EdRp82BRBGlx
- `+19016747005||6496 wimble rd` × 2: 2IHAydMzkiP2SLT7qU1w, zryYsPobPRZekwkDhZ43
- `+19012899962||1932 carr ave` × 2: 2KjDmLAVNawteUpq2EbJ, f3Xj3JQ3iXgEraEgwmn3
- `+19012784380||2618 supreme ave` × 2: 2hPAxyvkU5vpACIOPIUC, lkVw6X9Mx9WjIBIgaUkl
- `+15014636336||3500 whitfield st` × 2: 2nS2WVZ9ijxey4lCa8TD, E0y6pMxHHYQ6q9bptmPV
- `+19012829020||10471 ashboro dr` × 2: 3PKK0iW4PnXKNDEW9lDE, vk0BZkAT8guNJPKNTSuU
- `+16292605285||3741 ridgemont rd` × 2: 3qONGZEbRJ9Y5WPEFr4L, FHmPEYLKvm7Qnpbn4RH6
- `+17313006773||15 riley cv` × 2: 3uCsF2UurCS2vFKPMg1X, VVMpeLVQFL3LfwYCXeM7

### verifiedBy frequency

| verifiedBy | count |
|---|---:|
| manual_admin | 1 |