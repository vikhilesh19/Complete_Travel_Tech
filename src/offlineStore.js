const DATABASE_NAME = "wayfinder-offline";
const DATABASE_VERSION = 1;

function openDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(
      new Error("Offline storage is not supported in this browser."),
    );
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("areaSnapshots")) {
        database.createObjectStore("areaSnapshots", { keyPath: "areaId" });
      }
      if (!database.objectStoreNames.contains("helpQueue")) {
        database.createObjectStore("helpQueue", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Could not open offline storage."));
  });
}

async function runStoreRequest(storeName, mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Offline storage request failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () =>
      reject(
        transaction.error || new Error("Offline storage transaction failed."),
      );
  });
}

export function saveAreaSnapshot(snapshot) {
  return runStoreRequest("areaSnapshots", "readwrite", (store) =>
    store.put(snapshot),
  );
}

export function getAreaSnapshot(areaId) {
  return runStoreRequest("areaSnapshots", "readonly", (store) =>
    store.get(areaId),
  );
}

export function queueHelpAction(action) {
  return runStoreRequest("helpQueue", "readwrite", (store) =>
    store.put(action),
  );
}

export function getQueuedHelpActions() {
  return runStoreRequest("helpQueue", "readonly", (store) => store.getAll());
}

export function removeQueuedHelpAction(id) {
  return runStoreRequest("helpQueue", "readwrite", (store) => store.delete(id));
}
