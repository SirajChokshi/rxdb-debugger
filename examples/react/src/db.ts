import {
  createRxDatabase,
  type RxCollection,
  type RxDatabase,
  type RxReplicationPullStreamItem,
  type WithDeleted,
} from "rxdb";
import { wrappedKeyEncryptionCryptoJsStorage } from "rxdb/plugins/encryption-crypto-js";
import { replicateRxCollection } from "rxdb/plugins/replication";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { installRxdbDebuggerAutoDiscovery } from "rxdb-debugger-plugin";
import { Subject } from "rxjs";
import {
  ARTISTS,
  ALBUMS,
  SONGS,
  USERS,
  PLAYLISTS,
  PLAYLIST_SONGS,
  USER_FRIENDS,
} from "./data/index.js";
import { getAlbumCoverUrl, getArtistImageUrl } from "./media";

export { ARTISTS, ALBUMS, SONGS, USERS, PLAYLISTS, PLAYLIST_SONGS, USER_FRIENDS };

installRxdbDebuggerAutoDiscovery();

const ENABLE_EXAMPLE_ENCRYPTION =
  import.meta.env.VITE_RXDB_DEBUGGER_ENABLE_ENCRYPTION === "true";
const EXAMPLE_DB_PASSWORD =
  import.meta.env.VITE_RXDB_DEBUGGER_DB_PASSWORD || "rxdb-debugger-demo-password";
const EXAMPLE_DATABASE_NAME =
  ENABLE_EXAMPLE_ENCRYPTION ? "musiccatalog-graph-encrypted-v2" : "musiccatalog-graph-v2";
const LOCAL_USER_ID = "user-alice";

function getExampleStorage() {
  const baseStorage = getRxStorageDexie();
  if (!ENABLE_EXAMPLE_ENCRYPTION) {
    return baseStorage;
  }
  return wrappedKeyEncryptionCryptoJsStorage({
    storage: baseStorage,
  });
}

function withOptionalEncryptedFields<T extends Record<string, unknown>>(
  schema: T,
  encryptedFields: string[],
): T & { encrypted?: string[] } {
  if (!ENABLE_EXAMPLE_ENCRYPTION) {
    return schema;
  }
  return {
    ...schema,
    encrypted: encryptedFields,
  };
}

// ============================================================================
// MOCK SONGS REPLICATION
// ============================================================================

interface SongsCheckpoint {
  id: string;
  updatedAt: number;
}

interface MockSongDocData {
  id: string;
  title: string;
  artistId: string;
  albumId: string;
  trackNumber: number;
  durationMs: number;
  genre: string;
  isExplicit: boolean;
  playCount: number;
  releaseDate: string;
  createdAt: number;
  updatedAt: number;
}

type MockSongDoc = WithDeleted<MockSongDocData>;
type MockPullStreamEvent = RxReplicationPullStreamItem<MockSongDocData, SongsCheckpoint>;

interface MockRemoteSongsStore {
  docs: MockSongDoc[];
}

interface UsersCheckpoint {
  id: string;
  updatedAt: number;
}

interface MockUserDocData {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  avatarColor: string;
  subscriptionType: "free" | "premium" | "family";
  country: string;
  birthDate: string;
  nowPlayingSongId?: string;
  nowPlayingUpdatedAt?: number;
  friendCount: number;
  createdAt: number;
  lastActiveAt: number;
  updatedAt: number;
}

type MockUserDoc = WithDeleted<MockUserDocData>;
type UsersPullStreamEvent = RxReplicationPullStreamItem<MockUserDocData, UsersCheckpoint>;

interface MockRemoteUsersStore {
  tick: number;
  docs: MockUserDoc[];
}

const REMOTE_SONGS_STORAGE_KEY = "rxdb-debugger-mock-remote-songs-v1";
const SONGS_REPLICATION_IDENTIFIER = "mock-songs-sync";
const REMOTE_SONG_UPDATE_INTERVAL_MS = 8000;
const REMOTE_USERS_STORAGE_KEY = "rxdb-debugger-mock-remote-users-v2";
const USERS_REPLICATION_IDENTIFIER = "mock-users-sync";
const USERS_UPDATE_INTERVAL_MS = 30000;

const songsPullStream$ = new Subject<MockPullStreamEvent>();
const usersPullStream$ = new Subject<UsersPullStreamEvent>();
let songsSyncInterval: ReturnType<typeof setInterval> | null = null;
let usersSyncInterval: ReturnType<typeof setInterval> | null = null;
let songsReplicationStarted = false;
let usersReplicationStarted = false;

function compareSongsByCheckpoint(a: SongsCheckpoint, b: SongsCheckpoint): number {
  if (a.updatedAt !== b.updatedAt) {
    return a.updatedAt - b.updatedAt;
  }
  return a.id.localeCompare(b.id);
}

function isAfterCheckpoint(doc: MockSongDoc, checkpoint: SongsCheckpoint | undefined): boolean {
  if (!checkpoint) return true;
  return compareSongsByCheckpoint(
    { id: doc.id, updatedAt: doc.updatedAt },
    checkpoint,
  ) > 0;
}

function toCheckpoint(doc: MockSongDoc): SongsCheckpoint {
  return {
    id: doc.id,
    updatedAt: doc.updatedAt,
  };
}

function cloneSongDoc(doc: MockSongDoc): MockSongDoc {
  return {
    ...doc,
  };
}

function normalizeSongDoc(data: unknown): MockSongDoc | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const source = data as Record<string, unknown>;
  const id = typeof source.id === "string" ? source.id : null;
  const title = typeof source.title === "string" ? source.title : null;
  const artistId = typeof source.artistId === "string" ? source.artistId : null;
  const durationMs = typeof source.durationMs === "number" ? source.durationMs : null;

  if (!id || !title || !artistId || durationMs === null) {
    return null;
  }

  const now = Date.now();
  const createdAt = typeof source.createdAt === "number" ? source.createdAt : now;
  const updatedAt = typeof source.updatedAt === "number" ? source.updatedAt : createdAt;

  return {
    id,
    title,
    artistId,
    albumId: typeof source.albumId === "string" ? source.albumId : "",
    trackNumber: typeof source.trackNumber === "number" ? source.trackNumber : 1,
    durationMs,
    genre: typeof source.genre === "string" ? source.genre : "unknown",
    isExplicit: typeof source.isExplicit === "boolean" ? source.isExplicit : false,
    playCount: typeof source.playCount === "number" ? source.playCount : 0,
    releaseDate: typeof source.releaseDate === "string" ? source.releaseDate : "1970-01-01",
    createdAt,
    updatedAt,
    _deleted: !!source._deleted,
  };
}

function loadRemoteSongsStore(): MockRemoteSongsStore {
  if (typeof localStorage === "undefined") {
    return { docs: [] };
  }

  try {
    const raw = localStorage.getItem(REMOTE_SONGS_STORAGE_KEY);
    if (!raw) {
      return { docs: [] };
    }

    const parsed = JSON.parse(raw) as { docs?: unknown };
    if (!Array.isArray(parsed.docs)) {
      return { docs: [] };
    }

    const docs = parsed.docs
      .map(normalizeSongDoc)
      .filter((doc): doc is MockSongDoc => !!doc)
      .sort((a, b) => compareSongsByCheckpoint(toCheckpoint(a), toCheckpoint(b)));

    return { docs };
  } catch {
    return { docs: [] };
  }
}

function saveRemoteSongsStore(store: MockRemoteSongsStore): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(
    REMOTE_SONGS_STORAGE_KEY,
    JSON.stringify({
      docs: store.docs.map(cloneSongDoc),
    }),
  );
}

function upsertRemoteSong(store: MockRemoteSongsStore, doc: MockSongDoc): void {
  const index = store.docs.findIndex((existing) => existing.id === doc.id);
  if (index >= 0) {
    store.docs[index] = cloneSongDoc(doc);
  } else {
    store.docs.push(cloneSongDoc(doc));
  }
}

function pickRandomIndex(max: number): number {
  return Math.floor(Math.random() * max);
}

function emitRemoteSongChange(doc: MockSongDoc): void {
  songsPullStream$.next({
    documents: [cloneSongDoc(doc)],
    checkpoint: toCheckpoint(doc),
  });
}

function compareUsersByCheckpoint(
  a: UsersCheckpoint,
  b: UsersCheckpoint,
): number {
  if (a.updatedAt !== b.updatedAt) {
    return a.updatedAt - b.updatedAt;
  }
  return a.id.localeCompare(b.id);
}

function isUserAfterCheckpoint(
  doc: MockUserDoc,
  checkpoint: UsersCheckpoint | undefined,
): boolean {
  if (!checkpoint) return true;
  return compareUsersByCheckpoint(
    { id: doc.id, updatedAt: doc.updatedAt },
    checkpoint,
  ) > 0;
}

function toUsersCheckpoint(doc: MockUserDoc): UsersCheckpoint {
  return {
    id: doc.id,
    updatedAt: doc.updatedAt,
  };
}

function cloneUserDoc(doc: MockUserDoc): MockUserDoc {
  return {
    ...doc,
  };
}

function normalizeUserDoc(data: unknown): MockUserDoc | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const source = data as Record<string, unknown>;
  if (
    typeof source.id !== "string"
    || typeof source.username !== "string"
    || typeof source.email !== "string"
    || typeof source.displayName !== "string"
  ) {
    return null;
  }

  const subscriptionType = source.subscriptionType;
  const normalizedSubscriptionType =
    subscriptionType === "free" || subscriptionType === "premium" || subscriptionType === "family"
      ? subscriptionType
      : "free";
  const now = Date.now();
  const createdAt = typeof source.createdAt === "number" ? source.createdAt : now;
  const updatedAt = typeof source.updatedAt === "number" ? source.updatedAt : createdAt;
  const nowPlayingSongId = typeof source.nowPlayingSongId === "string" ? source.nowPlayingSongId : undefined;

  return {
    id: source.id,
    username: source.username,
    email: source.email,
    displayName: source.displayName,
    avatarUrl: typeof source.avatarUrl === "string" ? source.avatarUrl : "",
    avatarColor: typeof source.avatarColor === "string" ? source.avatarColor : "#64748b",
    subscriptionType: normalizedSubscriptionType,
    country: typeof source.country === "string" ? source.country : "Unknown",
    birthDate: typeof source.birthDate === "string" ? source.birthDate : "1970-01-01",
    ...(nowPlayingSongId ? { nowPlayingSongId } : {}),
    ...(typeof source.nowPlayingUpdatedAt === "number"
      ? { nowPlayingUpdatedAt: source.nowPlayingUpdatedAt }
      : nowPlayingSongId
        ? { nowPlayingUpdatedAt: updatedAt }
        : {}),
    friendCount: typeof source.friendCount === "number" ? source.friendCount : 0,
    createdAt,
    lastActiveAt: typeof source.lastActiveAt === "number" ? source.lastActiveAt : updatedAt,
    updatedAt,
    _deleted: !!source._deleted,
  };
}

function normalizeModulo(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function getSeedSongByIndex(index: number) {
  if (SONGS.length === 0) {
    return {
      id: "song-missing",
      title: "Unknown Song",
      artistId: "artist-missing",
    };
  }
  return SONGS[index % SONGS.length]!;
}

function loadRemoteUsersStore(): MockRemoteUsersStore {
  if (typeof localStorage === "undefined") {
    return { tick: 0, docs: [] };
  }

  try {
    const raw = localStorage.getItem(REMOTE_USERS_STORAGE_KEY);
    if (!raw) {
      return { tick: 0, docs: [] };
    }

    const parsed = JSON.parse(raw) as { tick?: unknown; docs?: unknown };
    const docs = Array.isArray(parsed.docs)
      ? parsed.docs
        .map(normalizeUserDoc)
        .filter((doc): doc is MockUserDoc => !!doc)
        .sort((a, b) => compareUsersByCheckpoint(toUsersCheckpoint(a), toUsersCheckpoint(b)))
      : [];

    return {
      tick: typeof parsed.tick === "number" ? parsed.tick : 0,
      docs,
    };
  } catch {
    return { tick: 0, docs: [] };
  }
}

function saveRemoteUsersStore(store: MockRemoteUsersStore): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(
    REMOTE_USERS_STORAGE_KEY,
    JSON.stringify({
      tick: store.tick,
      docs: store.docs.map(cloneUserDoc),
    }),
  );
}

function upsertRemoteUser(store: MockRemoteUsersStore, doc: MockUserDoc): void {
  const index = store.docs.findIndex((existing) => existing.id === doc.id);
  if (index >= 0) {
    store.docs[index] = cloneUserDoc(doc);
  } else {
    store.docs.push(cloneUserDoc(doc));
  }
}

function emitUserChanges(docs: MockUserDoc[]): void {
  if (docs.length === 0) {
    return;
  }

  const sorted = [...docs].sort((a, b) =>
    compareUsersByCheckpoint(toUsersCheckpoint(a), toUsersCheckpoint(b)));

  usersPullStream$.next({
    documents: sorted.map(cloneUserDoc),
    checkpoint: toUsersCheckpoint(sorted[sorted.length - 1]!),
  });
}

function runRemoteUserMutationTick(): void {
  const now = Date.now();
  const store = loadRemoteUsersStore();
  const activeDocs = store.docs.filter((doc) => !doc._deleted && doc.id !== LOCAL_USER_ID);
  if (activeDocs.length === 0) {
    return;
  }

  store.tick += 1;
  const updatedDocs = activeDocs.map((doc, index) => {
    const deterministicNoise = Math.floor(
      Math.abs(Math.sin((store.tick + 1) * (index + 2))) * 1000
    );
    const songPoolSize = Math.max(SONGS.length, 1);
    const songIndex = normalizeModulo(
      store.tick * 5 + index * 11 + deterministicNoise,
      songPoolSize,
    );
    const nextSong = getSeedSongByIndex(songIndex);

    return {
      ...doc,
      nowPlayingSongId: nextSong.id,
      nowPlayingUpdatedAt: now + index,
      lastActiveAt: now + index,
      updatedAt: now + index,
      _deleted: false,
    };
  });

  for (const doc of updatedDocs) {
    upsertRemoteUser(store, doc);
  }
  saveRemoteUsersStore(store);
  emitUserChanges(updatedDocs);
}

function runRemoteSongMutationTick(): void {
  const store = loadRemoteSongsStore();
  const activeDocs = store.docs.filter((doc) => !doc._deleted);
  if (activeDocs.length === 0) {
    return;
  }

  const randomDoc = activeDocs[pickRandomIndex(activeDocs.length)]!;
  const nextDoc: MockSongDoc = {
    ...randomDoc,
    playCount: randomDoc.playCount + (pickRandomIndex(6) + 1) * 10,
    updatedAt: Date.now(),
  };
  upsertRemoteSong(store, nextDoc);
  saveRemoteSongsStore(store);
  emitRemoteSongChange(nextDoc);
}

export function setupMockSongsReplication(db: RxDatabase): void {
  if (songsReplicationStarted) {
    return;
  }

  const songsCollection = db.collections.songs;
  if (!songsCollection) {
    return;
  }

  songsReplicationStarted = true;

  replicateRxCollection<MockSongDocData, SongsCheckpoint>({
    collection: songsCollection as unknown as never,
    replicationIdentifier: SONGS_REPLICATION_IDENTIFIER,
    live: true,
    waitForLeadership: false,
    retryTime: 2000,
    push: {
      batchSize: 20,
      handler: async (rows) => {
        const store = loadRemoteSongsStore();
        const conflicts: MockSongDoc[] = [];
        const baseNow = Date.now();

        for (const row of rows) {
          const nextLocalState = normalizeSongDoc(row.newDocumentState);
          if (!nextLocalState) {
            continue;
          }

          const assumedState = row.assumedMasterState
            ? normalizeSongDoc(row.assumedMasterState)
            : null;
          const remoteCurrent = store.docs.find((doc) => doc.id === nextLocalState.id) ?? null;

          if (remoteCurrent) {
            const hasConflict = !assumedState || remoteCurrent.updatedAt !== assumedState.updatedAt;
            if (hasConflict) {
              conflicts.push(cloneSongDoc(remoteCurrent));
              continue;
            }
          }

          const updatedAt = Math.max(baseNow, nextLocalState.updatedAt);
          upsertRemoteSong(store, {
            ...nextLocalState,
            updatedAt,
          });
        }

        saveRemoteSongsStore(store);
        return conflicts;
      },
    },
    pull: {
      batchSize: 20,
      handler: async (checkpoint, batchSize) => {
        const store = loadRemoteSongsStore();
        const docs = store.docs
          .filter((doc) => isAfterCheckpoint(doc, checkpoint))
          .sort((a, b) => compareSongsByCheckpoint(toCheckpoint(a), toCheckpoint(b)))
          .slice(0, batchSize)
          .map(cloneSongDoc);

        return {
          documents: docs,
          checkpoint: docs.length > 0 ? toCheckpoint(docs[docs.length - 1]!) : checkpoint,
        };
      },
      stream$: songsPullStream$.asObservable(),
    },
  });

  if (!songsSyncInterval) {
    songsSyncInterval = setInterval(runRemoteSongMutationTick, REMOTE_SONG_UPDATE_INTERVAL_MS);
  }
}

export function setupMockUsersReplication(db: RxDatabase): void {
  if (usersReplicationStarted) {
    return;
  }

  const usersCollection = db.collections.users;
  if (!usersCollection) {
    return;
  }

  usersReplicationStarted = true;

  replicateRxCollection<MockUserDocData, UsersCheckpoint>({
    collection: usersCollection as unknown as never,
    replicationIdentifier: USERS_REPLICATION_IDENTIFIER,
    live: true,
    waitForLeadership: false,
    retryTime: 2000,
    push: {
      batchSize: 20,
      handler: async (rows) => {
        const store = loadRemoteUsersStore();
        const conflicts: MockUserDoc[] = [];
        const baseNow = Date.now();

        for (const row of rows) {
          const nextLocalState = normalizeUserDoc(row.newDocumentState);
          if (!nextLocalState) {
            continue;
          }

          const assumedState = row.assumedMasterState
            ? normalizeUserDoc(row.assumedMasterState)
            : null;
          const remoteCurrent = store.docs.find((doc) => doc.id === nextLocalState.id) ?? null;

          if (remoteCurrent) {
            const hasConflict = !assumedState || remoteCurrent.updatedAt !== assumedState.updatedAt;
            if (hasConflict) {
              conflicts.push(cloneUserDoc(remoteCurrent));
              continue;
            }
          }

          const updatedAt = Math.max(baseNow, nextLocalState.updatedAt);
          const nextRemoteUser = {
            ...nextLocalState,
            updatedAt,
            lastActiveAt: Math.max(nextLocalState.lastActiveAt, updatedAt),
            ...(nextLocalState.nowPlayingSongId
              ? {
                nowPlayingUpdatedAt: Math.max(
                  nextLocalState.nowPlayingUpdatedAt ?? updatedAt,
                  updatedAt,
                ),
              }
              : {}),
          };
          upsertRemoteUser(store, nextRemoteUser);
        }

        saveRemoteUsersStore(store);
        return conflicts;
      },
    },
    pull: {
      batchSize: 20,
      handler: async (checkpoint, batchSize) => {
        const store = loadRemoteUsersStore();
        const docs = store.docs
          .filter((doc) => isUserAfterCheckpoint(doc, checkpoint))
          .sort((a, b) => compareUsersByCheckpoint(toUsersCheckpoint(a), toUsersCheckpoint(b)))
          .slice(0, batchSize)
          .map(cloneUserDoc);

        return {
          documents: docs,
          checkpoint: docs.length > 0 ? toUsersCheckpoint(docs[docs.length - 1]!) : checkpoint,
        };
      },
      stream$: usersPullStream$.asObservable(),
    },
  });

  if (!usersSyncInterval) {
    usersSyncInterval = setInterval(runRemoteUserMutationTick, USERS_UPDATE_INTERVAL_MS);
  }
}

export function setupMockReplications(db: RxDatabase): void {
  setupMockSongsReplication(db);
  setupMockUsersReplication(db);
}

function getRequiredCollection<T>(collection: RxCollection<T> | undefined, name: string): RxCollection<T> {
  if (!collection) {
    throw new Error(`Missing required collection: ${name}`);
  }
  return collection;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const artistSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    name: { type: "string" },
    bio: { type: "string" },
    genre: { type: "string" },
    imageUrl: { type: "string" },
    country: { type: "string" },
    formedYear: { type: "integer" },
    isVerified: { type: "boolean" },
    monthlyListeners: { type: "integer" },
    createdAt: { type: "number" },
  },
  required: ["id", "name", "genre", "createdAt"],
} as const;

const albumSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    title: { type: "string" },
    artistId: { type: "string", ref: "artists" },
    releaseYear: { type: "integer" },
    genre: { type: "string" },
    coverUrl: { type: "string" },
    label: { type: "string" },
    totalTracks: { type: "integer" },
    durationMs: { type: "integer" },
    createdAt: { type: "number" },
  },
  required: ["id", "title", "artistId", "releaseYear", "createdAt"],
} as const;

const songSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    title: { type: "string" },
    artistId: { type: "string", ref: "artists" },
    albumId: { type: "string", ref: "albums" },
    trackNumber: { type: "integer" },
    durationMs: { type: "integer" },
    genre: { type: "string" },
    isExplicit: { type: "boolean" },
    playCount: { type: "integer" },
    releaseDate: { type: "string" },
    createdAt: { type: "number" },
    updatedAt: { type: "number" },
  },
  required: ["id", "title", "artistId", "durationMs", "createdAt", "updatedAt"],
} as const;

const userSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    username: { type: "string" },
    email: { type: "string" },
    displayName: { type: "string" },
    avatarUrl: { type: "string" },
    avatarColor: { type: "string" },
    subscriptionType: { type: "string", enum: ["free", "premium", "family"] },
    country: { type: "string" },
    birthDate: { type: "string" },
    nowPlayingSongId: { type: "string", ref: "songs" },
    nowPlayingUpdatedAt: { type: "number" },
    friendCount: { type: "integer" },
    createdAt: { type: "number" },
    lastActiveAt: { type: "number" },
    updatedAt: { type: "number" },
  },
  required: [
    "id",
    "username",
    "email",
    "displayName",
    "avatarUrl",
    "avatarColor",
    "subscriptionType",
    "country",
    "birthDate",
    "friendCount",
    "createdAt",
    "lastActiveAt",
    "updatedAt",
  ],
} as const;

const playlistSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    name: { type: "string" },
    description: { type: "string" },
    ownerId: { type: "string", ref: "users" },
    coverUrl: { type: "string" },
    isPublic: { type: "boolean" },
    isCollaborative: { type: "boolean" },
    followerCount: { type: "integer" },
    createdAt: { type: "number" },
    updatedAt: { type: "number" },
  },
  required: ["id", "name", "ownerId", "isPublic", "createdAt"],
} as const;

const playlistSongSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    playlistId: { type: "string", ref: "playlists" },
    songId: { type: "string", ref: "songs" },
    position: { type: "integer" },
    addedById: { type: "string", ref: "users" },
    addedAt: { type: "number" },
  },
  required: ["id", "playlistId", "songId", "position", "addedAt"],
} as const;

const userFollowSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    userId: { type: "string", ref: "users" },
    artistId: { type: "string", ref: "artists" },
    followedAt: { type: "number" },
  },
  required: ["id", "userId", "artistId", "followedAt"],
} as const;

const userLikeSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    userId: { type: "string", ref: "users" },
    songId: { type: "string", ref: "songs" },
    likedAt: { type: "number" },
  },
  required: ["id", "userId", "songId", "likedAt"],
} as const;

const userFriendSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    userId: { type: "string", ref: "users" },
    friendId: { type: "string", ref: "users" },
    position: { type: "integer" },
    createdAt: { type: "number" },
  },
  required: ["id", "userId", "friendId", "position", "createdAt"],
} as const;

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

let dbPromise: Promise<RxDatabase> | null = null;

export function getDatabase(): Promise<RxDatabase> {
  if (!dbPromise) {
    const artistsSchema = withOptionalEncryptedFields(artistSchema, ["bio"]);
    const usersSchema = withOptionalEncryptedFields(userSchema, ["email", "birthDate"]);

    dbPromise = createRxDatabase({
      name: EXAMPLE_DATABASE_NAME,
      storage: getExampleStorage(),
      ...(ENABLE_EXAMPLE_ENCRYPTION ? { password: EXAMPLE_DB_PASSWORD } : {}),
    }).then(async (db) => {
      await db.addCollections({
        artists: { schema: artistsSchema },
        albums: { schema: albumSchema },
        songs: { schema: songSchema },
        users: { schema: usersSchema },
        playlists: { schema: playlistSchema },
        playlistSongs: { schema: playlistSongSchema },
        userFollows: { schema: userFollowSchema },
        userLikes: { schema: userLikeSchema },
        userFriends: { schema: userFriendSchema },
      });

      return db;
    });
  }
  return dbPromise;
}

// ============================================================================
// SEED FUNCTION
// ============================================================================

function getSeedPlaylistCoverUrl(playlistId: string): string {
  const firstEntry = PLAYLIST_SONGS
    .filter((entry) => entry.playlistId === playlistId)
    .sort((a, b) => a.position - b.position)[0];
  if (!firstEntry) {
    return "";
  }

  const song = SONGS.find((entry) => entry.id === firstEntry.songId);
  if (!song) {
    return "";
  }

  return getAlbumCoverUrl(song.albumId) ?? "";
}

export async function seedDatabase(db: RxDatabase): Promise<void> {
  const now = Date.now();
  const artistsCollection = getRequiredCollection(db.collections.artists, "artists");
  const albumsCollection = getRequiredCollection(db.collections.albums, "albums");
  const songsCollection = getRequiredCollection(db.collections.songs, "songs");
  const usersCollection = getRequiredCollection(db.collections.users, "users");
  const playlistsCollection = getRequiredCollection(db.collections.playlists, "playlists");
  const playlistSongsCollection = getRequiredCollection(db.collections.playlistSongs, "playlistSongs");
  const userFollowsCollection = getRequiredCollection(db.collections.userFollows, "userFollows");
  const userLikesCollection = getRequiredCollection(db.collections.userLikes, "userLikes");
  const userFriendsCollection = getRequiredCollection(db.collections.userFriends, "userFriends");
  const friendCountByUserId = USER_FRIENDS.reduce<Record<string, number>>((counts, edge) => {
    counts[edge.userId] = (counts[edge.userId] ?? 0) + 1;
    counts[edge.friendId] = (counts[edge.friendId] ?? 0) + 1;
    return counts;
  }, {});

  // Seed Artists
  await artistsCollection.bulkInsert(
    ARTISTS.map((artist) => ({
      ...artist,
      imageUrl: getArtistImageUrl(artist.id) ?? "",
      createdAt: now,
    }))
  );

  // Seed Albums
  await albumsCollection.bulkInsert(
    ALBUMS.map((album) => ({
      ...album,
      coverUrl: getAlbumCoverUrl(album.id) ?? "",
      durationMs: album.totalTracks * 240000,
      createdAt: now,
    }))
  );

  // Seed Songs
  await songsCollection.bulkInsert(
    SONGS.map((s) => ({
      ...s,
      isExplicit: Math.random() > 0.8,
      releaseDate: `${ALBUMS.find(a => a.id === s.albumId)?.releaseYear || 2000}-01-01`,
      createdAt: now,
      updatedAt: now,
    }))
  );

  // Seed Users
  await usersCollection.bulkInsert(
    USERS.map((user) => ({
      ...user,
      avatarUrl: "",
      friendCount: friendCountByUserId[user.id] ?? 0,
      createdAt: now,
      lastActiveAt: now,
      updatedAt: now,
      ...(user.nowPlayingSongId ? { nowPlayingUpdatedAt: now } : {}),
    }))
  );

  // Seed Playlists
  await playlistsCollection.bulkInsert(
    PLAYLISTS.map((playlist) => ({
      ...playlist,
      coverUrl: getSeedPlaylistCoverUrl(playlist.id),
      createdAt: now,
      updatedAt: now,
    }))
  );

  // Seed Playlist Songs
  await playlistSongsCollection.bulkInsert(
    PLAYLIST_SONGS.map((ps, i) => ({ ...ps, id: `ps-${i}`, addedAt: now - i * 60000 }))
  );

  // Seed User Follows (random follows)
  const userFollows = [];
  for (const user of USERS) {
    const randomArtists = ARTISTS.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 8) + 3);
    for (const artist of randomArtists) {
      userFollows.push({ id: `follow-${user.id}-${artist.id}`, userId: user.id, artistId: artist.id, followedAt: now - Math.random() * 86400000 * 30 });
    }
  }
  await userFollowsCollection.bulkInsert(userFollows);

  // Seed User Likes (random likes)
  const userLikes = [];
  for (const user of USERS) {
    const randomSongs = SONGS.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 20) + 10);
    for (const song of randomSongs) {
      userLikes.push({ id: `like-${user.id}-${song.id}`, userId: user.id, songId: song.id, likedAt: now - Math.random() * 86400000 * 60 });
    }
  }
  await userLikesCollection.bulkInsert(userLikes);

  await userFriendsCollection.bulkInsert(
    USER_FRIENDS.map((edge) => ({
      ...edge,
      createdAt: now + edge.position,
    }))
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatPlayCount(count: number): string {
  if (count >= 1000000000) return `${(count / 1000000000).toFixed(1)}B`;
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}
