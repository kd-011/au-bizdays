# Commands, JSON output and MCP tools

Every command needs `--state` (ACT, NSW, NT, QLD, SA, TAS, VIC or WA, in any case). There is no default, because the answer depends on it. Add `--json` for machine output. Dates are `YYYY-MM-DD`, or the word `today`.

`today` is the date on the clock of the state's capital (Perth for WA, Darwin for NT, Brisbane for QLD, Adelaide for SA, Hobart for TAS, Melbourne for VIC, Sydney for NSW and the ACT), whatever timezone the machine is in. The output always shows the date it used. `AU_BIZDAYS_TODAY=2026-11-02` fixes it for every state, and `AU_BIZDAYS_NOW=2026-11-02T14:00:00Z` fixes the instant, which is what the tests use.

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

## Real output

Generated from the code (a test fails if this block goes stale). The `add 3 --from today` line ran with the clock fixed at 2026-11-02.

<!-- demo-full:start -->
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

$ au-bizdays add 3 --from today --state VIC
3 business days after 2026-11-02 in VIC is Friday 2026-11-06.
Skipped holidays: 2026-11-03 Melbourne Cup.
Business day = Monday to Friday, excluding VIC statewide public holidays. Not legal advice; your contract or the law may differ.

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
<!-- demo-full:end -->

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

- `input` echoes the arguments as understood, with `today` already turned into a date. `state` is the upper-case code.
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

Output is deterministic for a given date. Dates are calendar dates, not timestamps, so the machine's timezone makes no difference. The one exception is the word `today`, which reads the clock.

## MCP server

`au-bizdays-mcp` speaks MCP over stdio. It is read-only, makes no network requests, and reads nothing except the bundled data files. Each tool takes the same arguments as its command (a date can be `today` there too), returns the JSON above as structured content, and adds a one-line summary as text. Errors come back as tool errors with the same message the CLI prints.

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

`server.json` is the manifest for the MCP registry. It has not been submitted, because the package is not on npm yet.
