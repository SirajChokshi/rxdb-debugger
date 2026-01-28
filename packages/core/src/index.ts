/**
 * @lassie/rxdb-explorer
 *
 * Headless RxDB debugger with live/snapshot query support.
 * Designed for building database inspection tools, debuggers, and admin UIs.
 */

export {
  type CatalogService,
  type CollectionInfo,
  createCatalogService,
} from "./catalog.js";

export {
  RxdbDebugger,
  RxdbExplorer,
  type DebuggerOptions,
  type RxdbExplorerOptions,
} from "./core.js";

export {
  createDocumentsService,
  type DiffChange,
  type DiffResult,
  type DocumentResult,
  type DocumentsService,
  type FindByIdOptions,
  type FindByIdsOptions,
  type ListOptions,
} from "./documents.js";

export {
  createEventsService,
  type ChangeEvent,
  type EventHistoryOptions,
  type EventsService,
  type EventStreamOptions,
  type OperationType,
} from "./events.js";

export {
  createExportService,
  type ExportData,
  type ExportOptions,
  type ExportService,
  type ImportResult,
} from "./export.js";

export {
  createMetadataService,
  type DatabaseInfo,
  type MetadataService,
} from "./metadata.js";

export {
  createPerformanceService,
  type OperationLog,
  type OperationTypeName,
  type PerformanceMetrics,
  type PerformanceService,
} from "./performance.js";

export {
  createAsyncQuery,
  createQuery,
  createStaticQuery,
  type ExplorerQuery,
  type LiveOptions,
} from "./query.js";

export {
  createQueryService,
  type QueryDocument,
  type QueryExplanation,
  type QueryExecuteOptions,
  type QueryHistoryEntry,
  type QueryResult,
  type QueryService,
} from "./query-playground.js";

export {
  createMemoizedResolver,
  resolveDb,
  type DbInput,
} from "./resolver.js";

export {
  createSchemaService,
  type IndexInfo,
  type PropertyInfo,
  type PropertyType,
  type Relationship,
  type SchemaDetails,
  type SchemaService,
} from "./schema.js";
