import { createRxDatabase, type RxDatabase } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { ARTISTS, ALBUMS, SONGS, USERS, PLAYLISTS, PLAYLIST_SONGS } from "./data/index.js";

export { ARTISTS, ALBUMS, SONGS, USERS, PLAYLISTS, PLAYLIST_SONGS };

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
  },
  required: ["id", "title", "artistId", "durationMs", "createdAt"],
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
    SONGS.map((s) => ({ ...s, isExplicit: Math.random() > 0.8, releaseDate: `${ALBUMS.find(a => a.id === s.albumId)?.releaseYear || 2000}-01-01`, createdAt: now }))
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
