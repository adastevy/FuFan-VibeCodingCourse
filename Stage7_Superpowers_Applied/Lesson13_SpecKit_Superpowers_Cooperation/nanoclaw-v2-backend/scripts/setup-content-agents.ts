/**
 * scripts/setup-content-agents.ts
 *
 * Idempotently registers the 5 content-generation agent_groups and their
 * 8 bidirectional agent_destinations ACL rows in data/v2.db.
 *
 * Usage:
 *   pnpm exec tsx scripts/setup-content-agents.ts [--dry-run]
 *
 * --dry-run  Print what would be created without touching the DB.
 *
 * After a real run, verify with:
 *   pnpm exec tsx scripts/q.ts data/v2.db \
 *     "SELECT name FROM agent_groups WHERE id LIKE 'content-%' OR id LIKE '%-writer'"
 *   pnpm exec tsx scripts/q.ts data/v2.db \
 *     "SELECT COUNT(*) FROM agent_destinations WHERE agent_group_id IN \
 *      ('content-coordinator','content-researcher','xiaohongshu-writer','gongzhonghao-writer','weibo-writer')"
 */
import path from 'path';

import { DATA_DIR } from '../src/config.js';
import { initDb } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrations/index.js';

const isDryRun = process.argv.includes('--dry-run');
const dbPath = path.join(DATA_DIR, 'v2.db');

// ── Agent group definitions ──────────────────────────────────────────────────

interface AgentGroupRow {
  id: string;
  name: string;
  folder: string;
  agent_provider: string;
  created_at: string;
}

interface AclRow {
  agent_group_id: string;
  local_name: string;
  target_type: string;
  target_id: string;
  created_at: string;
}

const AGENT_GROUPS: Omit<AgentGroupRow, 'created_at'>[] = [
  { id: 'content-coordinator', name: 'Content Coordinator', folder: 'content-coordinator', agent_provider: 'claude' },
  { id: 'content-researcher', name: 'Content Researcher', folder: 'content-researcher', agent_provider: 'claude' },
  { id: 'xiaohongshu-writer', name: 'Xiaohongshu Writer', folder: 'xiaohongshu-writer', agent_provider: 'claude' },
  { id: 'gongzhonghao-writer', name: 'Gongzhonghao Writer', folder: 'gongzhonghao-writer', agent_provider: 'claude' },
  { id: 'weibo-writer', name: 'Weibo Writer', folder: 'weibo-writer', agent_provider: 'claude' },
];

// ── ACL matrix — 8 bidirectional rows (plan.md §7) ───────────────────────────
// coordinator → each worker (4 rows)
// each worker → coordinator as "parent" (4 rows)

const ACL_ROWS: Omit<AclRow, 'created_at'>[] = [
  { agent_group_id: 'content-coordinator', local_name: 'researcher',   target_type: 'agent', target_id: 'content-researcher' },
  { agent_group_id: 'content-coordinator', local_name: 'xhs-writer',   target_type: 'agent', target_id: 'xiaohongshu-writer' },
  { agent_group_id: 'content-coordinator', local_name: 'gzh-writer',   target_type: 'agent', target_id: 'gongzhonghao-writer' },
  { agent_group_id: 'content-coordinator', local_name: 'weibo-writer', target_type: 'agent', target_id: 'weibo-writer' },
  { agent_group_id: 'content-researcher',  local_name: 'parent',       target_type: 'agent', target_id: 'content-coordinator' },
  { agent_group_id: 'xiaohongshu-writer',  local_name: 'parent',       target_type: 'agent', target_id: 'content-coordinator' },
  { agent_group_id: 'gongzhonghao-writer', local_name: 'parent',       target_type: 'agent', target_id: 'content-coordinator' },
  { agent_group_id: 'weibo-writer',        local_name: 'parent',       target_type: 'agent', target_id: 'content-coordinator' },
];

// ── Dry-run mode ─────────────────────────────────────────────────────────────

if (isDryRun) {
  console.log('DRY RUN — no DB changes will be made.\n');
  console.log(`Would create ${AGENT_GROUPS.length} agent_groups:`);
  for (const ag of AGENT_GROUPS) {
    console.log(`  id=${ag.id}  folder=${ag.folder}  provider=${ag.agent_provider}`);
  }
  console.log('');
  console.log(`Would create ${ACL_ROWS.length} agent_destinations (ACL rows):`);
  for (const row of ACL_ROWS) {
    console.log(`  ${row.agent_group_id} --[${row.local_name}]--> ${row.target_id}`);
  }
  console.log('');
  console.log(`Total: ${AGENT_GROUPS.length} agent_groups + ${ACL_ROWS.length} agent_destinations`);
  process.exit(0);
}

// ── Real run ─────────────────────────────────────────────────────────────────

console.log(`Opening DB: ${dbPath}`);
const db = initDb(dbPath);
runMigrations(db);

const now = new Date().toISOString();

// Insert agent_groups — INSERT OR IGNORE for idempotency
const insertGroup = db.prepare(
  `INSERT OR IGNORE INTO agent_groups (id, name, folder, agent_provider, created_at)
   VALUES (@id, @name, @folder, @agent_provider, @created_at)`,
);

let groupsInserted = 0;
for (const ag of AGENT_GROUPS) {
  const row: AgentGroupRow = { ...ag, created_at: now };
  const result = insertGroup.run(row);
  if (result.changes > 0) {
    groupsInserted++;
    console.log(`  [+] agent_group: ${ag.id}`);
  } else {
    console.log(`  [=] agent_group already exists: ${ag.id}`);
  }
}

// Insert ACL rows — INSERT OR IGNORE for idempotency
const insertAcl = db.prepare(
  `INSERT OR IGNORE INTO agent_destinations
     (agent_group_id, local_name, target_type, target_id, created_at)
   VALUES (@agent_group_id, @local_name, @target_type, @target_id, @created_at)`,
);

let aclInserted = 0;
for (const row of ACL_ROWS) {
  const full: AclRow = { ...row, created_at: now };
  const result = insertAcl.run(full);
  if (result.changes > 0) {
    aclInserted++;
    console.log(`  [+] acl: ${row.agent_group_id} --[${row.local_name}]--> ${row.target_id}`);
  } else {
    console.log(`  [=] acl already exists: ${row.agent_group_id}→${row.local_name}`);
  }
}

// ── Verification ─────────────────────────────────────────────────────────────

const CONTENT_IDS = AGENT_GROUPS.map((ag) => `'${ag.id}'`).join(',');

const agCount = (
  db
    .prepare(`SELECT COUNT(*) as c FROM agent_groups WHERE id IN (${CONTENT_IDS})`)
    .get() as { c: number }
).c;

const aclCount = (
  db
    .prepare(`SELECT COUNT(*) as c FROM agent_destinations WHERE agent_group_id IN (${CONTENT_IDS})`)
    .get() as { c: number }
).c;

console.log('');
console.log('── Verification ──────────────────────────────────────────');
console.log(`  agent_groups:      ${agCount} (expected 5)`);
console.log(`  agent_destinations: ${aclCount} (expected 8)`);

// Check for missing ACL rows and report precisely
if (aclCount < ACL_ROWS.length) {
  const existing = db
    .prepare(
      `SELECT agent_group_id, local_name FROM agent_destinations WHERE agent_group_id IN (${CONTENT_IDS})`,
    )
    .all() as Array<{ agent_group_id: string; local_name: string }>;

  const existingSet = new Set(existing.map((r) => `${r.agent_group_id}:${r.local_name}`));
  const missing = ACL_ROWS.filter((r) => !existingSet.has(`${r.agent_group_id}:${r.local_name}`));

  console.error('');
  console.error(`ACL VERIFICATION FAILED — missing ${missing.length} row(s):`);
  for (const r of missing) {
    console.error(`  MISSING: ${r.agent_group_id} --[${r.local_name}]--> ${r.target_id}`);
  }
  process.exit(1);
}

if (agCount < AGENT_GROUPS.length) {
  console.error(`agent_groups VERIFICATION FAILED — expected ${AGENT_GROUPS.length}, got ${agCount}`);
  process.exit(1);
}

console.log('');
console.log(`Setup complete. Inserted ${groupsInserted} groups + ${aclInserted} ACL rows.`);
console.log('ACL verification PASS');
