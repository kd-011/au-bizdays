# au-bizdays

Business-day and deadline maths for Australian states and territories, as a command line tool and an MCP server. Notice periods, payment terms and statutory deadlines are the usual uses.

<!-- demo:start -->
```console
$ au-bizdays add 10 --from 2026-12-18 --state WA
10 business days after 2026-12-18 in WA is Wednesday 2027-01-06.
Skipped holidays: 2026-12-25 Christmas Day, 2026-12-28 Boxing Day (additional day), 2027-01-01 New Year's Day.
Business day = Monday to Friday, excluding WA statewide public holidays. Not legal advice; your contract or the law may differ.

$ au-bizdays is 2026-12-28 --state VIC
Monday 2026-12-28 is not a business day in VIC: Boxing Day (additional day).
Business day = Monday to Friday, excluding VIC statewide public holidays. Not legal advice; your contract or the law may differ.

$ au-bizdays add-calendar 14 --from 2026-12-14 --roll forward --state WA
14 calendar days after 2026-12-14 in WA is Monday 2026-12-28, which is not a business day, so rolled forward to Tuesday 2026-12-29.
Business day = Monday to Friday, excluding WA statewide public holidays. Not legal advice; your contract or the law may differ.

$ au-bizdays add 1 --from 2028-12-29 --state WA
au-bizdays: 2029-01-01 is outside the holiday data bundled for WA (2025-01-01 to 2028-12-31). The answer would depend on holidays that are not in the data, so none is given.
(exit 3)
```
<!-- demo:end -->

`add` lists the holidays it skipped, `holidays` prints the state page and the date it was read, and `--json` carries the source URL for every covered year in `assumptions.data_source`. A date outside the bundled data (2025 to 2028) is an error.

## Try it

```sh
npx github:kd-011/au-bizdays add 10 --from 2026-12-18 --state WA
```

Node 18 or newer. The package is not on npm yet, so `npx` fetches it from GitHub and builds it on the first run. That took 10 to 25 seconds from a cold npm cache in most of my runs (one took 83), and a second or two after. To keep a copy:

```sh
git clone https://github.com/kd-011/au-bizdays.git
cd au-bizdays
npm install     # also builds dist/
node dist/cli.js add 10 --from 2026-12-18 --state WA
```

`--from today` and `is today` work too. Today is the date on the state's own clock, wherever the machine is.

## Use it from an agent

`au-bizdays-mcp` is a read-only stdio MCP server with eight tools. It makes no network requests. In a client that takes JSON config:

```json
{
  "mcpServers": {
    "au-bizdays": { "command": "npx", "args": ["-y", "-p", "github:kd-011/au-bizdays", "au-bizdays-mcp"] }
  }
}
```

The tools mirror the commands and return the same JSON. They are listed in [docs/commands.md](docs/commands.md).

## What counts as a business day

Monday to Friday and not a statewide public holiday in the state you name. The state is required, because the answer depends on it.

- Part-day holidays (Christmas Eve and New Year's Eve in SA and NT, Christmas Eve in QLD) count as ordinary business days. Results that touch one say so.
- Regional and local holidays (show days, the Hobart Regatta, local event days) are not in the data. Bank holidays are not counted either.
- Legislation, court rules or a contract may define business days differently, for example by excluding other days, counting bank days, or saying how to treat the day of service. This is not legal advice, and your own definition wins.

## When not to use it

- You need a date after 2028, or a country other than Australia.
- Your deadline depends on a regional or local holiday, a bank holiday, or a definition of business day written into a contract or a court rule.
- You want a library to import. Python's [holidays](https://pypi.org/project/holidays/) and npm's [date-holidays](https://www.npmjs.com/package/date-holidays) both have Australian state calendars for many more years. I compared both with the official state lists for the next 12 months in November 2026. They agreed with the official dates except for the Friday before the AFL Grand Final in Victoria in 2027, where both have 24 September and the AFL's announced Grand Final date points to 1 October. `holidays` also treats the Brisbane-only Royal Queensland Show as a Queensland holiday, and `date-holidays` counts the part-day Christmas Eve and New Year's Eve in NT, QLD and SA as full holidays.
- You want an MCP server for other countries. [@qinisolabs/bizdays](https://www.npmjs.com/package/@qinisolabs/bizdays) 0.2.2 takes a country code only, so for `AU` it does not know Melbourne Cup. It calls 2026-11-03 a business day, which it is not in Victoria. [business-day-mcp](https://pypi.org/project/business-day-mcp/) 0.1.0 takes a state code through python `holidays`, and has no tool for adding n business days.

## How current the data is

The files were read from the state pages on 2026-11-02. In November 2026 I checked every state's next 12 months again against the official pages (live for ACT, NSW, QLD and WA, Internet Archive copies for NT, SA, TAS and VIC, which block scripts) and found two Tasmanian errors and one Victorian date that had moved. The monthly refresh job has not run yet and cannot read the NT, SA, TAS or VIC pages. [docs/data.md](docs/data.md) has the sources, the method and what is estimated.

## More

- [docs/commands.md](docs/commands.md): every command, the JSON schema, the MCP tools.
- [docs/data.md](docs/data.md): sources, how the data was checked, estimated dates, what is left out, refreshing.
- [CHANGELOG.md](CHANGELOG.md), [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md).

Development: `npm install`, then `npm run lint`, `npm test` and `npm run test:tz`. `npm run assets` regenerates the output blocks in the README and docs.

MIT licence, copyright kd-011.
