/**
 * @rxdb-debugger/core
 *
 * Headless RxDB debugger with live/snapshot query support.
 * Designed for building database inspection tools, debuggers, and admin UIs.
 */

export {
  attachDebuggerDatabaseExtensions,
  getDebuggerDatabaseExtensions,
  type DebuggerDatabaseExtensions,
} from "./database-extensions.js";

export {
  type CatalogService,
  type CollectionInfo,
  createCatalogService,
} from "./catalog.js";

export {
  RxdbDebugger,
  type DebuggerOptions,
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
  type BulkWriteDiagnostics,
  type BulkWriteOperationDetails,
  type CountDiagnostics,
  type CountOperationDetails,
  type FindByIdsDiagnostics,
  type FindByIdsOperationDetails,
  type OperationDetails,
  createPerformanceService,
  type OperationLog,
  type OperationTypeName,
  type PerformanceInsight,
  type PerformanceMetrics,
  type PerformanceProfile,
  type PerformanceService,
  type QueryDiagnostics,
  type QueryOperationDetails,
} from "./performance.js";

export {
  createReplicationService,
  type CollectionReplicationSummary,
  type ReplicationErrorInfo,
  type ReplicationService,
  type ReplicationStateSnapshot,
} from "./replication.js";

export {
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
  type DbInput,
} from "./resolver.js";

export {
  createRxdbDebuggerAutoDiscoveryPlugin,
  getRxdbDebuggerRegistry,
  installRxdbDebuggerAutoDiscovery,
  type CollectionDiscoveryMetadata,
  type DatabaseInstanceMetadata,
  type DatabaseLifecycleStatus,
  type LogicalDatabaseMetadata,
  type RxdbDebuggerGlobalRegistry,
  type RxdbDebuggerRegistrySnapshot,
} from "./auto-discovery.js";

export {
  createSchemaService,
  type IndexInfo,
  type PropertyInfo,
  type PropertyType,
  type Relationship,
  type SchemaDetails,
  type SchemaService,
} from "./schema.js";

export {
  createHistoryService,
  type DocumentVersion,
  type HistoryService,
} from "./history.js";
