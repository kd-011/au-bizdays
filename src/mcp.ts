#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { VERSION } from './version.js';

const HELP = `au-bizdays-mcp ${VERSION}
An MCP server for business-day and deadline arithmetic in Australian states and territories.
It speaks MCP over stdio: start it from an MCP client, not by hand.

Tools: add_business_days, add_calendar_days, business_days_between, is_business_day,
next_business_day, previous_business_day, roll_to_business_day, list_holidays.
Read-only. No network access and no files read other than the bundled holiday data.`;

const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
  process.stdout.write(`${HELP}\n`);
} else if (argv.includes('-v') || argv.includes('--version')) {
  process.stdout.write(`${VERSION}\n`);
} else {
  // stdout is the protocol channel, so status goes to stderr.
  createServer()
    .connect(new StdioServerTransport())
    .then(() => process.stderr.write(`au-bizdays-mcp ${VERSION} ready\n`))
    .catch((e: unknown) => {
      process.stderr.write(`au-bizdays-mcp: ${e instanceof Error ? e.message : 'failed to start'}\n`);
      process.exit(1);
    });
}
