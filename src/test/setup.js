import "@testing-library/jest-dom";

if (
  typeof window !== "undefined" &&
  (!window.localStorage || typeof window.localStorage.getItem !== "function")
) {
  const store = new Map();

  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: (index) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    },
    configurable: true,
  });
}

if (typeof globalThis.localStorage === "undefined" && typeof window !== "undefined") {
  globalThis.localStorage = window.localStorage;
}

if (typeof beforeEach === "function" && typeof globalThis.localStorage?.clear === "function") {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });
}
