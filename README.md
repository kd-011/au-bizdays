# au-bizdays

Business-day and deadline arithmetic for Australian states and territories, as a command line tool and a read-only MCP server. It has each state's public holidays, including the substitute-day rules, and it returns an error for any date outside its data.

Date arithmetic is a known weak spot for language models, and the date tools I found for agents assume a Saturday and Sunday weekend with no state holidays. The Australian holiday sources I found were a .NET library and some web calculators, and I did not find anything an agent can call directly. That search was shallow, so treat this as one more option and not as the first of its kind.

An agent can ask "what is 10 business days from 2026-12-18 in WA?" or "is 2026-12-28 a business day in Victoria?" and get a deterministic answer with the holidays it skipped and the official page the dates came from. Typical uses are notice periods, payment terms, and contract or statutory deadlines.

## What counts as a business day

A business day is Monday to Friday and not a statewide public holiday in the state you name.

- Part-day holidays (Christmas Eve and New Year's Eve in SA and NT, Christmas Eve in QLD) count as ordinary business days. Results that touch one say so.
- Regional and local holidays (show days, the Hobart Regatta, local event days) are not in the data. Bank holidays are not counted either.
- Legislation, court rules or a contract may define business days differently, for example by excluding other days, counting bank days, or saying how to treat the day of service. This is not legal advice, and your own definition wins.

## Install

Nothing is published to npm yet, so run it from a clone. Node 18 or newer.

```sh
git clone https://github.com/kd-011/au-bizdays.git
cd au-bizdays
npm install        # also builds dist/
node dist/cli.js add 10 --from 2026-12-18 --state WA
```

`npm link` puts `au-bizdays` and `au-bizdays-mcp` on your PATH.

For an MCP client, point it at the built server:

```json
{
  "mcpServers": {
    "au-bizdays": { "command": "node", "args": ["/path/to/au-bizdays/dist/mcp.js"] }
  }
}
```

## Commands

Every command needs `--state` (ACT, NSW, NT, QLD, SA, TAS, VIC or WA, in any case). There is no default, because the answer depends on it. Add `--json` for machine output. Dates are `YYYY-MM-DD`.

| Command | What it does |
| --- | --- |
| `add <n> --from <date>` | The date n business days after `--from`. The start day does not count: day 0 is `--from`, so `add 1` from a Friday is the next business day. A negative n counts back. |
| `diff <from> <to> [--inclusive]` | Business days between two dates. The start day is excluded and the end day is included. `--inclusive` counts both. Negative when `<to>` is before `<from>`. Exact inverse of `add`. |
| `is <date>` | Whether the date is a business day, and if not, why (weekend, a named holiday, or both). |
| `next <date>` / `prev <date>` | The nearest business day strictly after or before a date. |
| `roll <date> --direction forward\|back` | Leave a business day alone, or move a non-business day to the nearest one. |
| `add-calendar <n> --from <date> --roll forward\|back\|none` | Add calendar days, then roll onto a business day. This is the "14 days from X, and if that is not a business day move it to the next one" case. |
| `holidays --year <year>` | The state's holidays for a year with name, date, scope and status. |

Exit codes: 0 ok, 2 usage error (including an unknown state), 3 date outside the bundled data. A date outside the data is a hard error that names the covered range, and no holiday is extrapolated.

Real output, generated from the code (a test fails if this block goes stale):

<!-- demo:start -->
```console
$ au-bizdays add 10 --from 2026-12-18 --state WA
10 business days after 2026-12-18 in WA is Wednesday 2027-01-06.
Skipped holidays: 2026-12-25 Christmas Day, 2026-12-28 Boxing Day (additional day), 2027-01-01 New Year's Day.
Business day = Monday to Friday, excluding WA statewide public holidays. Not legal advice; your contract or the law may differ.

$ au-bizdays is 2026-12-28 --state VIC
Monday 2026-12-28 is not a business day in VIC: Boxing Day (additional day).
Business day = Monday to Friday, excluding VIC statewide public holidays. Not legal advice; your contract or the law may differ.

$ au-bizdays diff 2026-12-18 2027-01-06 --state WA
10 business days from 2026-12-18 to 2027-01-06 in WA (start day not counted, end day counted).
Business day = Monday to Friday, excluding WA statewide public holidays. Not legal advice; your contract or the law may differ.

$ au-bizdays next 2026-12-24 --state SA
The next business day after 2026-12-24 in SA is Tuesday 2026-12-29.
Note: Christmas Eve (2026-12-24) is a part-day holiday in SA (7pm to midnight). It is counted as a normal business day here.
Business day = Monday to Friday, excluding SA statewide public holidays. Not legal advice; your contract or the law may differ.

$ au-bizdays prev 2027-01-04 --state NSW
The previous business day before 2027-01-04 in NSW is Thursday 2026-12-31.
Business day = Monday to Friday, excluding NSW statewide public holidays. Not legal advice; your contract or the law may differ.

$ au-bizdays roll 2026-12-26 --direction forward --state QLD
Saturday 2026-12-26 is not a business day in QLD; rolled forward to Tuesday 2026-12-29.
Business day = Monday to Friday, excluding QLD statewide public holidays. Not legal advice; your contract or the law may differ.

$ au-bizdays add-calendar 14 --from 2026-12-14 --roll forward --state WA
14 calendar days after 2026-12-14 in WA is Monday 2026-12-28, which is not a business day, so rolled forward to Tuesday 2026-12-29.
Business day = Monday to Friday, excluding WA statewide public holidays. Not legal advice; your contract or the law may differ.

$ au-bizdays holidays --year 2026 --state TAS
TAS public holidays 2026: 9 listed, 9 statewide.
2026-01-01  Thursday   New Year's Day
2026-01-26  Monday     Australia Day
2026-03-09  Monday     Eight Hours Day
2026-04-03  Friday     Good Friday
2026-04-06  Monday     Easter Monday
2026-04-25  Saturday   Anzac Day
2026-06-08  Monday     King's Birthday
2026-12-25  Friday     Christmas Day
2026-12-28  Monday     Boxing Day
Source: https://www.worksafe.tas.gov.au/topics/laws-and-compliance/public-holidays (retrieved 2026-11-02)
Business day = Monday to Friday, excluding TAS statewide public holidays. Not legal advice; your contract or the law may differ.

$ au-bizdays add 1 --from 2028-12-29 --state WA
au-bizdays: 2029-01-01 is outside the holiday data bundled for WA (2025-01-01 to 2028-12-31). The answer would depend on holidays that are not in the data, so none is given.
(exit 3)
```
<!-- demo:end -->

## JSON output

`--json` prints one object, schema `au-bizdays/v1`. The field names and shapes below are stable within v1. The example is abbreviated.

```json
{
  "schema": "au-bizdays/v1",
  "command": "add",
  "state": "WA",
  "input": { "n": 10, "from": "2026-12-18" },
  "result": {
    "from": "2026-12-18",
    "n": 10,
    "date": "2027-01-06",
    "weekday": "Wednesday",
    "skipped_holidays": [{ "date": "2026-12-25", "name": "Christmas Day" }]
  },
  "assumptions": {
    "weekend": ["Saturday", "Sunday"],
    "holidays_counted": "statewide",
    "part_day_holidays": "not counted: treated as business days, listed in caveats",
    "regional_holidays": "not counted: regional and local holidays are not in the data",
    "data_source": [{ "year": 2026, "url": "https://...", "retrieved_on": "2026-11-02" }],
    "data_version": "2026-11-02",
    "coverage": { "from": "2025-01-01", "to": "2028-12-31" }
  },
  "caveats": ["..."]
}
```

- `input` echoes the arguments as understood. `state` is the upper-case code.
- `assumptions` is the same shape for every command. `data_source` has one entry per covered year. `data_version` is the latest `retrieved_on`.
- `caveats` always ends with two standing notes (the business-day definition and the regional-holiday note). Anything specific to the answer comes first: estimated holidays the answer touched, part-day holidays it touched, and a warning when today is within 60 days of the end of the data.
- `result` by command:

| Command | `result` fields |
| --- | --- |
| `add` | `from`, `n`, `date`, `weekday`, `skipped_holidays` (weekday holidays passed, each `{date, name}`) |
| `diff` | `from`, `to`, `inclusive`, `business_days` |
| `is` | `date`, `weekday`, `is_business_day`, `reasons` (each `{kind: "weekend"}` or `{kind: "holiday", name, scope, status}`) |
| `next`, `prev` | `from`, `date`, `weekday` |
| `roll` | `from`, `direction`, `date`, `weekday`, `moved` |
| `add-calendar` | `from`, `n`, `roll`, `calendar_date`, `date`, `weekday`, `rolled` |
| `holidays` | `year`, `source_url`, `retrieved_on`, `holidays` (each `{date, weekday, name, scope, status, note?}`) |

With `--json`, errors also go to stdout: `{"schema": "au-bizdays/v1", "error": {"code": "usage" | "out_of_coverage", "message": "...", "exit_code": 2 | 3}}`. Coverage errors add `coverage: {from, to}`.

Output is deterministic. Dates are calendar dates, not timestamps, so the machine's timezone makes no difference.

## MCP server

`au-bizdays-mcp` speaks MCP over stdio. It is read-only, makes no network requests, and reads nothing except the bundled data files. Each tool takes the same arguments as its command, returns the JSON above as structured content, and adds a one-line summary as text. Errors come back as tool errors with the same message the CLI prints.

| Tool | CLI equivalent |
| --- | --- |
| `add_business_days` | `add` |
| `add_calendar_days` | `add-calendar` |
| `business_days_between` | `diff` |
| `is_business_day` | `is` |
| `next_business_day` | `next` |
| `previous_business_day` | `prev` |
| `roll_to_business_day` | `roll` |
| `list_holidays` | `holidays` |

`server.json` is a draft for the MCP registry. It has not been submitted.

## Holiday data

Bundled data is in `data/<state>/<year>.json`, 2025 to 2028 for every state. Each file has the `source_url`, the `retrieved_on` date, and the holidays, each with a `date`, `name`, `scope` (`statewide`, `part-day`; `regional` is reserved) and `status` (`confirmed` or `estimated`). Dates that fall on a weekend are kept, because the substitute rules differ by state and the original day is still the named holiday.

Each state's dates were read from its government page. Where the state's page no longer lists 2025, the national [data.gov.au dataset](https://data.gov.au/dataset/australian-holidays-machine-readable-dataset) is the source for that year, and it is also used as a cross-check.

<!-- sources:start -->
| State | Source | Years | Retrieved on |
| --- | --- | --- | --- |
| ACT | https://data.gov.au/data/dataset/b1bc6077-dadd-4f61-9f8c-002ab2cdff10/resource/4d4d744b-50ed-45b9-ae77-760bc478ad75/download/australian_public_holidays_2025.csv | 2025 | 2026-11-02 |
| ACT | https://www.act.gov.au/living-in-the-act/public-holidays-school-terms-and-daylight-saving | 2026 to 2028 | 2026-11-02 |
| NSW | https://data.gov.au/data/dataset/b1bc6077-dadd-4f61-9f8c-002ab2cdff10/resource/4d4d744b-50ed-45b9-ae77-760bc478ad75/download/australian_public_holidays_2025.csv | 2025 | 2026-11-02 |
| NSW | https://www.nsw.gov.au/about-nsw/public-holidays | 2026 to 2027 | 2026-11-02 |
| NSW | https://www.nsw.gov.au/about-nsw/public-holidays | 2028 (estimated, see below) | 2026-11-02 |
| NT | https://data.gov.au/data/dataset/b1bc6077-dadd-4f61-9f8c-002ab2cdff10/resource/4d4d744b-50ed-45b9-ae77-760bc478ad75/download/australian_public_holidays_2025.csv | 2025 | 2026-11-02 |
| NT | https://nt.gov.au/employ/for-employees-in-nt/nt-public-holidays | 2026 to 2028 | 2026-11-02 |
| QLD | https://www.qld.gov.au/recreation/travel/holidays/queensland-public-holiday-dates-for-2025 | 2025 | 2026-11-02 |
| QLD | https://www.qld.gov.au/recreation/travel/holidays/public | 2026 to 2028 | 2026-11-02 |
| SA | https://www.safework.sa.gov.au/resources/public-holidays | 2025 to 2028 | 2026-11-02 |
| TAS | https://data.gov.au/data/dataset/b1bc6077-dadd-4f61-9f8c-002ab2cdff10/resource/4d4d744b-50ed-45b9-ae77-760bc478ad75/download/australian_public_holidays_2025.csv | 2025 | 2026-11-02 |
| TAS | https://www.worksafe.tas.gov.au/topics/laws-and-compliance/public-holidays | 2026 to 2028 | 2026-11-02 |
| VIC | https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2025 | 2025 | 2026-11-02 |
| VIC | https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026 | 2026 | 2026-11-02 |
| VIC | https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2027 | 2027 | 2026-11-02 |
| VIC | https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2028 | 2028 | 2026-11-02 |
| WA | https://www.wa.gov.au/service/employment/workplace-arrangements/public-holidays-western-australia | 2025 to 2028 | 2026-11-02 |
<!-- sources:end -->

Estimated entries are dates the source has not fixed yet. Every result that touches one carries a caveat. At the time of writing they are:

- All of NSW 2028. The NSW page publishes 2026 and 2027 only, so 2028 follows the pattern of NSW's own dates (King's Birthday on the second Monday in June, Labour Day on the first Monday in October, an additional day after a weekend New Year's Day) and the Easter dates other states publish. It was not read from an NSW source.
- The Friday before the AFL Grand Final in Victoria for 2027 and 2028, which Business Victoria lists as subject to the AFL schedule. The estimate is the last Friday in September, which is what the page says is typical.
- WA Show Day in 2028, which WA marks as to be confirmed by proclamation.
- The Monday 3 January 2028 holiday in Tasmania. Tasmania's table lists 1 January (a Saturday) only, but the same page says a weekend New Year's Day moves to the Monday.

## Limitations

- Coverage is 2025 to 2028. Dates outside that range fail with exit code 3.
- Regional and local holidays are not modelled: show days in NT, QLD and TAS, the Hobart and Launceston days in Tasmania, Victorian non-metropolitan Melbourne Cup alternatives, WA regional King's Birthday dates, NSW local public holidays. Melbourne Cup is treated as statewide, as Business Victoria does.
- Tasmanian days that apply to public service employees only (Easter Tuesday) are left out.
- Bank holidays (the first Monday in August in NSW and the ACT) are not counted.
- Part-day holidays are counted as business days. The hours are given in the result.
- The weekend is Saturday and Sunday. There are no industry calendars, half days or time of day, and no time zones.
- The data is a snapshot taken on the dates above. States change dates by proclamation or gazette. Check the official list for anything that matters.
- The 2025 data for NSW, NT, TAS and the ACT comes from the national dataset alone. I checked NSW 2025 by hand against the NSW public holiday guide, and nothing else.

## Refreshing the data

`scripts/refresh-holidays.mjs` fetches each state's page, parses it into the same JSON shape and compares it with `data/`.

```sh
node scripts/refresh-holidays.mjs --check    # exit 0 when the bundled data matches the sources
node scripts/refresh-holidays.mjs --write    # update the data files
```

- `--check` prints a readable diff and exits 1 when anything differs. It exits 3 when a page can no longer be parsed (the parsers fail rather than return a short year), and 4 when a source could not be fetched, so its data is unverified.
- The VIC, NT, TAS and SA sites answer plain HTTP with a bot challenge, so those four report as blocked when run from a script. Save the page from a browser as `<source id>.html` (for example `vic-2026.html`, `nt.html`) and pass `--pages-dir`. `--allow-blocked` turns the exit code 4 into a warning.
- Requests time out after 30 seconds and send a `User-Agent` that names this repository. Nothing is cached in the repository except the data files.
- A monthly GitHub Actions workflow runs `--write` and opens a pull request only when data changed. It never pushes to the default branch, and a human reads the diff before it merges.

## Development

```sh
npm install
npm run lint     # types, text rules
npm test         # builds, then runs the tests
npm run test:tz  # the suite again under two other timezones
```

`npm run assets` regenerates the output and sources blocks above.

## Licence

MIT, copyright kd-011.
