import { createStaticQuery, type ExplorerQuery } from "./query.js";
import type { EventsService, ChangeEvent } from "./events.js";

export interface DocumentVersion {
  id: string;
  documentId: string;
  collection: string;
  data: Record<string, unknown>;
  timestamp: number;
  operation: "INSERT" | "UPDATE" | "DELETE";
}

export interface HistoryService {
  getVersions(collection: string, docId: string): ExplorerQuery<DocumentVersion[]>;
  getVersionAt(collection: string, docId: string, timestamp: number): ExplorerQuery<DocumentVersion | null>;
  getAllVersions(): ExplorerQuery<DocumentVersion[]>;
  clear(): void;
  dispose(): void;
}

const MAX_HISTORY_SIZE = 500;

export function createHistoryService(
  eventsService: EventsService
): HistoryService {
  const historyBuffer: DocumentVersion[] = [];
  let versionIdCounter = 0;
  let subscription: { unsubscribe: () => void } | null = null;
  let disposed = false;

  const ensureTracking = (): void => {
    if (disposed) {
      throw new Error("History service has been disposed");
    }
    if (subscription) {
      return;
    }

    subscription = eventsService.stream().observe().subscribe({
      next: (event: ChangeEvent) => {
        if (event.operation === "INSERT" || event.operation === "UPDATE" || event.operation === "DELETE") {
          const version: DocumentVersion = {
            id: `v${versionIdCounter++}`,
            documentId: event.documentId,
            collection: event.collection,
            data: (event.data ?? {}) as Record<string, unknown>,
            timestamp: event.timestamp,
            operation: event.operation,
          };
          historyBuffer.unshift(version);
          if (historyBuffer.length > MAX_HISTORY_SIZE) {
            historyBuffer.pop();
          }
        }
      },
    });
  };

  const getVersions = (collection: string, docId: string): ExplorerQuery<DocumentVersion[]> => {
    return createStaticQuery(() => {
      ensureTracking();
      return historyBuffer.filter(
        (v) => v.collection === collection && v.documentId === docId
      );
    });
  };

  const getVersionAt = (
    collection: string,
    docId: string,
    timestamp: number
  ): ExplorerQuery<DocumentVersion | null> => {
    return createStaticQuery(() => {
      ensureTracking();
      const versions = historyBuffer
        .filter((v) => v.collection === collection && v.documentId === docId && v.timestamp <= timestamp)
        .sort((a, b) => b.timestamp - a.timestamp);
      return versions[0] ?? null;
    });
  };

  const getAllVersions = (): ExplorerQuery<DocumentVersion[]> => {
    return createStaticQuery(() => {
      ensureTracking();
      return [...historyBuffer];
    });
  };

  const clear = (): void => {
    historyBuffer.length = 0;
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    subscription?.unsubscribe();
    subscription = null;
    historyBuffer.length = 0;
  };

  return {
    getVersions,
    getVersionAt,
    getAllVersions,
    clear,
    dispose,
  };
}
