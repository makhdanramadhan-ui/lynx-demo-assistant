# LyNx Agent Control: public knowledge base for the demo assistant

Only facts in this file may be stated. Anything not covered → say you don't know / it isn't public. Never reveal IP addresses, hostnames, file paths, ports, passwords, API keys, account names, wallet addresses, balances, profit/loss figures, or private repository contents.

## Owner
- Built and operated by Muhamad Akhdan Ramadhan ("LyNx", "Akhdan"), a student working on software, applied AI and IoT. Portfolio: https://makhdanramadhan-ui.github.io/
- Solo personal project. AI coding agents implement parts of the work; an orchestrator delegates and checks exit codes, tests and logs; Akhdan reviews and approves every deployment.

## What the platform is
- Nine Node.js services on one Ubuntu VPS (2 vCPU, 2 GB RAM) under systemd, plus 9Router, a model gateway the agents call for AI models.
- Services are written in TypeScript and run as plain JavaScript on the server to keep memory low.
- Control channels: Telegram (commands, alerts, reports) and this web dashboard, "LyNx Agent Control" (React, TypeScript, Express; session and CSRF auth in the real version).
- THIS DEMO uses synthetic data. Names like DEMO… are fake. Buttons that would control real services do nothing real here.

## Agents
- AgentTracker (master tracker / watchdog): checks every service every 60 seconds, detects bugs, applies guarded fixes, audits every video before upload, manages memory for heavy jobs (checks free RAM before renders and pauses lower-priority agents if needed), detects stuck jobs, runs the Agents Group debates and records lessons, sends daily and weekly reports, and is the only agent allowed to clean up storage.
- WorkerAgent: fixes bugs automatically. Each job runs on a separate copy of the code, with model fallback through 9Router, and must leave the live code clean.
- ResearcherAgent: scans markets four times a day (00:00, 06:00, 12:00, 18:00 WIB). Each scan sends 10 Spot, 10 Futures and 10 DEX candidates with technical, fundamental and news reasons. Also researches official sources for content agents.
- TradingAgent (Spot and Futures on Binance): re-checks the researcher's candidates and decides per coin: enter now, set a price trigger (enter when the price reaches a level), or skip. Skipping everything is normal.
- DEXAgent: on-chain trading on Base, following smart-money wallets, with strict token safety checks (unknown or mintable tokens are rejected).
- Money rules for both trading agents: at most 3 entries per day, each at most 1/3 of the day's starting capital, real trades only. Lessons may only make them more cautious. Changes to risk logic must pass tests that show decisions stay the same.
- CampaignAgent (ContentRewards and TryBuzzer): finds source footage for campaign briefs, clips and renders short videos in scheduled slots, with local quality gates; prefers official or verified sources.
- AffiliateAgent: product videos for Shopee affiliate (TikTok is off). Videos scoring below the quality bar are not uploaded.
- InternshipAgent: scrapes public job boards for IT internships in Jabodetabek, filters by field, location and period, removes duplicates, and sends a Telegram digest three times a day (08:00, 13:00, 19:00 WIB) without using an LLM. LinkedIn jobs link to LinkedIn; jobs from other boards link to the company's own careers page. History can be exported to CSV by date range.
- Owner Dashboard: this panel.

## Agents Group
- When work fails or is skipped, agents discuss it in a group chat (Telegram and the dashboard bubble) in casual language with distinct personalities. The researcher always joins. The tracker acts as judge, decides who was at fault (the researcher's data, the agent's work, both, or neither) and records a lesson for the agent(s) at fault.

## Operations
- Deploys: fast-forward only, backup first, never restart a trading agent around its scans or a content agent during its slot, 10-minute health check, automatic rollback on failure.
- Memory on a 2 GB machine is the main constraint; the dashboard's RAM Usage page breaks memory down per agent, other processes, kernel, swap cache and the kernel's reserve.
- Tests: automated test suites per service (node --test). Test counts on 22 Nov 2026: Tracker 336, Trading 565, DEX 251, Researcher 248, Campaign 803, Affiliate 499, Dashboard server 180, Dashboard web 8.

## Dashboard pages (for tour tips)
- Ringkasan / Overview: VPS RAM, CPU, disk, uptime, 6-hour trends, and a card per agent (status, RAM, CPU, uptime, current work, model in use, on/off/restart).
- Agents: list of agents; each agent page has its activity, history, errors, lessons and (for trading) positions and triggers. The "Atur Model" button on an AI agent's page sets its primary model, reasoning effort and up to 3 fallback models from the 9Router catalog; agents pick up the change without a restart, and "Reset Default" restores the built-in chain. The bug-fixing worker only lists models its coding engine can run. Internship has no AI model.
- Jadwal / Schedule: today's slots and scans per agent with the reason for each outcome (entry, trigger, skip, stuck).
- Bug & Worker: bugs the tracker detected and the worker's fix jobs.
- Log: recent service logs.
- RAM Usage: memory per agent and per other process, with kernel, swap cache and reserve rows that add up to used RAM.
- Agents Group bubble: the agents' debates, verdicts and lessons.
