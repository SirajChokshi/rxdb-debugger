import { createRxDatabase, type RxDatabase } from "rxdb";
import { replicateRxCollection } from "rxdb/plugins/replication";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { Subject } from "rxjs";
import { ARTISTS, ALBUMS, SONGS, USERS, PLAYLISTS, PLAYLIST_SONGS } from "./data/index.js";

export { ARTISTS, ALBUMS, SONGS, USERS, PLAYLISTS, PLAYLIST_SONGS };

// ============================================================================
// MOCK SONGS REPLICATION
// ============================================================================

interface SongsCheckpoint {
  id: string;
  updatedAt: number;
}

interface MockSongDoc {
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
  _deleted?: boolean;
}

type MockPullStreamEvent =
  | "RESYNC"
  | {
    documents: MockSongDoc[];
    checkpoint: SongsCheckpoint | undefined;
  };

interface MockRemoteSongsStore {
  docs: MockSongDoc[];
}

const REMOTE_SONGS_STORAGE_KEY = "rxdb-debugger-mock-remote-songs-v1";
const SONGS_REPLICATION_IDENTIFIER = "mock-songs-sync";
const REMOTE_SONG_UPDATE_INTERVAL_MS = 8000;

const songsPullStream$ = new Subject<MockPullStreamEvent>();
let songsSyncInterval: ReturnType<typeof setInterval> | null = null;
let songsReplicationStarted = false;

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
    _deleted: !!doc._deleted,
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

  replicateRxCollection<MockSongDoc, SongsCheckpoint>({
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

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

let dbPromise: Promise<RxDatabase> | null = null;

export function getDatabase(): Promise<RxDatabase> {
  if (!dbPromise) {
    dbPromise = createRxDatabase({
      name: "musiccatalog",
      storage: getRxStorageDexie(),
    }).then(async (db) => {
      await db.addCollections({
        artists: { schema: artistSchema },
        albums: { schema: albumSchema },
        songs: { schema: songSchema },
        users: { schema: userSchema },
        playlists: { schema: playlistSchema },
        playlistSongs: { schema: playlistSongSchema },
        userFollows: { schema: userFollowSchema },
        userLikes: { schema: userLikeSchema },
      });

      // Expose for Chrome extension debugging
      (window as unknown as { __rxdb_handle: RxDatabase }).__rxdb_handle = db;

      return db;
    });
  }
  return dbPromise;
}

// ============================================================================
// SEED FUNCTION
// ============================================================================

export async function seedDatabase(db: RxDatabase): Promise<void> {
  const now = Date.now();

  // Seed Artists
  await db.collections.artists.bulkInsert(
    ARTISTS.map((a) => ({ ...a, imageUrl: `https://picsum.photos/seed/${a.id}/300/300`, createdAt: now }))
  );

  // Seed Albums
  await db.collections.albums.bulkInsert(
    ALBUMS.map((a) => ({ ...a, coverUrl: `https://picsum.photos/seed/${a.id}/300/300`, durationMs: a.totalTracks * 240000, createdAt: now }))
  );

  // Seed Songs
  await db.collections.songs.bulkInsert(
    SONGS.map((s) => ({
      ...s,
      isExplicit: Math.random() > 0.8,
      releaseDate: `${ALBUMS.find(a => a.id === s.albumId)?.releaseYear || 2000}-01-01`,
      createdAt: now,
      updatedAt: now,
    }))
  );

  // Seed Users
  await db.collections.users.bulkInsert(
    USERS.map((u) => ({ ...u, avatarUrl: `https://picsum.photos/seed/${u.id}/100/100`, createdAt: now, lastActiveAt: now }))
  );

  // Seed Playlists
  await db.collections.playlists.bulkInsert(
    PLAYLISTS.map((p) => ({ ...p, coverUrl: `https://picsum.photos/seed/${p.id}/300/300`, createdAt: now, updatedAt: now }))
  );

  // Seed Playlist Songs
  await db.collections.playlistSongs.bulkInsert(
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
  await db.collections.userFollows.bulkInsert(userFollows);

  // Seed User Likes (random likes)
  const userLikes = [];
  for (const user of USERS) {
    const randomSongs = SONGS.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 20) + 10);
    for (const song of randomSongs) {
      userLikes.push({ id: `like-${user.id}-${song.id}`, userId: user.id, songId: song.id, likedAt: now - Math.random() * 86400000 * 60 });
    }
  }
  await db.collections.userLikes.bulkInsert(userLikes);
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
