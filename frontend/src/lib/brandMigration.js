// Compatibility bridge for local data created before the SUBMUNDO rebrand.
// Legacy names live only here so existing users keep sessions, guest saves and UI preferences.
const LEGACY_PREFIXES = [
  ["lusorae", "submundo"],
  ["lus-", "sub-"],
  ["lus_", "sub_"],
  ["lus:", "sub:"],
];

const migrateStorage = (storage) => {
  if (!storage) return;
  const keys = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key) keys.push(key);
  }
  for (const key of keys) {
    const pair = LEGACY_PREFIXES.find(([legacy]) => key.startsWith(legacy));
    if (!pair) continue;
    const [legacy, current] = pair;
    const nextKey = current + key.slice(legacy.length);
    try {
      if (storage.getItem(nextKey) == null) {
        const value = storage.getItem(key);
        if (value != null) storage.setItem(nextKey, value);
      }
      storage.removeItem(key);
    } catch (_error) {
      // Storage can be unavailable in hardened/private browser modes.
    }
  }
};

export function migrateLegacyBrandStorage() {
  if (typeof window === "undefined") return;
  migrateStorage(window.localStorage);
  migrateStorage(window.sessionStorage);
}

migrateLegacyBrandStorage();
