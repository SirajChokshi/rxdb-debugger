import type {
  MangoQuery,
  RxCollection,
  RxDatabase,
  RxDocument,
} from "rxdb/plugins/core";

/**
 * Options for exporting data.
 */
export interface ExportOptions {
  /** Include RxDB metadata (_rev, _meta, _deleted) */
  includeMetadata?: boolean;
  /** Pretty print JSON with indentation */
  pretty?: boolean;
  /** Indentation level for pretty print (default: 2) */
  indent?: number;
}

/**
 * Result of an import operation.
 */
export interface ImportResult {
  /** Number of documents inserted */
  inserted: number;
  /** Number of documents updated (upserted) */
  updated: number;
  /** Number of documents that failed */
  failed: number;
  /** Error details for failed documents */
  errors: Array<{
    /** Document ID or index */
    id: string;
    /** Error message */
    error: string;
  }>;
}

/**
 * Export format containing metadata and documents.
 */
export interface ExportData {
  /** Export format version */
  version: 1;
  /** Export timestamp */
  exportedAt: string;
  /** Database name */
  database: string;
  /** Collections with their data */
  collections: {
    [name: string]: {
      /** Collection schema version */
      schemaVersion: number;
      /** Number of documents */
      count: number;
      /** Document data */
      documents: Record<string, unknown>[];
    };
  };
}

/**
 * Service for exporting and importing data.
 */
export interface ExportService {
  /**
   * Export a single collection to JSON string.
   */
  exportCollection(
    collectionName: string,
    options?: ExportOptions,
  ): Promise<string>;

  /**
   * Export query results to JSON string.
   */
  exportQuery(
    collectionName: string,
    query: MangoQuery<unknown>,
    options?: ExportOptions,
  ): Promise<string>;

  /**
   * Export entire database to JSON string.
   */
  exportDatabase(options?: ExportOptions): Promise<string>;

  /**
   * Export collection and trigger download in browser.
   */
  downloadCollection(
    collectionName: string,
    filename?: string,
    options?: ExportOptions,
  ): Promise<void>;

  /**
   * Export database and trigger download in browser.
   */
  downloadDatabase(filename?: string, options?: ExportOptions): Promise<void>;

  /**
   * Import documents into a collection from JSON string.
   */
  importDocuments(
    collectionName: string,
    json: string,
    options?: { upsert?: boolean },
  ): Promise<ImportResult>;

  /**
   * Import a full database export.
   */
  importDatabase(json: string, options?: { upsert?: boolean }): Promise<{
    [collectionName: string]: ImportResult;
  }>;

  /**
   * Parse and validate export JSON without importing.
   */
  parseExport(json: string): ExportData | { error: string };
}

/**
 * Get collection or throw error.
 */
function getCollection(db: RxDatabase, name: string): RxCollection {
  const collection = db.collections[name] as RxCollection | undefined;
  if (!collection) {
    throw new Error(`Collection "${name}" not found`);
  }
  return collection;
}

/**
 * Convert document to plain object.
 */
function docToJson(
  doc: RxDocument,
  includeMetadata: boolean,
): Record<string, unknown> {
  if (includeMetadata) {
    return doc.toJSON(true) as unknown as Record<string, unknown>;
  }
  return doc.toJSON() as unknown as Record<string, unknown>;
}

/**
 * Stringify with optional pretty printing.
 */
function stringify(data: unknown, options: ExportOptions = {}): string {
  const { pretty = false, indent = 2 } = options;
  if (pretty) {
    return JSON.stringify(data, null, indent);
  }
  return JSON.stringify(data);
}

/**
 * Trigger a download in the browser.
 */
function triggerDownload(content: string, filename: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Download is only available in browser environment");
  }

  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Create the export service for a database.
 */
export function createExportService(
  getDb: () => Promise<RxDatabase>,
): ExportService {
  return {
    async exportCollection(
      collectionName: string,
      options: ExportOptions = {},
    ): Promise<string> {
      const { includeMetadata = false } = options;
      const db = await getDb();
      const collection = getCollection(db, collectionName);

      const docs = await collection.find().exec();
      const documents = docs.map((doc) => docToJson(doc, includeMetadata));

      const exportData: ExportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        database: db.name,
        collections: {
          [collectionName]: {
            schemaVersion: collection.schema.version,
            count: documents.length,
            documents,
          },
        },
      };

      return stringify(exportData, options);
    },

    async exportQuery(
      collectionName: string,
      query: MangoQuery<unknown>,
      options: ExportOptions = {},
    ): Promise<string> {
      const { includeMetadata = false } = options;
      const db = await getDb();
      const collection = getCollection(db, collectionName);

      const docs = await collection.find(query).exec();
      const documents = docs.map((doc) => docToJson(doc, includeMetadata));

      const exportData: ExportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        database: db.name,
        collections: {
          [collectionName]: {
            schemaVersion: collection.schema.version,
            count: documents.length,
            documents,
          },
        },
      };

      return stringify(exportData, options);
    },

    async exportDatabase(options: ExportOptions = {}): Promise<string> {
      const { includeMetadata = false } = options;
      const db = await getDb();

      const collections: ExportData["collections"] = {};

      for (const [name, collection] of Object.entries(db.collections)) {
        const col = collection as RxCollection;
        const docs = await col.find().exec();
        const documents = docs.map((doc) => docToJson(doc, includeMetadata));

        collections[name] = {
          schemaVersion: col.schema.version,
          count: documents.length,
          documents,
        };
      }

      const exportData: ExportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        database: db.name,
        collections,
      };

      return stringify(exportData, options);
    },

    async downloadCollection(
      collectionName: string,
      filename?: string,
      options: ExportOptions = {},
    ): Promise<void> {
      const json = await this.exportCollection(collectionName, {
        ...options,
        pretty: true,
      });
      const name = filename ?? `${collectionName}-${Date.now()}.json`;
      triggerDownload(json, name);
    },

    async downloadDatabase(
      filename?: string,
      options: ExportOptions = {},
    ): Promise<void> {
      const db = await getDb();
      const json = await this.exportDatabase({ ...options, pretty: true });
      const name = filename ?? `${db.name}-${Date.now()}.json`;
      triggerDownload(json, name);
    },

    async importDocuments(
      collectionName: string,
      json: string,
      options: { upsert?: boolean } = {},
    ): Promise<ImportResult> {
      const { upsert = true } = options;
      const db = await getDb();
      const collection = getCollection(db, collectionName);

      let data: unknown;
      try {
        data = JSON.parse(json);
      } catch {
        return {
          inserted: 0,
          updated: 0,
          failed: 1,
          errors: [{ id: "parse", error: "Invalid JSON" }],
        };
      }

      let documents: Record<string, unknown>[];

      if (Array.isArray(data)) {
        documents = data;
      } else if (
        typeof data === "object" &&
        data !== null &&
        "collections" in data
      ) {
        const exportData = data as ExportData;
        const collectionData = exportData.collections[collectionName];
        if (!collectionData) {
          return {
            inserted: 0,
            updated: 0,
            failed: 1,
            errors: [
              {
                id: "collection",
                error: `Collection "${collectionName}" not found in export`,
              },
            ],
          };
        }
        documents = collectionData.documents;
      } else if (
        typeof data === "object" &&
        data !== null &&
        "documents" in data
      ) {
        documents = (data as { documents: Record<string, unknown>[] }).documents;
      } else {
        documents = [data as Record<string, unknown>];
      }

      const result: ImportResult = {
        inserted: 0,
        updated: 0,
        failed: 0,
        errors: [],
      };

      const primaryPath = collection.schema.primaryPath;

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i]!;
        const id = String(doc[primaryPath] ?? `index-${i}`);

        try {
          if (upsert) {
            const existing = await collection.findOne(id).exec();
            if (existing) {
              await existing.incrementalPatch(doc);
              result.updated++;
            } else {
              await collection.insert(doc);
              result.inserted++;
            }
          } else {
            await collection.insert(doc);
            result.inserted++;
          }
        } catch (err) {
          result.failed++;
          result.errors.push({
            id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return result;
    },

    async importDatabase(
      json: string,
      options: { upsert?: boolean } = {},
    ): Promise<{ [collectionName: string]: ImportResult }> {
      let data: ExportData;
      try {
        data = JSON.parse(json) as ExportData;
      } catch {
        return {
          _error: {
            inserted: 0,
            updated: 0,
            failed: 1,
            errors: [{ id: "parse", error: "Invalid JSON" }],
          },
        };
      }

      if (!data.collections || typeof data.collections !== "object") {
        return {
          _error: {
            inserted: 0,
            updated: 0,
            failed: 1,
            errors: [{ id: "format", error: "Invalid export format" }],
          },
        };
      }

      const results: { [collectionName: string]: ImportResult } = {};

      for (const collectionName of Object.keys(data.collections)) {
        const collectionData = data.collections[collectionName];
        if (!collectionData) continue;
        const collectionJson = JSON.stringify(collectionData.documents);
        results[collectionName] = await this.importDocuments(
          collectionName,
          collectionJson,
          options,
        );
      }

      return results;
    },

    parseExport(json: string): ExportData | { error: string } {
      try {
        const data = JSON.parse(json) as ExportData;
        if (!data.version || !data.collections) {
          return { error: "Invalid export format: missing version or collections" };
        }
        return data;
      } catch (err) {
        return {
          error: `Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };
}
