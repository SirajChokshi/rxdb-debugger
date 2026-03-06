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
import { installRxdbDebuggerAutoDiscovery } from "@rxdb-debugger/core";
import { Subject } from "rxjs";
import { ARTISTS, ALBUMS, SONGS, USERS, PLAYLISTS, PLAYLIST_SONGS } from "./data/index.js";
import { getAlbumCoverUrl, getArtistImageUrl } from "./media";

export { ARTISTS, ALBUMS, SONGS, USERS, PLAYLISTS, PLAYLIST_SONGS };

installRxdbDebuggerAutoDiscovery();

const ENABLE_EXAMPLE_ENCRYPTION =
  import.meta.env.VITE_RXDB_DEBUGGER_ENABLE_ENCRYPTION === "true";
const EXAMPLE_DB_PASSWORD =
  import.meta.env.VITE_RXDB_DEBUGGER_DB_PASSWORD || "rxdb-debugger-demo-password";
const EXAMPLE_DATABASE_NAME =
  ENABLE_EXAMPLE_ENCRYPTION ? "musiccatalog-encrypted" : "musiccatalog";

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

interface FriendPresenceCheckpoint {
  id: string;
  updatedAt: number;
}

interface FriendPresenceDocData {
  id: string;
  friendIndex: number;
  friendName: string;
  avatarColor: string;
  currentSongId: string;
  currentSongTitle: string;
  currentArtistName: string;
  status: "listening";
  updatedAt: number;
}

type FriendPresenceDoc = WithDeleted<FriendPresenceDocData>;
type FriendPresencePullStreamEvent = RxReplicationPullStreamItem<FriendPresenceDocData, FriendPresenceCheckpoint>;

interface MockRemoteFriendPresenceStore {
  tick: number;
  docs: FriendPresenceDoc[];
}

const REMOTE_SONGS_STORAGE_KEY = "rxdb-debugger-mock-remote-songs-v1";
const SONGS_REPLICATION_IDENTIFIER = "mock-songs-sync";
const REMOTE_SONG_UPDATE_INTERVAL_MS = 8000;
const REMOTE_FRIEND_PRESENCE_STORAGE_KEY = "rxdb-debugger-mock-friend-presence-v1";
const FRIEND_PRESENCE_REPLICATION_IDENTIFIER = "mock-friends-presence-sync";
const FRIEND_PRESENCE_UPDATE_INTERVAL_MS = 30000;
const FRIEND_IDENTITIES = [
  { id: "friend-ava", friendName: "Ava", avatarColor: "#22c55e" },
  { id: "friend-liam", friendName: "Liam", avatarColor: "#f97316" },
  { id: "friend-maya", friendName: "Maya", avatarColor: "#a855f7" },
  { id: "friend-noah", friendName: "Noah", avatarColor: "#06b6d4" },
  { id: "friend-zoe", friendName: "Zoe", avatarColor: "#eab308" },
  { id: "friend-leo", friendName: "Leo", avatarColor: "#ef4444" },
] as const;

const songsPullStream$ = new Subject<MockPullStreamEvent>();
const friendPresencePullStream$ = new Subject<FriendPresencePullStreamEvent>();
let songsSyncInterval: ReturnType<typeof setInterval> | null = null;
let friendPresenceSyncInterval: ReturnType<typeof setInterval> | null = null;
let songsReplicationStarted = false;
let friendPresenceReplicationStarted = false;

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

function compareFriendPresenceByCheckpoint(
  a: FriendPresenceCheckpoint,
  b: FriendPresenceCheckpoint,
): number {
  if (a.updatedAt !== b.updatedAt) {
    return a.updatedAt - b.updatedAt;
  }
  return a.id.localeCompare(b.id);
}

function isFriendPresenceAfterCheckpoint(
  doc: FriendPresenceDoc,
  checkpoint: FriendPresenceCheckpoint | undefined,
): boolean {
  if (!checkpoint) return true;
  return compareFriendPresenceByCheckpoint(
    { id: doc.id, updatedAt: doc.updatedAt },
    checkpoint,
  ) > 0;
}

function toFriendPresenceCheckpoint(doc: FriendPresenceDoc): FriendPresenceCheckpoint {
  return {
    id: doc.id,
    updatedAt: doc.updatedAt,
  };
}

function cloneFriendPresenceDoc(doc: FriendPresenceDoc): FriendPresenceDoc {
  return {
    ...doc,
  };
}

function normalizeFriendPresenceDoc(data: unknown): FriendPresenceDoc | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const source = data as Record<string, unknown>;
  if (
    typeof source.id !== "string"
    || typeof source.friendIndex !== "number"
    || typeof source.friendName !== "string"
    || typeof source.currentSongId !== "string"
    || typeof source.currentSongTitle !== "string"
    || typeof source.currentArtistName !== "string"
  ) {
    return null;
  }

  return {
    id: source.id,
    friendIndex: source.friendIndex,
    friendName: source.friendName,
    avatarColor: typeof source.avatarColor === "string" ? source.avatarColor : "#64748b",
    currentSongId: source.currentSongId,
    currentSongTitle: source.currentSongTitle,
    currentArtistName: source.currentArtistName,
    status: "listening",
    updatedAt: typeof source.updatedAt === "number" ? source.updatedAt : Date.now(),
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

function getArtistNameById(artistId: string): string {
  const artist = ARTISTS.find((entry) => entry.id === artistId);
  return artist?.name ?? "Unknown Artist";
}

function createDefaultFriendPresenceDocs(now: number): FriendPresenceDoc[] {
  return FRIEND_IDENTITIES.map((friend, index) => {
    const seedSong = getSeedSongByIndex(index * 3 + 1);
    return {
      id: friend.id,
      friendIndex: index,
      friendName: friend.friendName,
      avatarColor: friend.avatarColor,
      currentSongId: seedSong.id,
      currentSongTitle: seedSong.title,
      currentArtistName: getArtistNameById(seedSong.artistId),
      status: "listening",
      updatedAt: now - index * 1000,
      _deleted: false,
    };
  });
}

function loadRemoteFriendPresenceStore(): MockRemoteFriendPresenceStore {
  const now = Date.now();
  if (typeof localStorage === "undefined") {
    return {
      tick: 0,
      docs: createDefaultFriendPresenceDocs(now),
    };
  }

  try {
    const raw = localStorage.getItem(REMOTE_FRIEND_PRESENCE_STORAGE_KEY);
    if (!raw) {
      const initialStore: MockRemoteFriendPresenceStore = {
        tick: 0,
        docs: createDefaultFriendPresenceDocs(now),
      };
      saveRemoteFriendPresenceStore(initialStore);
      return initialStore;
    }

    const parsed = JSON.parse(raw) as { tick?: unknown; docs?: unknown };
    const docs = Array.isArray(parsed.docs)
      ? parsed.docs
        .map(normalizeFriendPresenceDoc)
        .filter((doc): doc is FriendPresenceDoc => !!doc)
        .sort((a, b) =>
          compareFriendPresenceByCheckpoint(
            toFriendPresenceCheckpoint(a),
            toFriendPresenceCheckpoint(b),
          ))
      : [];

    if (docs.length === 0) {
      const fallbackStore: MockRemoteFriendPresenceStore = {
        tick: typeof parsed.tick === "number" ? parsed.tick : 0,
        docs: createDefaultFriendPresenceDocs(now),
      };
      saveRemoteFriendPresenceStore(fallbackStore);
      return fallbackStore;
    }

    return {
      tick: typeof parsed.tick === "number" ? parsed.tick : 0,
      docs,
    };
  } catch {
    const fallbackStore: MockRemoteFriendPresenceStore = {
      tick: 0,
      docs: createDefaultFriendPresenceDocs(now),
    };
    saveRemoteFriendPresenceStore(fallbackStore);
    return fallbackStore;
  }
}

function saveRemoteFriendPresenceStore(store: MockRemoteFriendPresenceStore): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(
    REMOTE_FRIEND_PRESENCE_STORAGE_KEY,
    JSON.stringify({
      tick: store.tick,
      docs: store.docs.map(cloneFriendPresenceDoc),
    }),
  );
}

function emitFriendPresenceChanges(docs: FriendPresenceDoc[]): void {
  if (docs.length === 0) {
    return;
  }

  const sorted = [...docs].sort((a, b) =>
    compareFriendPresenceByCheckpoint(
      toFriendPresenceCheckpoint(a),
      toFriendPresenceCheckpoint(b),
    ));

  friendPresencePullStream$.next({
    documents: sorted.map(cloneFriendPresenceDoc),
    checkpoint: toFriendPresenceCheckpoint(sorted[sorted.length - 1]!),
  });
}

function runFriendPresenceMutationTick(): void {
  const now = Date.now();
  const store = loadRemoteFriendPresenceStore();
  store.tick += 1;

  const updatedDocs = store.docs.map((doc) => {
    const deterministicNoise = Math.floor(
      Math.abs(Math.sin((store.tick + 1) * (doc.friendIndex + 2))) * 1000
    );
    const songPoolSize = Math.max(SONGS.length, 1);
    const songIndex = normalizeModulo(
      store.tick * 5 + doc.friendIndex * 11 + deterministicNoise,
      songPoolSize,
    );
    const nextSong = getSeedSongByIndex(songIndex);

    return {
      ...doc,
      currentSongId: nextSong.id,
      currentSongTitle: nextSong.title,
      currentArtistName: getArtistNameById(nextSong.artistId),
      updatedAt: now + doc.friendIndex,
      _deleted: false,
    };
  });

  store.docs = updatedDocs;
  saveRemoteFriendPresenceStore(store);
  emitFriendPresenceChanges(updatedDocs);
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

export function setupMockFriendPresenceReplication(db: RxDatabase): void {
  if (friendPresenceReplicationStarted) {
    return;
  }

  const friendPresenceCollection = db.collections.friendPresence;
  if (!friendPresenceCollection) {
    return;
  }

  friendPresenceReplicationStarted = true;

  replicateRxCollection<FriendPresenceDocData, FriendPresenceCheckpoint>({
    collection: friendPresenceCollection as unknown as never,
    replicationIdentifier: FRIEND_PRESENCE_REPLICATION_IDENTIFIER,
    live: true,
    waitForLeadership: false,
    retryTime: 2000,
    pull: {
      batchSize: 20,
      handler: async (checkpoint, batchSize) => {
        const store = loadRemoteFriendPresenceStore();
        const docs = store.docs
          .filter((doc) => isFriendPresenceAfterCheckpoint(doc, checkpoint))
          .sort((a, b) =>
            compareFriendPresenceByCheckpoint(
              toFriendPresenceCheckpoint(a),
              toFriendPresenceCheckpoint(b),
            ))
          .slice(0, batchSize)
          .map(cloneFriendPresenceDoc);

        return {
          documents: docs,
          checkpoint: docs.length > 0 ? toFriendPresenceCheckpoint(docs[docs.length - 1]!) : checkpoint,
        };
      },
      stream$: friendPresencePullStream$.asObservable(),
    },
  });

  if (!friendPresenceSyncInterval) {
    friendPresenceSyncInterval = setInterval(
      runFriendPresenceMutationTick,
      FRIEND_PRESENCE_UPDATE_INTERVAL_MS,
    );
  }
}

export function setupMockReplications(db: RxDatabase): void {
  setupMockSongsReplication(db);
  setupMockFriendPresenceReplication(db);
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
    subscriptionType: { type: "string", enum: ["free", "premium", "family"] },
    country: { type: "string" },
    birthDate: { type: "string" },
    createdAt: { type: "number" },
    lastActiveAt: { type: "number" },
  },
  required: ["id", "username", "email", "subscriptionType", "createdAt"],
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

const friendPresenceSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    friendIndex: { type: "integer" },
    friendName: { type: "string" },
    avatarColor: { type: "string" },
    currentSongId: { type: "string", ref: "songs" },
    currentSongTitle: { type: "string" },
    currentArtistName: { type: "string" },
    status: { type: "string", enum: ["listening"] },
    updatedAt: { type: "number" },
  },
  required: [
    "id",
    "friendIndex",
    "friendName",
    "avatarColor",
    "currentSongId",
    "currentSongTitle",
    "currentArtistName",
    "status",
    "updatedAt",
  ],
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
        friendPresence: { schema: friendPresenceSchema },
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
    USERS.map((user) => ({ ...user, avatarUrl: "", createdAt: now, lastActiveAt: now }))
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
