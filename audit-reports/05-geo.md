# Audit 05 — GEO / Address Consistency

- Total docs: **10580**
- Generated: 2026-04-16T19:09:12.231Z

## Category Counts

| Category | Count | Description |
|---|---:|---|
| `stateMalformed` | 0 | state present but not exactly 2 uppercase letters |
| `zipMalformed` | 22 | zipCode not exactly 5 digits (or valid ZIP+4) |
| `zipStateMismatch` | 1 | zipCode first digits clearly not in state range |
| `coordsOutOfBounds` | 16 | lat/lng both present but (0,0) or outside US bounds |
| `coordsOneMissing` | 0 | one of lat/lng present, the other missing |
| `fullAddressMissingState` | 100 | fullAddress does not contain state code |
| `streetAddressMismatch` | 0 | streetAddress and address both present but differ |
| `cityCasing` | 8 | city is all lowercase or ALL CAPS |
| `addressHasComma` | 0 | address contains a comma (likely full string jammed in) |
| `duplicateCoords` | 83 | same lat/lng (4dp) appears in >5 docs |

## stateMalformed (0)

state present but not exactly 2 uppercase letters

_None_

## zipMalformed (22)

zipCode not exactly 5 digits (or valid ZIP+4)

First 20 doc IDs:

- `zpid_2055279946`
- `zpid_2055774624`
- `zpid_2056143297`
- `zpid_2061671125`
- `zpid_2063956244`
- `zpid_2064320810`
- `zpid_2067446191`
- `zpid_2081276739`
- `zpid_443637899`
- `zpid_452938128`
- `zpid_454085050`
- `zpid_454343928`
- `zpid_455592306`
- `zpid_455839920`
- `zpid_457312488`
- `zpid_457711784`
- `zpid_458626279`
- `zpid_459524574`
- `zpid_460591298`
- `zpid_461240906`

Samples:

```json
[
  {
    "id": "zpid_2055279946",
    "zipCode": "L1C4J2"
  },
  {
    "id": "zpid_2055774624",
    "zipCode": "N5A2T9"
  },
  {
    "id": "zpid_2056143297",
    "zipCode": "V9T6M3"
  },
  {
    "id": "zpid_2061671125",
    "zipCode": "L3M0E9"
  },
  {
    "id": "zpid_2063956244",
    "zipCode": "L8P1S2"
  },
  {
    "id": "zpid_2064320810",
    "zipCode": "L3K4A5"
  },
  {
    "id": "zpid_2067446191",
    "zipCode": "L8M2H7"
  },
  {
    "id": "zpid_2081276739",
    "zipCode": "S6H4B9"
  },
  {
    "id": "zpid_443637899",
    "zipCode": "P2N2G4"
  },
  {
    "id": "zpid_452938128",
    "zipCode": "N1A1K5"
  }
]
```

## zipStateMismatch (1)

zipCode first digits clearly not in state range

First 20 doc IDs:

- `zpid_2077367670`

Samples:

```json
[
  {
    "id": "zpid_2077367670",
    "state": "TX",
    "zipCode": "99999"
  }
]
```

## coordsOutOfBounds (16)

lat/lng both present but (0,0) or outside US bounds

First 20 doc IDs:

- `zpid_2063411605`
- `zpid_2081276739`
- `zpid_271792`
- `zpid_274056`
- `zpid_331251`
- `zpid_344883015`
- `zpid_43134805`
- `zpid_449958381`
- `zpid_455839920`
- `zpid_457312488`
- `zpid_457711784`
- `zpid_458041995`
- `zpid_459518738`
- `zpid_459641770`
- `zpid_460591298`
- `zpid_461307778`

Samples:

```json
[
  {
    "id": "zpid_2063411605",
    "lat": 0,
    "lng": 0,
    "reason": "zero"
  },
  {
    "id": "zpid_2081276739",
    "lat": 50.40552,
    "lng": -105.550865,
    "state": "SK"
  },
  {
    "id": "zpid_271792",
    "lat": 0,
    "lng": 0,
    "reason": "zero"
  },
  {
    "id": "zpid_274056",
    "lat": 0,
    "lng": 0,
    "reason": "zero"
  },
  {
    "id": "zpid_331251",
    "lat": 0,
    "lng": 0,
    "reason": "zero"
  },
  {
    "id": "zpid_344883015",
    "lat": 17.699547,
    "lng": -64.86888,
    "state": "VI"
  },
  {
    "id": "zpid_43134805",
    "lat": 0,
    "lng": 0,
    "reason": "zero"
  },
  {
    "id": "zpid_449958381",
    "lat": 18.340765,
    "lng": -64.964874,
    "state": "VI"
  },
  {
    "id": "zpid_455839920",
    "lat": 53.64846,
    "lng": -113.653564,
    "state": "AB"
  },
  {
    "id": "zpid_457312488",
    "lat": 53.428062,
    "lng": -113.43471,
    "state": "AB"
  }
]
```

## coordsOneMissing (0)

one of lat/lng present, the other missing

_None_

## fullAddressMissingState (100)

fullAddress does not contain state code

First 20 doc IDs:

- `zpid_103791253`
- `zpid_2065706508`
- `zpid_2081471152`
- `zpid_2098337157`
- `zpid_2103578098`
- `zpid_228987455`
- `zpid_262230`
- `zpid_269258`
- `zpid_272611`
- `zpid_275183`
- `zpid_275661`
- `zpid_279930`
- `zpid_285500`
- `zpid_285930`
- `zpid_285931`
- `zpid_298538`
- `zpid_303223`
- `zpid_310043`
- `zpid_310480`
- `zpid_312342`

Samples:

```json
[
  {
    "id": "zpid_103791253",
    "fullAddress": "1015 Clay Pond Dr",
    "state": "TN"
  },
  {
    "id": "zpid_2065706508",
    "fullAddress": "5265 Chatfield Dr #5265",
    "state": "TN"
  },
  {
    "id": "zpid_2081471152",
    "fullAddress": "4724 Morning Glory Ct #81",
    "state": "TN"
  },
  {
    "id": "zpid_2098337157",
    "fullAddress": "1577 N Pkwy",
    "state": "TN"
  },
  {
    "id": "zpid_2103578098",
    "fullAddress": "1207 Middle Ct APT 102",
    "state": "TN"
  },
  {
    "id": "zpid_228987455",
    "fullAddress": "657 Quinn Rd",
    "state": "MS"
  },
  {
    "id": "zpid_262230",
    "fullAddress": "908 Quince Hill Rd",
    "state": "AR"
  },
  {
    "id": "zpid_269258",
    "fullAddress": "5616 Jacksonville Conway Rd",
    "state": "AR"
  },
  {
    "id": "zpid_272611",
    "fullAddress": "11 Fra Mar Dr",
    "state": "AR"
  },
  {
    "id": "zpid_275183",
    "fullAddress": "2101 Muldrow Dr",
    "state": "AR"
  }
]
```

## streetAddressMismatch (0)

streetAddress and address both present but differ

_None_

## cityCasing (8)

city is all lowercase or ALL CAPS

First 20 doc IDs:

- `zpid_120772892`
- `zpid_124035419`
- `zpid_2085782200`
- `zpid_42156932`
- `zpid_43107385`
- `zpid_66878142`
- `zpid_69922612`
- `zpid_75272566`

Samples:

```json
[
  {
    "id": "zpid_120772892",
    "city": "VIDOR"
  },
  {
    "id": "zpid_124035419",
    "city": "JASPER"
  },
  {
    "id": "zpid_2085782200",
    "city": "WESLEY CHAPEL"
  },
  {
    "id": "zpid_42156932",
    "city": "MEMPHIS"
  },
  {
    "id": "zpid_43107385",
    "city": "LAUDERDALE BY THE SEA"
  },
  {
    "id": "zpid_66878142",
    "city": "RENO"
  },
  {
    "id": "zpid_69922612",
    "city": "TEMPLE"
  },
  {
    "id": "zpid_75272566",
    "city": "LOG CABIN"
  }
]
```

## addressHasComma (0)

address contains a comma (likely full string jammed in)

_None_

## duplicateCoords (83)

same lat/lng (4dp) appears in >5 docs

First 20 doc IDs:

- `zpid_109235026`
- `zpid_109237642`
- `zpid_109312801`
- `zpid_109374451`
- `zpid_109414715`
- `zpid_109458594`
- `zpid_109505925`
- `zpid_2060494029`
- `zpid_2060494030`
- `zpid_2065500355`
- `zpid_2098203082`
- `zpid_2098987141`
- `zpid_2098987142`
- `zpid_2098987146`
- `zpid_2098987149`
- `zpid_2098996482`
- `zpid_2098997284`
- `zpid_2098997362`
- `zpid_2098998311`
- `zpid_2101500490`

Samples:

```json
[
  {
    "id": "zpid_109235026",
    "coord": "34.6409,-86.4920",
    "groupSize": 7
  },
  {
    "id": "zpid_109237642",
    "coord": "34.6409,-86.4920",
    "groupSize": 7
  },
  {
    "id": "zpid_109312801",
    "coord": "34.6409,-86.4920",
    "groupSize": 7
  },
  {
    "id": "zpid_109374451",
    "coord": "34.6409,-86.4920",
    "groupSize": 7
  },
  {
    "id": "zpid_109414715",
    "coord": "34.6409,-86.4920",
    "groupSize": 7
  },
  {
    "id": "zpid_109458594",
    "coord": "34.6409,-86.4920",
    "groupSize": 7
  },
  {
    "id": "zpid_109505925",
    "coord": "34.6409,-86.4920",
    "groupSize": 7
  },
  {
    "id": "zpid_2060494029",
    "coord": "26.2248,-98.1945",
    "groupSize": 16
  },
  {
    "id": "zpid_2060494030",
    "coord": "26.2248,-98.1945",
    "groupSize": 16
  },
  {
    "id": "zpid_2065500355",
    "coord": "26.2248,-98.1945",
    "groupSize": 16
  }
]
```

## Top Duplicate Coord Groups

| Coord (lat,lng) | Docs |
|---|---:|
| 26.2248,-98.1945 | 16 |
| 28.6137,-100.4427 | 15 |
| 26.1664,-98.1175 | 9 |
| 26.1631,-98.1195 | 9 |
| 35.4700,-88.5204 | 8 |
| 34.6409,-86.4920 | 7 |
| 46.8776,-96.7873 | 7 |
| 34.6234,-86.5022 | 6 |
| 33.5600,-95.3511 | 6 |
