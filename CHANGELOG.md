# Changelog

All notable changes to this project are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/).

## [0.1.0] - Unreleased

First version, not yet published.

### Added
- `au-bizdays` command line tool: `add`, `diff`, `is`, `next`, `prev`, `roll`, `add-calendar` and `holidays`, for ACT, NSW, NT, QLD, SA, TAS, VIC and WA. `--json` output with the documented `au-bizdays/v1` schema. Exit codes 0 ok, 2 usage error, 3 date outside the bundled data.
- `au-bizdays-mcp`, a read-only MCP server over stdio with eight tools mirroring the commands.
- Public holidays for 2025 to 2028 for every state, each year file recording its official source URL and retrieval date, and each entry marked confirmed or estimated.
- Caveats on every result: the business-day definition, regional holidays not counted, estimated and part-day holidays the answer touched, and a warning when today is within 60 days of the end of the data.
- `scripts/refresh-holidays.mjs` to compare the bundled data with the official pages (`--check`) or update it (`--write`), and a monthly workflow that opens a pull request when the data changed.
