/**
 * Cell to Mind — IndexedDB kayıt deposu.
 *
 * Depolama hataları görünür biçimde yüzeye çıkarılır; sessizce yutulmaz.
 * Bozuk kayıt mevcut dünyayı bozmaz (doğrulama worker tarafında yapılır).
 */

export interface SavedRecord {
  id: string;
  label: string;
  tick: number;
  savedAt: number;
  simVersion: string;
  bytes: number;
  snapshotJson: string;
}

const DB_NAME = 'ctm-records';
const DB_VERSION = 1;
const STORE = 'sessions';

export class StorageError extends Error {
  readonly cause: string;
  constructor(message: string, cause: string) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageError('IndexedDB kullanılamıyor', 'indexedDB tanımsız'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new StorageError('Veritabanı açılamadı', request.error?.message ?? 'bilinmeyen hata'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        // ⚠️ Bağlantı **her** yolda kapatılmalı. Önceden yalnız `oncomplete`
        // vardı; ama bir işlem **iptal** edildiğinde (kota doldu, kısıt ihlali)
        // `oncomplete` hiç tetiklenmez — `db.close()` çağrılmaz ve bağlantı
        // **sızıntı** olur. Tekrarlayan başarısız yazmalar bağlantı havuzunu
        // tüketip deponun tamamen çalışmaz hâle gelmesine yol açar.
        // IDB kuralı: bir işlem tam olarak biri — complete, abort, error.
        const closeOnce = (): void => db.close();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          closeOnce();
          reject(new StorageError('Depolama işlemi başarısız', request.error?.message ?? 'bilinmeyen hata'));
        };
        transaction.oncomplete = closeOnce;
        transaction.onabort = closeOnce;
        transaction.onerror = closeOnce;
      }),
  );
}

export async function saveRecord(record: Omit<SavedRecord, 'savedAt'>): Promise<SavedRecord> {
  const full: SavedRecord = { ...record, savedAt: Date.now() };
  try {
    await tx('readwrite', (store) => store.put(full));
    return full;
  } catch (err) {
    throw err instanceof StorageError ? err : new StorageError('Kayıt yazılamadı', (err as Error).message);
  }
}

export async function listRecords(): Promise<SavedRecord[]> {
  const all = await tx<SavedRecord[]>('readonly', (store) => store.getAll() as IDBRequest<SavedRecord[]>);
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

export async function getRecord(id: string): Promise<SavedRecord | undefined> {
  return tx<SavedRecord | undefined>('readonly', (store) => store.get(id) as IDBRequest<SavedRecord | undefined>);
}

export async function deleteRecord(id: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(id) as unknown as IDBRequest<undefined>);
}

/** Depolama kotası / kullanım bilgisi (görünür hata için). */
export async function estimateUsage(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  const est = await navigator.storage.estimate();
  return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
}

/** Dosya indirme (JSON dışa aktarım). */
export function downloadJson(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Dosya seçme (JSON içe aktarım). */
export function pickJsonFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    // ⚠️ Kullanıcı pencereyi **iptal** ederse `change` hiç tetiklenmez ve
    // önceki sürümde bu söz **hiç çözülmüyordu** — `await pickJsonFile()` sonsuza
    // dek asılı kalıyor, çağıranın geri kalanı hiç çalışmıyordu. `oncancel`
    // bu yolu kapatır (tarayıcı desteği: Chrome 113+, Firefox 91+, Safari 16.4+).
    input.oncancel = () => resolve(null);
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}