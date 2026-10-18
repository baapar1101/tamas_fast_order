#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

const API_BASE = 'https://jules.googleapis.com/v1alpha';
const TERMINAL_STATES = new Set(['COMPLETED', 'FAILED', 'PAUSED', 'AWAITING_PLAN_APPROVAL', 'AWAITING_USER_FEEDBACK']);

loadLocalEnv();

function loadLocalEnv() {
  for (const filename of ['.env.local', '.env']) {
    if (!existsSync(filename)) continue;
    for (const line of readFileSync(filename, 'utf8').split(/\r?\n/u)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);
      if (!match) continue;
      const [, key, rawValue = ''] = match;
      if (process.env[key] !== undefined) continue;
      let value = rawValue.trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      } else {
        value = value.replace(/\s+#.*$/u, '');
      }
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const equalsIndex = token.indexOf('=');
    if (equalsIndex !== -1) {
      flags[token.slice(2, equalsIndex)] = token.slice(equalsIndex + 1);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }

  return { positional, flags };
}

function numberFlag(flags, name, fallback, { min, max }) {
  const value = flags[name] === undefined ? fallback : Number(flags[name]);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`--${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function resourceName(kind, value) {
  if (!value) throw new Error(`Missing ${kind} id.`);
  return value.startsWith(`${kind}/`) ? value : `${kind}/${value}`;
}

function inferSource() {
  if (process.env.JULES_SOURCE) return process.env.JULES_SOURCE;

  try {
    const remote = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const match = remote.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/iu);
    if (match) return `sources/github/${match[1]}/${match[2]}`;
  } catch {
    // The explicit --source error below tells the user what to do.
  }

  throw new Error('Could not infer a GitHub source. Pass --source or set JULES_SOURCE.');
}

async function api(path, { method = 'GET', body, query } = {}) {
  const apiKey = process.env.JULES_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('JULES_API_KEY is missing. Put it in .env.local or export it in your shell.');
  }

  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method,
    headers: {
      'X-Goog-Api-Key': apiKey,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data?.error?.message ? data.error.message : text || response.statusText;
    throw new Error(`Jules API returned HTTP ${response.status}: ${message}`);
  }

  return data;
}

function print(value, json) {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  console.log(value);
}

function printSources(data, json) {
  if (json) return print(data, true);
  const rows = (data?.sources ?? []).map((source) => ({
    name: source.name,
    repository: source.githubRepo ? `${source.githubRepo.owner}/${source.githubRepo.repo}` : source.id,
  }));
  console.table(rows);
  if (data?.nextPageToken) console.log(`Next page token: ${data.nextPageToken}`);
}

function printSessions(data, json) {
  if (json) return print(data, true);
  const rows = (data?.sessions ?? []).map((session) => ({
    id: session.id,
    state: session.state ?? '',
    title: session.title ?? '',
    updated: session.updateTime ?? session.createTime ?? '',
    pullRequest: session.outputs?.find((output) => output.pullRequest)?.pullRequest?.url ?? '',
  }));
  console.table(rows);
  if (data?.nextPageToken) console.log(`Next page token: ${data.nextPageToken}`);
}

function activitySummary(activity) {
  if (activity.agentMessaged) return activity.agentMessaged.agentMessage;
  if (activity.userMessaged) return activity.userMessaged.userMessage;
  if (activity.planGenerated) return activity.planGenerated.plan?.steps?.map((step) => `${step.index + 1}. ${step.title}`).join('\n');
  if (activity.planApproved) return `Plan approved: ${activity.planApproved.planId}`;
  if (activity.progressUpdated) return [activity.progressUpdated.title, activity.progressUpdated.description].filter(Boolean).join(' — ');
  if (activity.sessionCompleted) return 'Session completed.';
  if (activity.sessionFailed) return `Session failed: ${activity.sessionFailed.reason ?? 'Unknown reason'}`;
  return activity.description ?? '';
}

function printActivities(data, json) {
  if (json) return print(data, true);
  for (const activity of data?.activities ?? []) {
    const timestamp = activity.createTime ? `[${activity.createTime}] ` : '';
    const originator = activity.originator ? `${activity.originator}: ` : '';
    console.log(`${timestamp}${originator}${activitySummary(activity)}`);
  }
  if (data?.nextPageToken) console.log(`Next page token: ${data.nextPageToken}`);
}

function promptFrom(flags) {
  if (typeof flags.prompt === 'string' && flags.prompt.trim()) return flags.prompt.trim();
  if (typeof flags['prompt-file'] === 'string') return readFileSync(flags['prompt-file'], 'utf8').trim();
  throw new Error('Pass --prompt "..." or --prompt-file <path>.');
}

function help() {
  console.log(`Jules project CLI

Usage:
  npm run jules -- sources [--page-size 100] [--page-token TOKEN] [--json]
  npm run jules -- sessions [--page-size 30] [--page-token TOKEN] [--json]
  npm run jules -- get <session-id> [--json]
  npm run jules -- activities <session-id> [--page-size 50] [--page-token TOKEN] [--json]
  npm run jules -- create --prompt "task" [--title "title"] [--branch dev] [--source NAME]
                         [--auto-pr] [--require-approval] [--json]
  npm run jules -- message <session-id> --prompt "follow-up"
  npm run jules -- approve <session-id>
  npm run jules -- watch <session-id> [--interval 10] [--timeout 900] [--json]

Configuration:
  JULES_API_KEY   Required. Keep it in the ignored .env.local file.
  JULES_SOURCE    Optional. Defaults to the current GitHub origin.
  JULES_BRANCH    Optional. Defaults to the current branch, then "main".

Creating a session does not create a pull request unless --auto-pr is supplied.`);
}

async function currentBranch() {
  if (process.env.JULES_BRANCH) return process.env.JULES_BRANCH;
  try {
    return execFileSync('git', ['branch', '--show-current'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || 'main';
  } catch {
    return 'main';
  }
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command = 'help', id] = positional;
  const json = flags.json === true;

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      help();
      return;
    case 'sources': {
      const data = await api('/sources', {
        query: {
          pageSize: numberFlag(flags, 'page-size', 100, { min: 1, max: 100 }),
          pageToken: flags['page-token'],
          filter: flags.filter,
        },
      });
      printSources(data, json);
      return;
    }
    case 'sessions': {
      const data = await api('/sessions', {
        query: {
          pageSize: numberFlag(flags, 'page-size', 30, { min: 1, max: 100 }),
          pageToken: flags['page-token'],
        },
      });
      printSessions(data, json);
      return;
    }
    case 'get': {
      const session = resourceName('sessions', id);
      print(await api(`/${session}`), json);
      return;
    }
    case 'activities': {
      const session = resourceName('sessions', id);
      const data = await api(`/${session}/activities`, {
        query: {
          pageSize: numberFlag(flags, 'page-size', 50, { min: 1, max: 100 }),
          pageToken: flags['page-token'],
        },
      });
      printActivities(data, json);
      return;
    }
    case 'create': {
      const source = typeof flags.source === 'string' ? flags.source : inferSource();
      const branch = typeof flags.branch === 'string' ? flags.branch : await currentBranch();
      const body = {
        prompt: promptFrom(flags),
        sourceContext: {
          source,
          githubRepoContext: { startingBranch: branch },
        },
        ...(typeof flags.title === 'string' ? { title: flags.title } : {}),
        ...(flags['require-approval'] === true ? { requirePlanApproval: true } : {}),
        ...(flags['auto-pr'] === true ? { automationMode: 'AUTO_CREATE_PR' } : {}),
      };
      const session = await api('/sessions', { method: 'POST', body });
      print(session, json);
      return;
    }
    case 'message': {
      const session = resourceName('sessions', id);
      await api(`/${session}:sendMessage`, { method: 'POST', body: { prompt: promptFrom(flags) } });
      print(`Message sent to ${session}.`, json);
      return;
    }
    case 'approve': {
      const session = resourceName('sessions', id);
      await api(`/${session}:approvePlan`, { method: 'POST', body: {} });
      print(`Approved the latest plan in ${session}.`, json);
      return;
    }
    case 'watch': {
      const session = resourceName('sessions', id);
      const intervalSeconds = numberFlag(flags, 'interval', 10, { min: 2, max: 300 });
      const timeoutSeconds = numberFlag(flags, 'timeout', 900, { min: 2, max: 86_400 });
      const deadline = Date.now() + timeoutSeconds * 1000;

      while (true) {
        const value = await api(`/${session}`);
        if (!json) console.log(`${new Date().toISOString()}  ${value.state ?? 'STATE_UNSPECIFIED'}`);
        if (TERMINAL_STATES.has(value.state) || Date.now() >= deadline) {
          print(value, json);
          if (!TERMINAL_STATES.has(value.state)) process.exitCode = 2;
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
      }
    }
    default:
      throw new Error(`Unknown command: ${command}. Run "npm run jules -- help".`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Jules CLI error: ${message}`);
  process.exitCode = 1;
});
