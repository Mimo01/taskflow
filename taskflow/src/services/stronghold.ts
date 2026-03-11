/**
 * Stronghold PAT storage service.
 *
 * Stores PATs as UTF-8 byte arrays in an argon2-encrypted Stronghold vault.
 * Always calls save() after writes — Stronghold only persists to disk on save().
 *
 * Security note: The vault encryption password is a random 32-byte hex key
 * generated on first launch and stored in Tauri Store. This is appropriate for
 * a dev tooling app protecting internal API tokens, but NOT for financial
 * credentials. Migration path: replace this file with tauri-plugin-keyring
 * when upgrading to Tauri 3 (Stronghold will be removed in v3).
 *
 * All Stronghold imports are isolated here — no other file imports from
 * @tauri-apps/plugin-stronghold (anti-pattern: see RESEARCH.md Pitfall 3).
 *
 * Source: https://v2.tauri.app/plugin/stronghold/
 */
import { Stronghold, Client } from '@tauri-apps/plugin-stronghold';
import { appDataDir } from '@tauri-apps/api/path';
import { LazyStore } from '@tauri-apps/plugin-store';

const metaStore = new LazyStore('stronghold-meta.json');

let _stronghold: Stronghold | null = null;
let _store: ReturnType<Client['getStore']> | null = null;

async function getVaultPassword(): Promise<string> {
  const existing = await metaStore.get<string>('vault-password');
  if (existing) return existing;

  // Generate a random 32-byte key on first launch and persist it.
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const password = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await metaStore.set('vault-password', password);
  await metaStore.save();
  return password;
}

async function getStore(): Promise<ReturnType<Client['getStore']>> {
  if (_store) return _store;

  const vaultPath = `${await appDataDir()}/vault.hold`;
  const password = await getVaultPassword();

  _stronghold = await Stronghold.load(vaultPath, password);
  const client = await _stronghold
    .loadClient('taskflow')
    .catch(() => _stronghold!.createClient('taskflow'));
  _store = client.getStore();
  return _store;
}

/**
 * Store a secret value under the given key.
 * The value is encoded as UTF-8 bytes before storage.
 */
export async function storeSecret(key: string, value: string): Promise<void> {
  const store = await getStore();
  const data = Array.from(new TextEncoder().encode(value));
  await store.insert(key, data);
  await _stronghold!.save();
}

/**
 * Read a secret value by key.
 * Throws if the key does not exist.
 */
export async function readSecret(key: string): Promise<string> {
  const store = await getStore();
  const data = await store.get(key);
  if (data === null) throw new Error(`Secret not found: ${key}`);
  return new TextDecoder().decode(new Uint8Array(data));
}

/**
 * Remove a secret by key and persist the change.
 */
export async function removeSecret(key: string): Promise<void> {
  const store = await getStore();
  await store.remove(key);
  await _stronghold!.save();
}
