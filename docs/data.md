# Holiday data

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

## How fresh it is, and how it was checked

The files were retrieved on 2026-11-02. In November 2026 every state's holidays from 3 November 2026 to 2 November 2027 were checked again against the state's own page, and against the Fair Work Ombudsman's [2026](https://www.fairwork.gov.au/employment-conditions/public-holidays/2026-public-holidays) and [2027](https://www.fairwork.gov.au/employment-conditions/public-holidays/2027-public-holidays) lists, which are built from the state lists. A script compared the bundled dates with the Fair Work lists for 2026 and 2027, and a person read the differences.

| State | Official page | How it was read | Result |
| --- | --- | --- | --- |
| ACT | [act.gov.au](https://www.act.gov.au/living-in-the-act/public-holidays-school-terms-and-daylight-saving) | Live page | Matched |
| NSW | [nsw.gov.au](https://www.nsw.gov.au/about-nsw/public-holidays) | Live page | Matched |
| QLD | [qld.gov.au](https://www.qld.gov.au/recreation/travel/holidays/public) | Live page | Matched |
| WA | [wa.gov.au](https://www.wa.gov.au/service/employment/workplace-arrangements/public-holidays-western-australia) | Live page | Matched |
| NT | [nt.gov.au](https://nt.gov.au/nt-public-holidays) | [Internet Archive copy of 2026-10-08](https://web.archive.org/web/20261008055825/https://nt.gov.au/nt-public-holidays) | Matched |
| SA | [safework.sa.gov.au](https://www.safework.sa.gov.au/resources/public-holidays) | [Internet Archive copy of 2026-07-16](http://web.archive.org/web/20260716011718/https://safework.sa.gov.au/resources/public-holidays) | Matched |
| TAS | [worksafe.tas.gov.au](https://www.worksafe.tas.gov.au/topics/laws-and-compliance/public-holidays) | [Internet Archive copy of 2026-10-13](http://web.archive.org/web/20261013055738/https://worksafe.tas.gov.au/topics/laws-and-compliance/public-holidays) | Two corrections, below |
| VIC | [business.vic.gov.au](https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2027) | Internet Archive copies of the [2026](http://web.archive.org/web/20261013055738/https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2026) (2026-10-13) and [2027](http://web.archive.org/web/20260426055047/https://business.vic.gov.au/business-information/public-holidays/victorian-public-holidays-2027) (2026-04-26) pages | One correction, below |

The NT, SA, TAS and VIC sites turn away scripts, so the copies are the Internet Archive's, not the live pages. They are weeks or months old. A state that changed a date since then is not caught.

What the check found, and what changed:

- Tasmania: the data had Easter Sunday for 2027 and 2028. Tasmania's table has no Easter Sunday for 2026, 2027 or 2028, and neither does the Fair Work list. Removed. It was a Sunday, so no business-day answer changes. Tasmania's rule that Christmas Day on a Saturday makes both the Saturday and the Monday holidays was missing for 2027, so Saturday 25 December 2027 is now listed.
- Victoria: the Friday before the AFL Grand Final in 2027 was estimated as 24 September, the last Friday in September. The AFL has since set the 2027 Grand Final for [Saturday 2 October](https://www.afl.com.au/news/1589266/dates-for-2027-afl-season-confirmed-afl-makes-call-on-opening-round-grand-final-to-be-played-on-october-3-in-2027), so the estimate is now Friday 1 October. Business Victoria still says "subject to AFL schedule" (2026-04-26 copy), and the holiday has not been gazetted. It stays `estimated`, and any result that touches it says so.

Not rechecked by hand: 2025 and 2028. The refresh script compares 2025 to 2028 for the states it can fetch (ACT, NSW, QLD, WA, plus the national dataset for 2025), and in that check it reported no differences.

## Estimated entries

Estimated entries are dates the source has not fixed yet. Every result that touches one carries a caveat. At the time of writing they are:

- All of NSW 2028. The NSW page publishes 2026 and 2027 only, so 2028 follows the pattern of NSW's own dates (King's Birthday on the second Monday in June, Labour Day on the first Monday in October, an additional day after a weekend New Year's Day) and the Easter dates other states publish. It was not read from an NSW source.
- The Friday before the AFL Grand Final in Victoria for 2027 (1 October, from the AFL's announced Grand Final date) and 2028 (the last Friday in September, which Business Victoria says is typical).
- WA Show Day in 2028, which WA marks as to be confirmed by proclamation.
- The Monday 3 January 2028 holiday in Tasmania. Tasmania's table lists 1 January (a Saturday) only, but the same page says a weekend New Year's Day moves to the Monday.

## What is left out

- Regional and local holidays: show days in NT, QLD and TAS, the Hobart and Launceston days in Tasmania, Victorian non-metropolitan Melbourne Cup alternatives, WA regional King's Birthday dates, NSW local public holidays. Melbourne Cup is treated as statewide, as Business Victoria does.
- Tasmanian days that apply to public service employees only (Easter Tuesday).
- Bank holidays (the first Monday in August in NSW and the ACT).
- Part-day holidays (Christmas Eve and New Year's Eve in SA and NT, Christmas Eve in QLD) count as business days. The hours are given in the result.
- The weekend is Saturday and Sunday. There are no industry calendars, half days or time of day.
- Coverage is 2025 to 2028. Dates outside that range fail with exit code 3.
- The data is a snapshot. States change dates by proclamation or gazette. Check the official list for anything that matters.
- The 2025 data for NSW, NT, TAS and the ACT comes from the national dataset alone. NSW 2025 was also checked by hand against the NSW public holiday guide, and nothing else for 2025 was.

## Refreshing the data

`scripts/refresh-holidays.mjs` fetches each state's page, parses it into the same JSON shape and compares it with `data/`.

```sh
node scripts/refresh-holidays.mjs --check    # exit 0 when the bundled data matches the sources
node scripts/refresh-holidays.mjs --write    # update the data files
```

- `--check` prints a readable diff and exits 1 when anything differs. It exits 3 when a page can no longer be parsed (the parsers fail rather than return a short year), and 4 when a source could not be fetched, so its data is unverified.
- The VIC, NT, TAS and SA sites answer plain HTTP with a bot challenge, so those four report as blocked when run from a script. Save the page from a browser as `<source id>.html` (for example `vic-2026.html`, `nt.html`) and pass `--pages-dir`. `--allow-blocked` turns the exit code 4 into a warning.
- Requests time out after 30 seconds and send a `User-Agent` that names this repository. Nothing is cached in the repository except the data files.
- A monthly GitHub Actions workflow runs `--write` and opens a pull request only when data changed. It never pushes to the default branch, and a human reads the diff before it merges. Its first scheduled run is 2026-12-01. Because four of the eight state sites are blocked from a runner, it can check ACT, NSW, QLD and WA each month and cannot check the other four. Those four need the saved-page route above.
- The AFL Grand Final dates the VIC parser relies on are in `AFL_GRAND_FINAL` in `scripts/lib/parse.mjs`. Add the year there when the AFL announces it, or the refresh will put the Friday back to the last Friday in September.
