import type { RxDatabase } from "rxdb/plugins/core";
import { createStaticQuery, type ExplorerQuery } from "./query.js";

/**
 * Database-level metadata.
 */
export interface DatabaseInfo {
  /** Database name */
  name: string;
  /** Number of collections */
  collectionCount: number;
  /** Collection names */
  collectionNames: string[];
  /** Whether the database is destroyed */
  destroyed: boolean;
  /** Storage token (storage identifier) */
  token: string;
}

/**
 * Service for database-level metadata.
 */
export interface MetadataService {
  /**
   * Get database-level information.
   * This is static metadata that doesn't change after creation.
   */
  databaseInfo(): ExplorerQuery<DatabaseInfo>;

  /**
   * Check if the database is ready (initialized and not destroyed).
   */
  isReady(): ExplorerQuery<boolean>;
}

/**
 * Create the metadata service for a database.
 */
export function createMetadataService(
  getDb: () => Promise<RxDatabase>,
): MetadataService {
  return {
    databaseInfo(): ExplorerQuery<DatabaseInfo> {
      return createStaticQuery(async () => {
        const db = await getDb();
        const collectionNames = Object.keys(db.collections).sort();

        return {
          name: db.name,
          collectionCount: collectionNames.length,
          collectionNames,
          destroyed: (db as unknown as { destroyed: boolean }).destroyed,
          token: db.token,
        };
      });
    },

    isReady(): ExplorerQuery<boolean> {
      return createStaticQuery(async () => {
        try {
          const db = await getDb();
          return !db.destroyed;
        } catch {
          return false;
        }
      });
    },
  };
}
