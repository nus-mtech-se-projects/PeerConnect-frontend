import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

function createStorageMock() {
  const store = new Map();

  return {
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(String(key));
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    get length() {
      return store.size;
    },
  };
}

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: createStorageMock(),
});

Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: createStorageMock(),
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
