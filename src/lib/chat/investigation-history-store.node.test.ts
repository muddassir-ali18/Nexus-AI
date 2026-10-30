import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getInvestigationHistoryClientSnapshot,
  getInvestigationHistoryServerSnapshot,
  INVESTIGATION_HISTORY_SERVER_SNAPSHOT,
  resetInvestigationHistoryStoreForTests,
  saveStoredConversations,
} from "./investigation-history-store";
import { INVESTIGATION_HISTORY_STORAGE_KEY } from "./types";

describe("investigation history store snapshots", () => {
  it("keeps referential identity for server snapshot across repeated reads", () => {
    for (let index = 0; index < 500; index += 1) {
      assert.equal(
        Object.is(
          getInvestigationHistoryServerSnapshot(),
          getInvestigationHistoryServerSnapshot(),
        ),
        true,
      );
      assert.equal(
        Object.is(getInvestigationHistoryServerSnapshot(), INVESTIGATION_HISTORY_SERVER_SNAPSHOT),
        true,
      );
    }
  });

  it("keeps referential identity for client snapshot until storage changes", () => {
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
      resetInvestigationHistoryStoreForTests();

      for (let index = 0; index < 500; index += 1) {
        const first = getInvestigationHistoryClientSnapshot();
        const second = getInvestigationHistoryClientSnapshot();
        assert.equal(Object.is(first, second), true);
        assert.equal(Object.is(first, INVESTIGATION_HISTORY_SERVER_SNAPSHOT), true);
      }

      saveStoredConversations([
        {
          id: "c-1",
          title: "Stable snapshot test",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          messages: [],
        },
      ]);

      const afterSaveA = getInvestigationHistoryClientSnapshot();
      const afterSaveB = getInvestigationHistoryClientSnapshot();
      assert.equal(Object.is(afterSaveA, afterSaveB), true);
      assert.equal(afterSaveA.length, 1);
      assert.ok(store.has(INVESTIGATION_HISTORY_STORAGE_KEY));
    } finally {
      resetInvestigationHistoryStoreForTests();
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("does not allocate new snapshots when simulating React double-read", () => {
    resetInvestigationHistoryStoreForTests();
    const serverA = getInvestigationHistoryServerSnapshot();
    const serverB = getInvestigationHistoryServerSnapshot();
    assert.equal(Object.is(serverA, serverB), true);

    const clientA = getInvestigationHistoryClientSnapshot();
    const clientB = getInvestigationHistoryClientSnapshot();
    assert.equal(Object.is(clientA, clientB), true);
  });
});
