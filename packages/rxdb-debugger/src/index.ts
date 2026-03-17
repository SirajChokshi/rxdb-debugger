/**
 * rxdb-debugger
 *
 * Headless RxDB debugger with live/snapshot query support.
 */

export {
  type CatalogService,
  type CollectionInfo,
  createCatalogService,

  RxdbDebugger,
  type DebuggerOptions,

  createDocumentsService,
  type DiffChange,
  type DiffResult,
  type DocumentResult,
  type DocumentsService,
  type FindByIdOptions,
  type FindByIdsOptions,
  type ListOptions,

  createEventsService,
  type ChangeEvent,
  type EventHistoryOptions,
  type EventsService,
  type EventStreamOptions,
  type OperationType,

  createExportService,
  type ExportData,
  type ExportOptions,
  type ExportService,
  type ImportResult,

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

  createReplicationService,
  type CollectionReplicationSummary,
  type ReplicationErrorInfo,
  type ReplicationService,
  type ReplicationStateSnapshot,

  createQuery,
  createStaticQuery,
  type ExplorerQuery,
  type LiveOptions,

  createQueryService,
  type QueryDocument,
  type QueryExplanation,
  type QueryExecuteOptions,
  type QueryHistoryEntry,
  type QueryResult,
  type QueryService,

  createMemoizedResolver,
  type DbInput,

  createRxdbDebuggerAutoDiscoveryPlugin,
  getRxdbDebuggerRegistry,
  installRxdbDebuggerAutoDiscovery,
  type CollectionDiscoveryMetadata,
  type DatabaseInstanceMetadata,
  type DatabaseLifecycleStatus,
  type LogicalDatabaseMetadata,
  type RxdbDebuggerGlobalRegistry,
  type RxdbDebuggerRegistrySnapshot,

  createSchemaService,
  type IndexInfo,
  type PropertyInfo,
  type PropertyType,
  type Relationship,
  type SchemaDetails,
  type SchemaService,

  createHistoryService,
  type DocumentVersion,
  type HistoryService,
} from "@rxdb-debugger/core";
