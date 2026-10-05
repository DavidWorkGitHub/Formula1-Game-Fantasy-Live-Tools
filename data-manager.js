'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Persistent storage for F1 Fantasy Live.
 *
 * Data lives outside the project folder so replacing/updating the app does not
 * delete a user's season history.
 *
 * Override the location with F1_FANTASY_DATA_DIR if required.
 */
const DATA_DIR = process.env.F1_FANTASY_DATA_DIR
  ? path.resolve(process.env.F1_FANTASY_DATA_DIR)
  : path.join(os.homedir(), 'Documents', 'F1 Fantasy Live');

const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const FILES = Object.freeze({
  history: 'history.json',
  season: 'season.json',
  weekend: 'weekend.json',
  autosave: 'autosave.json',
  prices: 'prices.json',
  standings: 'standings.json',
  settings: 'settings.json',
  events: 'events.json'
});

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ensure() {
  ensureDir(DATA_DIR);
  ensureDir(BACKUP_DIR);
}

function filePath(name) {
  const filename = FILES[name] || name;
  if (path.basename(filename) !== filename) throw new Error(`Invalid data filename: ${filename}`);
  return path.join(DATA_DIR, filename);
}

function safeParse(text, fallback = {}) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function read(name, fallback = {}) {
  ensure();
  const target = filePath(name);
  try {
    return safeParse(fs.readFileSync(target, 'utf8'), fallback);
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`[data] Could not read ${target}: ${err.message}`);
    return fallback;
  }
}

function atomicWrite(name, value) {
  ensure();
  const target = filePath(name);
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  const text = JSON.stringify(value, null, 2);
  fs.writeFileSync(temp, text, 'utf8');
  fs.renameSync(temp, target);
}

function write(name, value) {
  atomicWrite(name, value);
}

function backup(name, value, label = '') {
  ensure();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = label ? `-${String(label).replace(/[^a-z0-9_-]/gi, '_')}` : '';
  const filename = `${FILES[name] || name}.${stamp}${suffix}.bak`;
  const target = path.join(BACKUP_DIR, filename);
  fs.writeFileSync(target, JSON.stringify(value, null, 2), 'utf8');
  return target;
}

function writeWithBackup(name, value, options = {}) {
  ensure();
  const existing = read(name, null);
  if (existing !== null && options.backup !== false) {
    try { backup(name, existing, options.label || 'before-save'); } catch (err) {
      console.warn(`[data] Backup failed for ${name}: ${err.message}`);
    }
  }
  write(name, value);
}

function exists(name) {
  return fs.existsSync(filePath(name));
}

function remove(name) {
  const target = filePath(name);
  try { fs.rmSync(target, { force: true }); } catch (err) { console.warn(`[data] Remove failed: ${err.message}`); }
}

function listBackups() {
  ensure();
  return fs.readdirSync(BACKUP_DIR).sort().reverse();
}

/**
 * One-time migration from the old project-local files used by previous builds.
 * Existing data in the new folder always wins after migration has happened.
 */
function migrateLegacy(projectDir) {
  ensure();
  const migrations = [
    ['fantasy-history.json', 'history'],
    ['fantasy-autosave.json', 'autosave'],
    ['app-settings.json', 'settings'],
    ['pricing-config.json', 'prices']
  ];

  const marker = path.join(DATA_DIR, '.legacy-migration-complete');
  if (fs.existsSync(marker)) return { migrated: [], skipped: true };

  const migrated = [];
  for (const [legacyName, targetName] of migrations) {
    const source = path.join(projectDir, legacyName);
    if (!fs.existsSync(source) || exists(targetName)) continue;
    try {
      const value = safeParse(fs.readFileSync(source, 'utf8'), null);
      if (value !== null) {
        write(targetName, value);
        migrated.push(legacyName);
      }
    } catch (err) {
      console.warn(`[data] Could not migrate ${legacyName}: ${err.message}`);
    }
  }

  fs.writeFileSync(marker, JSON.stringify({ migrated, at: new Date().toISOString() }, null, 2));
  return { migrated, skipped: false };
}

function saveRuntime(runtime, reason = '') {
  const payload = {
    version: 3,
    savedAt: new Date().toISOString(),
    reason,
    ...runtime
  };
  // Autosave is deliberately cheap: atomic replacement, no backup on every 5s tick.
  write('autosave', payload);
  return payload;
}

function loadRuntime() {
  return read('autosave', null);
}

function saveWeekend(weekend) {
  return writeWithBackup('weekend', {
    version: 1,
    savedAt: new Date().toISOString(),
    ...weekend
  }, { label: 'weekend' });
}

function saveHistory(history) {
  return writeWithBackup('history', {
    version: 2,
    savedAt: new Date().toISOString(),
    ...history
  }, { label: 'history' });
}

function saveSeason(season) {
  return writeWithBackup('season', {
    version: 1,
    savedAt: new Date().toISOString(),
    ...season
  }, { label: 'season' });
}

function savePrices(prices) {
  return write('prices', {
    version: 1,
    savedAt: new Date().toISOString(),
    ...prices
  });
}

function saveStandings(standings) {
  return write('standings', {
    version: 1,
    savedAt: new Date().toISOString(),
    ...standings
  });
}

function saveSettings(settings) {
  return write('settings', {
    version: 1,
    savedAt: new Date().toISOString(),
    ...settings
  });
}

function clearRuntime() {
  remove('autosave');
  remove('weekend');
}

module.exports = {
  DATA_DIR,
  BACKUP_DIR,
  FILES,
  ensure,
  read,
  write,
  atomicWrite,
  writeWithBackup,
  backup,
  exists,
  remove,
  listBackups,
  migrateLegacy,
  saveRuntime,
  loadRuntime,
  saveWeekend,
  saveHistory,
  saveSeason,
  savePrices,
  saveStandings,
  saveSettings,
  clearRuntime
};
