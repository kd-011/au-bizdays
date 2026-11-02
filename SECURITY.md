# Security

au-bizdays does date arithmetic over data bundled with the package. At run time it makes no network requests, runs no other programs, and reads only its own `data/` files. The MCP server is read-only.

## Reporting a problem

If you find a security problem, for example a way to make the CLI or the MCP server read outside `data/`, make a network request, run a command, or hang or crash on crafted input, use GitHub's private vulnerability reporting on this repository (the Security tab), not a public issue.

A wrong holiday date is not a security problem. Open an issue and link the official page that shows the right date.

## The refresh script

`scripts/refresh-holidays.mjs` is a maintenance tool and is not part of the published package. It fetches the government pages listed in the README with a 30 second timeout and writes only to `data/`. The monthly workflow gives it a token that can open pull requests and cannot push to the default branch.
