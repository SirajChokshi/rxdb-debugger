/**
 * rxdb-debugger/plugin
 *
 * Auto-discovery plugin for the RxDB Debugger Chrome extension.
 */

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
} from "@rxdb-debugger/core";
