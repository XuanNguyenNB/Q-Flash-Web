export type CachedAssetRecord = {
  key: string;
  baseUrl: string;
  path: string;
  sha256: string;
  blob: Blob;
  size: number;
  storedAt: string;
};

export interface AssetCacheStore {
  get(key: string): Promise<CachedAssetRecord | undefined>;
  put(record: CachedAssetRecord): Promise<void>;
}

const DB_NAME = "xiaomi-webusb-assets";
const DB_VERSION = 1;
const STORE_NAME = "blobs";

const openAssetDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("IndexedDB không khả dụng trong ngữ cảnh trình duyệt này"));
      return;
    }

    const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("path", "path", { unique: false });
        store.createIndex("sha256", "sha256", { unique: false });
        store.createIndex("storedAt", "storedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Không mở được bộ nhớ đệm asset trong IndexedDB"));
    request.onblocked = () => reject(new Error("Nâng cấp bộ nhớ đệm asset trong IndexedDB đang bị tab khác chặn"));
  });

export class IndexedDbAssetCacheStore implements AssetCacheStore {
  private dbPromise: Promise<IDBDatabase> | undefined;

  async get(key: string) {
    const db = await this.getDatabase();

    return new Promise<CachedAssetRecord | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);

      request.onsuccess = () => resolve(request.result as CachedAssetRecord | undefined);
      request.onerror = () => reject(request.error ?? new Error(`Không đọc được asset đã lưu ${key}`));
      transaction.onabort = () => reject(transaction.error ?? new Error(`Giao dịch đọc bị hủy cho ${key}`));
    });
  }

  async put(record: CachedAssetRecord) {
    const db = await this.getDatabase();

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(record);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error(`Không lưu được asset ${record.path}`));
      transaction.onabort = () => reject(transaction.error ?? new Error(`Giao dịch ghi bị hủy cho ${record.path}`));
    });
  }

  private getDatabase() {
    this.dbPromise ??= openAssetDatabase();
    return this.dbPromise;
  }
}
