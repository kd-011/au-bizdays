---
slug: au-bizdays-brand
name: au-bizdays brand
repo: .
status: active
last_verified: 2026-11-22
needs_review: true
---

# au-bizdays: brand

Who the project speaks as. There is no UI or website, so this is how the README, the CLI output and the MCP tool text talk. Drafted only from copy already shipped, every line cited; the operator owns it and clears needs_review once checked.

## Name and casing

- `au-bizdays`, all lower case with a hyphen, in the README title, the package name, both binaries (`au-bizdays`, `au-bizdays-mcp`) and the social preview. <!-- src: README.md, package.json#name, package.json#bin, .github/social-preview.png -->
- The MCP Registry title is "AU Business Days" and the registry name is `io.github.kd-011/au-bizdays`. <!-- src: server.json -->
- State codes are written upper case (ACT, NSW, NT, QLD, SA, TAS, VIC, WA). <!-- src: src/data.ts:5, docs/commands.md -->

## One-liner

"Business-day and deadline maths for Australian states and territories, as a command line tool and an MCP server."

## Audience

People and agents working out notice periods, payment terms and statutory deadlines in an Australian state, from a terminal or an MCP client.

## Is and is not

- Is: a CLI and a read-only, offline MCP server for business-day arithmetic, one state at a time, from official holiday lists for 2025 to 2028.
- Is: explicit about its assumptions, with every answer carrying the definition it used and any estimated or part-day holiday it touched.
- Is not: legal advice, or a substitute for a business-day definition written into a contract, legislation or court rules.
- Is not: a library for other countries or years after 2028, or a source of regional, local or bank holidays.

## Voice

Plain, exact, cautious. Do: say what the tool will not do and send people elsewhere when another tool fits; give the source and retrieval date; refuse rather than guess. Do not: claim novelty, sell, or round off a caveat. Banned: em dashes, marketing words, "first", "only", "unique" or "novel" about the tool.

## Copy bank

- README opening: "Business-day and deadline maths for Australian states and territories, as a command line tool and an MCP server. Notice periods, payment terms and statutory deadlines are the usual uses." <!-- src: README.md -->
- Package description: "Business-day and deadline arithmetic for Australian states and territories, with per-state public holidays. A CLI and a read-only MCP server." <!-- src: package.json#description -->
- Registry description: "Business-day and deadline maths for Australian states, with per-state public holidays." <!-- src: server.json -->
- Social preview text: "Business days and deadlines for every Australian state." <!-- src: .github/social-preview.png -->
- Call to action: the README's "Try it" section, one `npx github:kd-011/au-bizdays ...` line. <!-- src: README.md -->
- Footer on every human answer: "Business day = Monday to Friday, excluding WA statewide public holidays. Not legal advice; your contract or the law may differ." <!-- src: src/render.ts:12-13 -->
- Refusal tone, outside the data: "The answer would depend on holidays that are not in the data, so none is given." <!-- src: src/calendar.ts:55-56 -->
- Usage errors name the fix: "A state is required: one of ACT, NSW, NT, QLD, SA, TAS, VIC, WA." and "Unknown command ... Run au-bizdays --help." <!-- src: src/commands.ts:44-49, src/cli.ts:173 -->
- Unexpected MCP errors: "Unexpected error. Nothing was changed; this server only reads its bundled data." <!-- src: src/server.ts:48 -->
- Writing rules for contributors: "Write plain English. No em dashes, no marketing words." <!-- src: CONTRIBUTING.md -->

## Assets

- Social preview image (GitHub's OG card): `.github/social-preview.png`. <!-- src: .github/social-preview.png -->
- No logo or favicon: the project has no website. <!-- src: package.json#homepage -->

## Contact and legal

- MIT licence, copyright 2026 kd-011. <!-- src: LICENSE, README.md -->
- Bugs, feature requests and wrong holidays go through GitHub issue templates; blank issues are off. <!-- src: .github/ISSUE_TEMPLATE/config.yml, .github/ISSUE_TEMPLATE/wrong-holiday.yml -->
- Security problems go to GitHub private vulnerability reporting, not a public issue. <!-- src: SECURITY.md -->
- No privacy or terms pages: there is no website and the tool collects nothing. No email contact is published. <!-- src: SECURITY.md, package.json#bugs -->

## Unverified

- The three voice adjectives and the banned-word list are inferred from CONTRIBUTING.md and the README tests, not stated as brand rules.
- Whether "AU Business Days" is an accepted display name or only the registry title.
- The social preview shows `npx au-bizdays add 10 --state WA`, which does not run yet (the package is not on npm and `--from` is required). Whether that card is meant to wait for the npm release is the operator's call.
- The one-liner, audience and is and is not are drafted from the README; the operator has not confirmed them.
