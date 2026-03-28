import { addRxPlugin, type RxCollection, type RxDatabase, type RxPlugin } from "rxdb/plugins/core";

const REGISTRY_VERSION = 1;
const DEFAULT_GLOBAL_KEY = "__RXDB_DEBUGGER__";
const PLUGIN_NAME = "rxdb-debugger-auto-discovery";
const INSTALL_FLAG_KEY = "__RXDB_DEBUGGER_AUTO_DISCOVERY_INSTALLED__";

export type DatabaseLifecycleStatus = "open" | "closing" | "closed" | "removed";

export interface CollectionDiscoveryMetadata {
  name: string;
  encryptedFieldPaths: string[];
  hasEncryptedAttachments: boolean;
}

export interface LogicalDatabaseMetadata {
  id: string;
  name: string;
  storageName: string;
  multiInstance: boolean;
  hasPasswordConfigured: boolean;
  status: DatabaseLifecycleStatus;
  createdAt: number;
  updatedAt: number;
  openInstanceCount: number;
  totalInstanceCount: number;
  hasEncryptedFields: boolean;
  hasEncryptedAttachments: boolean;
  collections: Record<string, CollectionDiscoveryMetadata>;
  collectionNames: string[];
}

export interface DatabaseInstanceMetadata {
  id: string;
  logicalDatabaseId: string;
  name: string;
  storageName: string;
  multiInstance: boolean;
  status: DatabaseLifecycleStatus;
  instanceToken: string;
  createdAt: number;
  updatedAt: number;
  collectionNames: string[];
}

export interface RxdbDebuggerRegistrySnapshot {
  version: number;
  logicalDatabases: Record<string, LogicalDatabaseMetadata>;
  instances: Record<string, DatabaseInstanceMetadata>;
}

export type RegistryChangeType =
  | "instance-registered"
  | "instance-status-changed"
  | "instance-removed"
  | "collection-added"
  | "collection-removed";

export interface RxdbDebuggerRegistryChange {
  type: RegistryChangeType;
  timestamp: number;
  logicalDatabaseId: string;
  instanceId?: string;
  collectionName?: string;
  status?: DatabaseLifecycleStatus;
}

export type RxdbDebuggerRegistryListener = (
  change: RxdbDebuggerRegistryChange,
) => void;

export interface RxdbDebuggerGlobalRegistry extends RxdbDebuggerRegistrySnapshot {
  listLogicalDatabases(): LogicalDatabaseMetadata[];
  listInstances(logicalDatabaseId?: string): DatabaseInstanceMetadata[];
  getInstanceHandle(instanceId: string): RxDatabase | null;
  closeInstance(instanceId: string): Promise<boolean>;
  removeInstance(instanceId: string): Promise<boolean>;
  snapshot(): RxdbDebuggerRegistrySnapshot;
  subscribe(listener: RxdbDebuggerRegistryListener): () => void;
}

interface RegistryInternals {
  handles: Map<string, RxDatabase>;
  logicalIdByIdentity: Map<string, string>;
  storageTokenByLogicalId: Map<string, string>;
  logicalIdByInstanceId: Map<string, string>;
  instanceIdByDatabase: WeakMap<object, string>;
  listeners: Set<RxdbDebuggerRegistryListener>;
  nextLogicalId: number;
}

type RegistryWithInternals = RxdbDebuggerGlobalRegistry & {
  __internals: RegistryInternals;
};

interface AutoDiscoveryOptions {
  globalKey?: string;
}

interface DatabaseHookPayload {
  database: RxDatabase;
  creator: {
    password?: unknown;
  };
}

interface PostRemoveDatabasePayload {
  databaseName: string;
  storage: {
    name: string;
  };
}

interface CreateCollectionPayload {
  collection: RxCollection;
}

interface PostRemoveCollectionPayload {
  databaseName: string;
  collectionName: string;
  storage: {
    name: string;
  };
}

function getGlobalObject(): Record<string, unknown> | null {
  if (typeof globalThis === "undefined") {
    return null;
  }
  return globalThis as unknown as Record<string, unknown>;
}

function cloneCollectionMetadata(
  collection: CollectionDiscoveryMetadata,
): CollectionDiscoveryMetadata {
  return {
    name: collection.name,
    encryptedFieldPaths: [...collection.encryptedFieldPaths],
    hasEncryptedAttachments: collection.hasEncryptedAttachments,
  };
}

function cloneLogicalDatabaseMetadata(
  logicalDatabase: LogicalDatabaseMetadata,
): LogicalDatabaseMetadata {
  const collections: Record<string, CollectionDiscoveryMetadata> = {};
  for (const [name, metadata] of Object.entries(logicalDatabase.collections)) {
    collections[name] = cloneCollectionMetadata(metadata);
  }

  return {
    ...logicalDatabase,
    collections,
    collectionNames: [...logicalDatabase.collectionNames],
  };
}

function cloneInstanceMetadata(
  instance: DatabaseInstanceMetadata,
): DatabaseInstanceMetadata {
  return {
    ...instance,
    collectionNames: [...instance.collectionNames],
  };
}

function sortLogicalDatabases(
  values: LogicalDatabaseMetadata[],
): LogicalDatabaseMetadata[] {
  return values.sort((a, b) => {
    const nameSort = a.name.localeCompare(b.name);
    if (nameSort !== 0) {
      return nameSort;
    }
    return a.id.localeCompare(b.id);
  });
}

function sortInstances(
  values: DatabaseInstanceMetadata[],
): DatabaseInstanceMetadata[] {
  return values.sort((a, b) => {
    const nameSort = a.name.localeCompare(b.name);
    if (nameSort !== 0) {
      return nameSort;
    }
    return a.instanceToken.localeCompare(b.instanceToken);
  });
}

function createRegistry(): RegistryWithInternals {
  const internals: RegistryInternals = {
    handles: new Map<string, RxDatabase>(),
    logicalIdByIdentity: new Map<string, string>(),
    storageTokenByLogicalId: new Map<string, string>(),
    logicalIdByInstanceId: new Map<string, string>(),
    instanceIdByDatabase: new WeakMap<object, string>(),
    listeners: new Set<RxdbDebuggerRegistryListener>(),
    nextLogicalId: 0,
  };

  const registry: RegistryWithInternals = {
    version: REGISTRY_VERSION,
    logicalDatabases: {},
    instances: {},
    __internals: internals,
    listLogicalDatabases() {
      const values = Object.values(this.logicalDatabases)
        .map((entry) => cloneLogicalDatabaseMetadata(entry));
      return sortLogicalDatabases(values);
    },
    listInstances(logicalDatabaseId?: string) {
      const values = Object.values(this.instances)
        .filter((instance) =>
          logicalDatabaseId ? instance.logicalDatabaseId === logicalDatabaseId : true
        )
        .map((entry) => cloneInstanceMetadata(entry));
      return sortInstances(values);
    },
    getInstanceHandle(instanceId: string) {
      return this.__internals.handles.get(instanceId) ?? null;
    },
    async closeInstance(instanceId: string): Promise<boolean> {
      const handle = this.__internals.handles.get(instanceId);
      if (!handle) {
        return false;
      }
      await handle.close();
      return true;
    },
    async removeInstance(instanceId: string): Promise<boolean> {
      const handle = this.__internals.handles.get(instanceId);
      if (!handle) {
        return false;
      }
      await handle.remove();
      return true;
    },
    snapshot() {
      const logicalDatabases: Record<string, LogicalDatabaseMetadata> = {};
      const instances: Record<string, DatabaseInstanceMetadata> = {};

      for (const [id, metadata] of Object.entries(this.logicalDatabases)) {
        logicalDatabases[id] = cloneLogicalDatabaseMetadata(metadata);
      }
      for (const [id, metadata] of Object.entries(this.instances)) {
        instances[id] = cloneInstanceMetadata(metadata);
      }

      return {
        version: this.version,
        logicalDatabases,
        instances,
      };
    },
    subscribe(listener: RxdbDebuggerRegistryListener) {
      this.__internals.listeners.add(listener);
      return () => {
        this.__internals.listeners.delete(listener);
      };
    },
  };

  return registry;
}

function notifyRegistryChange(
  registry: RegistryWithInternals,
  change: Omit<RxdbDebuggerRegistryChange, "timestamp">,
): void {
  const listeners = Array.from(registry.__internals.listeners);
  if (listeners.length === 0) {
    return;
  }

  const payload: RxdbDebuggerRegistryChange = {
    ...change,
    timestamp: Date.now(),
  };

  for (const listener of listeners) {
    try {
      listener(payload);
    } catch {
      // Ignore listener errors so registry hooks remain robust.
    }
  }
}

export function getRxdbDebuggerRegistry(
  options: AutoDiscoveryOptions = {},
): RxdbDebuggerGlobalRegistry | null {
  const globalObject = getGlobalObject();
  if (!globalObject) {
    return null;
  }
  const globalKey = options.globalKey ?? DEFAULT_GLOBAL_KEY;
  const existing = globalObject[globalKey];
  if (existing) {
    return existing as RxdbDebuggerGlobalRegistry;
  }

  const created = createRegistry();
  globalObject[globalKey] = created;
  return created;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function getCollectionEncryptionMetadata(
  collection: RxCollection,
): CollectionDiscoveryMetadata {
  const jsonSchema = collection.schema.jsonSchema as Record<string, unknown>;
  const encryptedFieldPaths = toStringArray(jsonSchema.encrypted);

  let hasEncryptedAttachments = false;
  const attachments = jsonSchema.attachments;
  if (typeof attachments === "object" && attachments !== null) {
    const typed = attachments as { encrypted?: unknown };
    hasEncryptedAttachments = typed.encrypted === true;
  }

  return {
    name: collection.name,
    encryptedFieldPaths,
    hasEncryptedAttachments,
  };
}

function refreshLogicalEncryptionProfile(
  logicalDatabase: LogicalDatabaseMetadata,
): void {
  const collectionValues = Object.values(logicalDatabase.collections);
  logicalDatabase.hasEncryptedFields = collectionValues.some(
    (entry) => entry.encryptedFieldPaths.length > 0
  );
  logicalDatabase.hasEncryptedAttachments = collectionValues.some(
    (entry) => entry.hasEncryptedAttachments
  );
  logicalDatabase.collectionNames = Object.keys(logicalDatabase.collections).sort();
  logicalDatabase.updatedAt = Date.now();
}

function setInstanceStatus(
  registry: RegistryWithInternals,
  instanceId: string,
  status: DatabaseLifecycleStatus,
): void {
  const now = Date.now();
  const instance = registry.instances[instanceId];
  if (!instance) {
    return;
  }
  const previousStatus = instance.status;
  instance.status = status;
  instance.updatedAt = now;

  const logicalDatabase = registry.logicalDatabases[instance.logicalDatabaseId];
  if (!logicalDatabase) {
    return;
  }

  const allInstances = Object.values(registry.instances).filter(
    (entry) => entry.logicalDatabaseId === logicalDatabase.id
  );
  logicalDatabase.openInstanceCount = allInstances.filter(
    (entry) => entry.status === "open"
  ).length;
  logicalDatabase.totalInstanceCount = allInstances.length;
  if (status === "removed") {
    logicalDatabase.status = "removed";
  } else if (logicalDatabase.openInstanceCount > 0) {
    logicalDatabase.status = "open";
  } else if (allInstances.some((entry) => entry.status === "closing")) {
    logicalDatabase.status = "closing";
  } else if (allInstances.length > 0) {
    logicalDatabase.status = "closed";
  }
  logicalDatabase.updatedAt = now;

  if (previousStatus === status && status !== "removed") {
    return;
  }

  notifyRegistryChange(registry, {
    type: status === "removed" ? "instance-removed" : "instance-status-changed",
    logicalDatabaseId: logicalDatabase.id,
    instanceId,
    status,
  });
}

function getStorageIdentityKey(storageName: string, dbName: string): string {
  return `${storageName}|${dbName}`;
}

function registerCollectionsFromDatabase(
  registry: RegistryWithInternals,
  logicalId: string,
  instanceId: string,
  database: RxDatabase,
): void {
  const logicalDatabase = registry.logicalDatabases[logicalId];
  const instance = registry.instances[instanceId];
  if (!logicalDatabase || !instance) {
    return;
  }

  for (const [collectionName, collectionValue] of Object.entries(database.collections)) {
    const collection = collectionValue as RxCollection;
    const metadata = getCollectionEncryptionMetadata(collection);
    logicalDatabase.collections[collectionName] = metadata;
  }

  instance.collectionNames = Object.keys(database.collections).sort();
  refreshLogicalEncryptionProfile(logicalDatabase);
}

async function registerDatabase(
  registry: RegistryWithInternals,
  payload: DatabaseHookPayload,
): Promise<void> {
  const { database, creator } = payload;
  const now = Date.now();
  const storageName = database.storage.name;
  const storageIdentityKey = getStorageIdentityKey(storageName, database.name);
  let logicalId = registry.__internals.logicalIdByIdentity.get(storageIdentityKey);

  let storageToken: string | null = null;
  try {
    storageToken = await database.storageToken;
  } catch {
    storageToken = null;
  }

  if (storageToken) {
    const tokenIdentity = `storage-token:${storageToken}`;
    logicalId = registry.__internals.logicalIdByIdentity.get(tokenIdentity) ?? logicalId;
  }

  if (!logicalId) {
    registry.__internals.nextLogicalId += 1;
    logicalId = `logical-${registry.__internals.nextLogicalId}`;
  }

  const existingLogical = registry.logicalDatabases[logicalId];
  if (!existingLogical) {
    registry.logicalDatabases[logicalId] = {
      id: logicalId,
      name: database.name,
      storageName,
      multiInstance: database.multiInstance,
      hasPasswordConfigured: creator.password !== undefined && creator.password !== null,
      status: "open",
      createdAt: now,
      updatedAt: now,
      openInstanceCount: 0,
      totalInstanceCount: 0,
      hasEncryptedFields: false,
      hasEncryptedAttachments: false,
      collections: {},
      collectionNames: [],
    };
  } else {
    existingLogical.status = "open";
    existingLogical.updatedAt = now;
    existingLogical.hasPasswordConfigured =
      existingLogical.hasPasswordConfigured
      || (creator.password !== undefined && creator.password !== null);
  }

  registry.__internals.logicalIdByIdentity.set(storageIdentityKey, logicalId);
  if (storageToken) {
    registry.__internals.logicalIdByIdentity.set(`storage-token:${storageToken}`, logicalId);
    registry.__internals.storageTokenByLogicalId.set(logicalId, storageToken);
  }

  const instanceId = `instance-${database.token}`;
  registry.instances[instanceId] = {
    id: instanceId,
    logicalDatabaseId: logicalId,
    name: database.name,
    storageName,
    multiInstance: database.multiInstance,
    status: "open",
    instanceToken: database.token,
    createdAt: now,
    updatedAt: now,
    collectionNames: Object.keys(database.collections).sort(),
  };
  registry.__internals.handles.set(instanceId, database);
  registry.__internals.logicalIdByInstanceId.set(instanceId, logicalId);
  registry.__internals.instanceIdByDatabase.set(database as object, instanceId);

  registerCollectionsFromDatabase(registry, logicalId, instanceId, database);
  setInstanceStatus(registry, instanceId, "open");
  notifyRegistryChange(registry, {
    type: "instance-registered",
    logicalDatabaseId: logicalId,
    instanceId,
    status: "open",
  });

  database.onClose.push(() => {
    setInstanceStatus(registry, instanceId, "closed");
    registry.__internals.handles.delete(instanceId);
  });
}

function registerCollection(
  registry: RegistryWithInternals,
  payload: CreateCollectionPayload,
): void {
  const { collection } = payload;
  const databaseObject = collection.database as unknown as object;
  const instanceId = registry.__internals.instanceIdByDatabase.get(databaseObject);
  if (!instanceId) {
    return;
  }

  const logicalId = registry.__internals.logicalIdByInstanceId.get(instanceId);
  if (!logicalId) {
    return;
  }

  const logicalDatabase = registry.logicalDatabases[logicalId];
  const instance = registry.instances[instanceId];
  if (!logicalDatabase || !instance) {
    return;
  }

  logicalDatabase.collections[collection.name] = getCollectionEncryptionMetadata(collection);
  refreshLogicalEncryptionProfile(logicalDatabase);

  const collectionNameSet = new Set(instance.collectionNames);
  collectionNameSet.add(collection.name);
  instance.collectionNames = [...collectionNameSet].sort();
  instance.updatedAt = Date.now();

  notifyRegistryChange(registry, {
    type: "collection-added",
    logicalDatabaseId: logicalId,
    instanceId,
    collectionName: collection.name,
  });
}

function markDatabaseClosing(
  registry: RegistryWithInternals,
  database: RxDatabase,
): void {
  const instanceId = registry.__internals.instanceIdByDatabase.get(database as object);
  if (!instanceId) {
    return;
  }
  setInstanceStatus(registry, instanceId, "closing");
}

function markDatabaseRemoved(
  registry: RegistryWithInternals,
  payload: PostRemoveDatabasePayload,
): void {
  const identityKey = getStorageIdentityKey(payload.storage.name, payload.databaseName);
  const logicalId = registry.__internals.logicalIdByIdentity.get(identityKey);
  if (!logicalId) {
    return;
  }

  const matchingInstances = Object.values(registry.instances).filter(
    (entry) => entry.logicalDatabaseId === logicalId
  );
  for (const instance of matchingInstances) {
    setInstanceStatus(registry, instance.id, "removed");
    registry.__internals.handles.delete(instance.id);
  }

  const logicalDatabase = registry.logicalDatabases[logicalId];
  if (logicalDatabase) {
    logicalDatabase.status = "removed";
    logicalDatabase.updatedAt = Date.now();
  }
}

function markCollectionRemoved(
  registry: RegistryWithInternals,
  payload: PostRemoveCollectionPayload,
): void {
  const identityKey = getStorageIdentityKey(payload.storage.name, payload.databaseName);
  const logicalId = registry.__internals.logicalIdByIdentity.get(identityKey);
  if (!logicalId) {
    return;
  }

  const logicalDatabase = registry.logicalDatabases[logicalId];
  if (!logicalDatabase) {
    return;
  }

  if (logicalDatabase.collections[payload.collectionName]) {
    delete logicalDatabase.collections[payload.collectionName];
  }
  refreshLogicalEncryptionProfile(logicalDatabase);

  const matchingInstances = Object.values(registry.instances).filter(
    (instance) => instance.logicalDatabaseId === logicalId
  );
  for (const instance of matchingInstances) {
    instance.collectionNames = instance.collectionNames.filter(
      (name) => name !== payload.collectionName
    );
    instance.updatedAt = Date.now();
    notifyRegistryChange(registry, {
      type: "collection-removed",
      logicalDatabaseId: logicalId,
      instanceId: instance.id,
      collectionName: payload.collectionName,
    });
  }
}

export function createRxdbDebuggerAutoDiscoveryPlugin(
  options: AutoDiscoveryOptions = {},
): RxPlugin {
  const registry = getRxdbDebuggerRegistry(options) as RegistryWithInternals | null;

  return {
    name: PLUGIN_NAME,
    rxdb: true,
    hooks: {
      createRxDatabase: {
        after: async (payload) => {
          if (!registry) {
            return;
          }
          await registerDatabase(registry, payload as DatabaseHookPayload);
        },
      },
      createRxCollection: {
        after: (payload) => {
          if (!registry) {
            return;
          }
          registerCollection(registry, payload as CreateCollectionPayload);
        },
      },
      preCloseRxDatabase: {
        before: (database) => {
          if (!registry) {
            return;
          }
          markDatabaseClosing(registry, database as RxDatabase);
        },
      },
      postRemoveRxDatabase: {
        after: (payload) => {
          if (!registry) {
            return;
          }
          markDatabaseRemoved(registry, payload as PostRemoveDatabasePayload);
        },
      },
      postRemoveRxCollection: {
        after: (payload) => {
          if (!registry) {
            return;
          }
          markCollectionRemoved(registry, payload as PostRemoveCollectionPayload);
        },
      },
    },
  };
}

export function installRxdbDebuggerAutoDiscovery(
  options: AutoDiscoveryOptions = {},
): void {
  const globalObject = getGlobalObject();
  if (!globalObject) {
    return;
  }
  if (globalObject[INSTALL_FLAG_KEY] === true) {
    return;
  }

  const plugin = createRxdbDebuggerAutoDiscoveryPlugin(options);
  try {
    addRxPlugin(plugin);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("PL3")) {
      throw error;
    }
  }
  globalObject[INSTALL_FLAG_KEY] = true;
}

