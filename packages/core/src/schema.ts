import type { RxCollection, RxDatabase, RxJsonSchema } from "rxdb/plugins/core";
import { createStaticQuery, type ExplorerQuery } from "./query.js";

/**
 * Primitive type names for schema properties.
 */
export type PropertyType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object"
  | "null"
  | "unknown";

/**
 * Detailed information about a schema property.
 */
export interface PropertyInfo {
  /** Property path (e.g., "address.street") */
  path: string;
  /** Property name (last segment of path) */
  name: string;
  /** Property type */
  type: PropertyType;
  /** Property description from schema */
  description?: string;
  /** Whether this property is required */
  required: boolean;
  /** Maximum string length */
  maxLength?: number;
  /** Minimum value for numbers */
  minimum?: number;
  /** Maximum value for numbers */
  maximum?: number;
  /** Regex pattern for strings */
  pattern?: string;
  /** Enum values if constrained */
  enum?: unknown[];
  /** Reference to another collection (foreign key) */
  ref?: string;
  /** Default value if specified */
  default?: unknown;
  /** For arrays: item type info */
  items?: PropertyInfo;
  /** For objects: nested properties */
  properties?: PropertyInfo[];
}

/**
 * Index information.
 */
export interface IndexInfo {
  /** Index fields */
  fields: string[];
  /** Whether this is a compound index */
  compound: boolean;
}

/**
 * Detailed schema information for a collection.
 */
export interface SchemaDetails {
  /** Collection name */
  name: string;
  /** Schema version */
  version: number;
  /** Primary key field name */
  primaryKey: string;
  /** All properties with detailed info */
  properties: PropertyInfo[];
  /** Required field names */
  required: string[];
  /** Index definitions */
  indexes: IndexInfo[];
  /** Original RxJsonSchema */
  raw: RxJsonSchema<unknown>;
}

/**
 * Relationship between collections via ref fields.
 */
export interface Relationship {
  /** Source collection and field */
  from: { collection: string; field: string };
  /** Target collection */
  to: { collection: string };
}

/**
 * Service for inspecting collection schemas.
 */
export interface SchemaService {
  /**
   * Get detailed schema information for a collection.
   */
  getSchema(collectionName: string): ExplorerQuery<SchemaDetails | null>;

  /**
   * Get all relationships between collections (via ref fields).
   */
  getRelationships(): ExplorerQuery<Relationship[]>;

  /**
   * Get all schemas for all collections.
   */
  getAllSchemas(): ExplorerQuery<SchemaDetails[]>;
}

/**
 * Determine the type of a JSON Schema property.
 */
function getPropertyType(prop: Record<string, unknown>): PropertyType {
  const type = prop.type;
  if (typeof type === "string") {
    if (
      type === "string" ||
      type === "number" ||
      type === "integer" ||
      type === "boolean" ||
      type === "array" ||
      type === "object" ||
      type === "null"
    ) {
      return type;
    }
  }
  if (Array.isArray(type)) {
    const nonNull = type.filter((t) => t !== "null");
    if (nonNull.length === 1) {
      return getPropertyType({ type: nonNull[0] });
    }
  }
  return "unknown";
}

/**
 * Parse a JSON Schema property into PropertyInfo.
 */
function parseProperty(
  name: string,
  prop: Record<string, unknown>,
  path: string,
  requiredFields: string[],
): PropertyInfo {
  const fullPath = path ? `${path}.${name}` : name;
  const type = getPropertyType(prop);

  const info: PropertyInfo = {
    path: fullPath,
    name,
    type,
    required: requiredFields.includes(name),
  };

  if (typeof prop.description === "string") {
    info.description = prop.description;
  }
  if (typeof prop.maxLength === "number") {
    info.maxLength = prop.maxLength;
  }
  if (typeof prop.minimum === "number") {
    info.minimum = prop.minimum;
  }
  if (typeof prop.maximum === "number") {
    info.maximum = prop.maximum;
  }
  if (typeof prop.pattern === "string") {
    info.pattern = prop.pattern;
  }
  if (Array.isArray(prop.enum)) {
    info.enum = prop.enum;
  }
  if (typeof prop.ref === "string") {
    info.ref = prop.ref;
  }
  if (prop.default !== undefined) {
    info.default = prop.default;
  }

  if (type === "array" && prop.items && typeof prop.items === "object") {
    const itemsObj = prop.items as Record<string, unknown>;
    info.items = parseProperty("[]", itemsObj, fullPath, []);
    info.items.path = `${fullPath}[]`;
    info.items.name = "[]";
  }

  if (type === "object" && prop.properties && typeof prop.properties === "object") {
    const nested = prop.properties as Record<string, Record<string, unknown>>;
    const nestedRequired = Array.isArray(prop.required)
      ? (prop.required as string[])
      : [];
    info.properties = Object.entries(nested).map(([key, value]) =>
      parseProperty(key, value, fullPath, nestedRequired),
    );
  }

  return info;
}

/**
 * Parse all properties from a JSON Schema.
 */
function parseSchemaProperties(schema: RxJsonSchema<unknown>): PropertyInfo[] {
  const properties = schema.properties as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!properties) {
    return [];
  }

  const requiredFields = Array.isArray(schema.required)
    ? (schema.required as string[])
    : [];

  return Object.entries(properties).map(([name, prop]) =>
    parseProperty(name, prop, "", requiredFields),
  );
}

/**
 * Parse index definitions from a schema.
 */
function parseIndexes(schema: RxJsonSchema<unknown>): IndexInfo[] {
  const indexes = schema.indexes;
  if (!indexes || !Array.isArray(indexes)) {
    return [];
  }

  return indexes.map((idx) => {
    if (typeof idx === "string") {
      return { fields: [idx], compound: false };
    }
    if (Array.isArray(idx)) {
      return { fields: idx as string[], compound: idx.length > 1 };
    }
    return { fields: [], compound: false };
  });
}

/**
 * Get the primary key from a schema.
 */
function getPrimaryKey(schema: RxJsonSchema<unknown>): string {
  if (typeof schema.primaryKey === "string") {
    return schema.primaryKey;
  }
  if (
    schema.primaryKey &&
    typeof schema.primaryKey === "object" &&
    "key" in schema.primaryKey
  ) {
    return (schema.primaryKey as { key: string }).key;
  }
  return "id";
}

/**
 * Parse a collection schema into SchemaDetails.
 */
function parseSchemaDetails(
  collection: RxCollection,
): SchemaDetails {
  const schema = collection.schema.jsonSchema;
  const properties = parseSchemaProperties(schema);
  const indexes = parseIndexes(schema);
  const primaryKey = getPrimaryKey(schema);
  const required = Array.isArray(schema.required)
    ? (schema.required as string[])
    : [];

  return {
    name: collection.name,
    version: schema.version ?? 0,
    primaryKey,
    properties,
    required,
    indexes,
    raw: schema,
  };
}

/**
 * Find all relationships from ref fields across collections.
 */
function findRelationships(
  schemas: SchemaDetails[],
): Relationship[] {
  const relationships: Relationship[] = [];

  function findRefsInProperties(
    collectionName: string,
    properties: PropertyInfo[],
  ): void {
    for (const prop of properties) {
      if (prop.ref) {
        relationships.push({
          from: { collection: collectionName, field: prop.path },
          to: { collection: prop.ref },
        });
      }
      if (prop.properties) {
        findRefsInProperties(collectionName, prop.properties);
      }
      if (prop.items?.ref) {
        relationships.push({
          from: { collection: collectionName, field: prop.items.path },
          to: { collection: prop.items.ref },
        });
      }
      if (prop.items?.properties) {
        findRefsInProperties(collectionName, prop.items.properties);
      }
    }
  }

  for (const schema of schemas) {
    findRefsInProperties(schema.name, schema.properties);
  }

  return relationships;
}

/**
 * Create the schema service for a database.
 */
export function createSchemaService(
  getDb: () => Promise<RxDatabase>,
): SchemaService {
  return {
    getSchema(collectionName: string): ExplorerQuery<SchemaDetails | null> {
      return createStaticQuery(async () => {
        const db = await getDb();
        const collection = db.collections[collectionName] as
          | RxCollection
          | undefined;
        if (!collection) {
          return null;
        }
        return parseSchemaDetails(collection);
      });
    },

    getRelationships(): ExplorerQuery<Relationship[]> {
      return createStaticQuery(async () => {
        const db = await getDb();
        const schemas: SchemaDetails[] = [];
        for (const collection of Object.values(db.collections)) {
          schemas.push(parseSchemaDetails(collection as RxCollection));
        }
        return findRelationships(schemas);
      });
    },

    getAllSchemas(): ExplorerQuery<SchemaDetails[]> {
      return createStaticQuery(async () => {
        const db = await getDb();
        const schemas: SchemaDetails[] = [];
        for (const collection of Object.values(db.collections)) {
          schemas.push(parseSchemaDetails(collection as RxCollection));
        }
        return schemas.sort((a, b) => a.name.localeCompare(b.name));
      });
    },
  };
}
