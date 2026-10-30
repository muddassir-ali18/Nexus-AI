import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createConversationTitle,
  getInvestigationHistoryServerSnapshot,
  getInvestigationHistorySnapshot,
  loadStoredConversations,
  resetInvestigationHistoryCacheForTests,
  saveStoredConversations,
} from "./investigation-history";
import { INVESTIGATION_HISTORY_STORAGE_KEY } from "./types";

describe("investigation history storage", () => {
  it("creates a truncated conversation title", () => {
    const title = createConversationTitle("a".repeat(100));
    assert.equal(title.endsWith("…"), true);
    assert.ok(title.length <= 73);
  });

  it("returns a stable server snapshot reference", () => {
    const first = getInvestigationHistoryServerSnapshot();
    const second = getInvestigationHistoryServerSnapshot();
    assert.equal(first, second);
    assert.equal(first.length, 0);
  });

  it("round-trips conversations through in-memory localStorage shim", () => {
    const store = new Map<string, string>();
    const localStorageShim = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };

    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: localStorageShim },
    });

    try {
      resetInvestigationHistoryCacheForTests();
      saveStoredConversations([
        {
          id: "c-1",
          title: "Test investigation",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          messages: [],
        },
      ]);

      const loaded = loadStoredConversations();
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0]?.id, "c-1");
      assert.ok(store.has(INVESTIGATION_HISTORY_STORAGE_KEY));

      const snapshotA = getInvestigationHistorySnapshot();
      const snapshotB = getInvestigationHistorySnapshot();
      assert.equal(snapshotA, snapshotB);
    } finally {
      resetInvestigationHistoryCacheForTests();
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});
