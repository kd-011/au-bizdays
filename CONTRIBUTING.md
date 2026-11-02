# Contributing

Reports of a wrong or missing holiday help most. Use the issue template and link the official government page that shows the date. A date from a blog, a calculator or memory is not enough.

## Ground rules

- Holiday data comes from official government pages. Every date in `data/` and every expected value in a test is read from the source, with the URL and retrieval date recorded in the file.
- Never guess a holiday. A date outside the bundled data is an error, and anything the sources have not fixed is marked `estimated` and surfaces as a caveat.
- Change the data with `node scripts/refresh-holidays.mjs --write`, not by hand, unless a year is not published anywhere yet. Then add it as `estimated` with an `estimate_basis` that says where it came from.
- The package stays read-only and offline at run time. The only runtime dependencies are the MCP SDK and zod.
- Dates are calendar dates (`YYYY-MM-DD`) and never timestamps. Nothing may depend on the machine's timezone.
- Write plain English. No em dashes, no marketing words.

## Before you open a pull request

```sh
npm ci
npm run lint
npm test
npm run test:tz
```

If command output changes, run `npm run assets` and commit the refreshed README blocks. If a test expectation changes, say why in the pull request.

By contributing you agree your work is released under the MIT licence.
