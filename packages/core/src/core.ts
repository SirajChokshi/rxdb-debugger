import type { RxDatabase } from "rxdb/plugins/core";
import { type CatalogService, createCatalogService } from "./catalog.js";
import { createDocumentsService, type DocumentsService } from "./documents.js";
import { createEventsService, type EventsService } from "./events.js";
import { createExportService, type ExportService } from "./export.js";
import { createMetadataService, type MetadataService } from "./metadata.js";
import { createPerformanceService, type PerformanceService } from "./performance.js";
import { createQueryService, type QueryService } from "./query-playground.js";
import { createMemoizedResolver, type DbInput } from "./resolver.js";
import { createSchemaService, type SchemaService } from "./schema.js";

/**
 * Options for creating an RxDB Debugger instance.
 */
export interface DebuggerOptions<T extends RxDatabase = RxDatabase> {
  /**
   * The database to debug.
   * Can be an instance, a Promise, or a factory function.
   */
  db: DbInput<T>;

  /**
   * Enable performance tracking on initialization.
   * @default false
   */
  trackPerformance?: boolean;

  /**
   * Size of the event history buffer.
   * @default 100
   */
  eventBufferSize?: number;

  /**
   * Size of the performance operation log.
   * @default 500
   */
  performanceLogSize?: number;

  /**
   * Size of the query history.
   * @default 50
   */
  queryHistorySize?: number;
}

/**
 * Main facade for debugging an RxDB database.
 * Provides access to all debugging services.
 */
export class RxdbDebugger<T extends RxDatabase = RxDatabase> {
  private readonly getDb: () => Promise<T>;
  private readonly _events: EventsService;
  private readonly _performance: PerformanceService;
  private _disposed = false;

  /**
   * Service for exploring collections (schema, indexes, counts).
   */
  public readonly catalog: CatalogService;

  /**
   * Service for browsing and querying documents.
   */
  public readonly documents: DocumentsService;

  /**
   * Service for database-level metadata.
   */
  public readonly metadata: MetadataService;

  /**
   * Service for inspecting collection schemas.
   */
  public readonly schema: SchemaService;

  /**
   * Service for executing and testing queries.
   */
  public readonly query: QueryService;

  /**
   * Service for streaming document changes.
   */
  public readonly events: EventsService;

  /**
   * Service for tracking operation performance.
   */
  public readonly performance: PerformanceService;

  /**
   * Service for exporting and importing data.
   */
  public readonly export: ExportService;

  constructor(options: DebuggerOptions<T>) {
    const {
      db,
      trackPerformance = false,
      eventBufferSize = 100,
      performanceLogSize = 500,
      queryHistorySize = 50,
    } = options;

    this.getDb = createMemoizedResolver(db);

    this.catalog = createCatalogService(this.getDb);
    this.documents = createDocumentsService(this.getDb);
    this.metadata = createMetadataService(this.getDb);
    this.schema = createSchemaService(this.getDb);
    this.query = createQueryService(this.getDb, queryHistorySize);

    this._events = createEventsService(this.getDb, eventBufferSize);
    this.events = this._events;

    this._performance = createPerformanceService(performanceLogSize);
    this.performance = this._performance;

    this.export = createExportService(this.getDb);

    if (trackPerformance) {
      this._performance.start();
    }
  }

  /**
   * Get the resolved database instance.
   */
  async getDatabase(): Promise<T> {
    this.checkDisposed();
    return this.getDb();
  }

  /**
   * Check if the debugger has been disposed.
   */
  isDisposed(): boolean {
    return this._disposed;
  }

  /**
   * Dispose all services and cleanup resources.
   * After calling this, the debugger should not be used.
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this._events.dispose();
    this._performance.stop();
  }

  private checkDisposed(): void {
    if (this._disposed) {
      throw new Error("RxdbDebugger has been disposed");
    }
  }
}

/**
 * @deprecated Use RxdbDebugger instead. RxdbExplorer is kept for backward compatibility.
 */
export class RxdbExplorer<T extends RxDatabase = RxDatabase> extends RxdbDebugger<T> {
  constructor(options: { db: DbInput<T> }) {
    super(options);
  }
}

/**
 * @deprecated Use DebuggerOptions instead.
 */
export type RxdbExplorerOptions<T extends RxDatabase = RxDatabase> = DebuggerOptions<T>;
