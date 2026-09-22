# Welcome to CDISC Library MCP Server

## How We Use Claude

Based on pendingintent's usage over the last 30 days:

Work Type Breakdown:
  Build Feature   █████████████████░░░  60%
  Debug Fix       ██████░░░░░░░░░░░░░░  20%
  Plan Design     ██████░░░░░░░░░░░░░░  20%

Top Skills & Commands:
  /exit           ████████████████████  3x/month
  /init           ███████░░░░░░░░░░░░░  1x/month
  /code-reviewer  ███████░░░░░░░░░░░░░  1x/month

Top MCP Servers:
  cdisc-library   ████████████████████  5 calls

## Your Setup Checklist

### Codebases
- [ ] cdisc-library-mcp-server — https://github.com/pendingintent/cdisc-library-mcp-server

### MCP Servers to Activate
- [ ] cdisc-library — exposes the CDISC Library API (SDTM/ADaM/CDASH standards, Controlled Terminology, Biomedical Concepts) as MCP tools (`cdisc_get`, `search_biomedical_concepts`, `get_ct_package`, etc.). Needs a `CDISC_API_KEY` from your library.cdisc.org account settings, set via `.env` or the environment; the server is already registered for this repo in `.mcp.json`.

### Skills to Know About
- [ ] /code-reviewer — reviews changed files on the current branch for security issues, logic errors, and performance problems, organized by severity (Critical/Warning/Suggestion) with fixes. Run it before opening or merging a PR.
- [ ] /init — bootstraps a project's `CLAUDE.md` from the codebase. Mostly a one-time setup step, good to know about if you ever start a new repo.

## Team Tips

_TODO_

## Get Started

_TODO_

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
