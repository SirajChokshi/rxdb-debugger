import { createRxDatabase, type RxDatabase } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";

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
// SEED DATA - REAL ARTISTS
// ============================================================================

export const ARTISTS = [
  { id: "artist-beatles", name: "The Beatles", bio: "English rock band formed in Liverpool in 1960", genre: "Rock", country: "UK", formedYear: 1960, isVerified: true, monthlyListeners: 28000000 },
  { id: "artist-pinkfloyd", name: "Pink Floyd", bio: "English rock band formed in London in 1965", genre: "Progressive Rock", country: "UK", formedYear: 1965, isVerified: true, monthlyListeners: 18000000 },
  { id: "artist-ledzeppelin", name: "Led Zeppelin", bio: "English rock band formed in London in 1968", genre: "Hard Rock", country: "UK", formedYear: 1968, isVerified: true, monthlyListeners: 16000000 },
  { id: "artist-michaeljackson", name: "Michael Jackson", bio: "American singer, songwriter, and dancer", genre: "Pop", country: "USA", formedYear: 1964, isVerified: true, monthlyListeners: 32000000 },
  { id: "artist-prince", name: "Prince", bio: "American singer-songwriter and multi-instrumentalist", genre: "Funk", country: "USA", formedYear: 1976, isVerified: true, monthlyListeners: 12000000 },
  { id: "artist-nirvana", name: "Nirvana", bio: "American rock band formed in Aberdeen, Washington", genre: "Grunge", country: "USA", formedYear: 1987, isVerified: true, monthlyListeners: 22000000 },
  { id: "artist-radiohead", name: "Radiohead", bio: "English rock band formed in Abingdon, Oxfordshire", genre: "Alternative Rock", country: "UK", formedYear: 1985, isVerified: true, monthlyListeners: 14000000 },
  { id: "artist-kendrick", name: "Kendrick Lamar", bio: "American rapper and songwriter from Compton", genre: "Hip-Hop", country: "USA", formedYear: 2004, isVerified: true, monthlyListeners: 45000000 },
  { id: "artist-kanye", name: "Kanye West", bio: "American rapper, producer, and fashion designer", genre: "Hip-Hop", country: "USA", formedYear: 1996, isVerified: true, monthlyListeners: 52000000 },
  { id: "artist-taylorswift", name: "Taylor Swift", bio: "American singer-songwriter", genre: "Pop", country: "USA", formedYear: 2004, isVerified: true, monthlyListeners: 85000000 },
  { id: "artist-beyonce", name: "Beyoncé", bio: "American singer, songwriter, and businesswoman", genre: "R&B", country: "USA", formedYear: 1997, isVerified: true, monthlyListeners: 62000000 },
  { id: "artist-fleetwoodmac", name: "Fleetwood Mac", bio: "British-American rock band formed in London", genre: "Rock", country: "UK", formedYear: 1967, isVerified: true, monthlyListeners: 21000000 },
  { id: "artist-steviewonder", name: "Stevie Wonder", bio: "American singer, songwriter, and musician", genre: "R&B", country: "USA", formedYear: 1961, isVerified: true, monthlyListeners: 18000000 },
  { id: "artist-bobdylan", name: "Bob Dylan", bio: "American singer-songwriter and author", genre: "Folk Rock", country: "USA", formedYear: 1961, isVerified: true, monthlyListeners: 12000000 },
  { id: "artist-queen", name: "Queen", bio: "British rock band formed in London in 1970", genre: "Rock", country: "UK", formedYear: 1970, isVerified: true, monthlyListeners: 42000000 },
  { id: "artist-frankocean", name: "Frank Ocean", bio: "American singer, songwriter, and record producer", genre: "R&B", country: "USA", formedYear: 2005, isVerified: true, monthlyListeners: 28000000 },
  { id: "artist-davidbowie", name: "David Bowie", bio: "English singer-songwriter and actor", genre: "Art Rock", country: "UK", formedYear: 1962, isVerified: true, monthlyListeners: 24000000 },
  { id: "artist-u2", name: "U2", bio: "Irish rock band from Dublin", genre: "Rock", country: "Ireland", formedYear: 1976, isVerified: true, monthlyListeners: 20000000 },
];

// ============================================================================
// SEED DATA - REAL ALBUMS
// ============================================================================

export const ALBUMS = [
  // The Beatles
  { id: "album-abbeyroad", title: "Abbey Road", artistId: "artist-beatles", releaseYear: 1969, genre: "Rock", label: "Apple Records", totalTracks: 17 },
  { id: "album-sgtpepper", title: "Sgt. Pepper's Lonely Hearts Club Band", artistId: "artist-beatles", releaseYear: 1967, genre: "Psychedelic Rock", label: "Parlophone", totalTracks: 13 },
  { id: "album-revolver", title: "Revolver", artistId: "artist-beatles", releaseYear: 1966, genre: "Rock", label: "Parlophone", totalTracks: 14 },
  // Pink Floyd
  { id: "album-darkside", title: "The Dark Side of the Moon", artistId: "artist-pinkfloyd", releaseYear: 1973, genre: "Progressive Rock", label: "Harvest", totalTracks: 10 },
  { id: "album-thewishyouwerehere", title: "Wish You Were Here", artistId: "artist-pinkfloyd", releaseYear: 1975, genre: "Progressive Rock", label: "Harvest", totalTracks: 5 },
  // Led Zeppelin
  { id: "album-ledzeppeliniv", title: "Led Zeppelin IV", artistId: "artist-ledzeppelin", releaseYear: 1971, genre: "Hard Rock", label: "Atlantic", totalTracks: 8 },
  { id: "album-physicalgraffiti", title: "Physical Graffiti", artistId: "artist-ledzeppelin", releaseYear: 1975, genre: "Hard Rock", label: "Swan Song", totalTracks: 15 },
  // Michael Jackson
  { id: "album-thriller", title: "Thriller", artistId: "artist-michaeljackson", releaseYear: 1982, genre: "Pop", label: "Epic", totalTracks: 9 },
  { id: "album-bad", title: "Bad", artistId: "artist-michaeljackson", releaseYear: 1987, genre: "Pop", label: "Epic", totalTracks: 11 },
  // Prince
  { id: "album-purplerain", title: "Purple Rain", artistId: "artist-prince", releaseYear: 1984, genre: "Funk", label: "Warner Bros.", totalTracks: 9 },
  { id: "album-1999", title: "1999", artistId: "artist-prince", releaseYear: 1982, genre: "Funk", label: "Warner Bros.", totalTracks: 11 },
  // Nirvana
  { id: "album-nevermind", title: "Nevermind", artistId: "artist-nirvana", releaseYear: 1991, genre: "Grunge", label: "DGC", totalTracks: 12 },
  { id: "album-inutero", title: "In Utero", artistId: "artist-nirvana", releaseYear: 1993, genre: "Grunge", label: "DGC", totalTracks: 12 },
  // Radiohead
  { id: "album-okcomputer", title: "OK Computer", artistId: "artist-radiohead", releaseYear: 1997, genre: "Alternative Rock", label: "Parlophone", totalTracks: 12 },
  { id: "album-kida", title: "Kid A", artistId: "artist-radiohead", releaseYear: 2000, genre: "Electronic", label: "Parlophone", totalTracks: 10 },
  { id: "album-inrainbows", title: "In Rainbows", artistId: "artist-radiohead", releaseYear: 2007, genre: "Alternative Rock", label: "XL", totalTracks: 10 },
  // Kendrick Lamar
  { id: "album-gkmc", title: "good kid, m.A.A.d city", artistId: "artist-kendrick", releaseYear: 2012, genre: "Hip-Hop", label: "TDE", totalTracks: 12 },
  { id: "album-tpab", title: "To Pimp a Butterfly", artistId: "artist-kendrick", releaseYear: 2015, genre: "Hip-Hop", label: "TDE", totalTracks: 16 },
  { id: "album-damn", title: "DAMN.", artistId: "artist-kendrick", releaseYear: 2017, genre: "Hip-Hop", label: "TDE", totalTracks: 14 },
  // Kanye West
  { id: "album-collegedropout", title: "The College Dropout", artistId: "artist-kanye", releaseYear: 2004, genre: "Hip-Hop", label: "Roc-A-Fella", totalTracks: 21 },
  { id: "album-mbdtf", title: "My Beautiful Dark Twisted Fantasy", artistId: "artist-kanye", releaseYear: 2010, genre: "Hip-Hop", label: "Roc-A-Fella", totalTracks: 13 },
  { id: "album-yeezus", title: "Yeezus", artistId: "artist-kanye", releaseYear: 2013, genre: "Hip-Hop", label: "Def Jam", totalTracks: 10 },
  // Taylor Swift
  { id: "album-1989", title: "1989", artistId: "artist-taylorswift", releaseYear: 2014, genre: "Pop", label: "Big Machine", totalTracks: 13 },
  { id: "album-folklore", title: "Folklore", artistId: "artist-taylorswift", releaseYear: 2020, genre: "Indie Folk", label: "Republic", totalTracks: 16 },
  { id: "album-midnights", title: "Midnights", artistId: "artist-taylorswift", releaseYear: 2022, genre: "Pop", label: "Republic", totalTracks: 13 },
  // Beyoncé
  { id: "album-lemonade", title: "Lemonade", artistId: "artist-beyonce", releaseYear: 2016, genre: "R&B", label: "Parkwood", totalTracks: 12 },
  { id: "album-renaissance", title: "Renaissance", artistId: "artist-beyonce", releaseYear: 2022, genre: "Dance", label: "Parkwood", totalTracks: 16 },
  // Fleetwood Mac
  { id: "album-rumours", title: "Rumours", artistId: "artist-fleetwoodmac", releaseYear: 1977, genre: "Rock", label: "Warner Bros.", totalTracks: 11 },
  // Stevie Wonder
  { id: "album-songsinkey", title: "Songs in the Key of Life", artistId: "artist-steviewonder", releaseYear: 1976, genre: "R&B", label: "Tamla", totalTracks: 21 },
  // Frank Ocean
  { id: "album-blonde", title: "Blonde", artistId: "artist-frankocean", releaseYear: 2016, genre: "R&B", label: "Boys Don't Cry", totalTracks: 17 },
  { id: "album-channelorange", title: "Channel Orange", artistId: "artist-frankocean", releaseYear: 2012, genre: "R&B", label: "Def Jam", totalTracks: 17 },
  // David Bowie
  { id: "album-ziggystardust", title: "The Rise and Fall of Ziggy Stardust and the Spiders from Mars", artistId: "artist-davidbowie", releaseYear: 1972, genre: "Glam Rock", label: "RCA", totalTracks: 11 },
  // U2
  { id: "album-joshuatree", title: "The Joshua Tree", artistId: "artist-u2", releaseYear: 1987, genre: "Rock", label: "Island", totalTracks: 11 },
  // Queen
  { id: "album-nightatopera", title: "A Night at the Opera", artistId: "artist-queen", releaseYear: 1975, genre: "Rock", label: "EMI", totalTracks: 12 },
  // Bob Dylan
  { id: "album-highway61", title: "Highway 61 Revisited", artistId: "artist-bobdylan", releaseYear: 1965, genre: "Folk Rock", label: "Columbia", totalTracks: 9 },
];

// ============================================================================
// SEED DATA - REAL SONGS
// ============================================================================

export const SONGS = [
  // Abbey Road
  { id: "song-cometogether", title: "Come Together", artistId: "artist-beatles", albumId: "album-abbeyroad", trackNumber: 1, durationMs: 259000, genre: "Rock", playCount: 1200000000 },
  { id: "song-something", title: "Something", artistId: "artist-beatles", albumId: "album-abbeyroad", trackNumber: 2, durationMs: 182000, genre: "Rock", playCount: 850000000 },
  { id: "song-herecomesthesun", title: "Here Comes the Sun", artistId: "artist-beatles", albumId: "album-abbeyroad", trackNumber: 7, durationMs: 185000, genre: "Rock", playCount: 1500000000 },
  { id: "song-octopusgarden", title: "Octopus's Garden", artistId: "artist-beatles", albumId: "album-abbeyroad", trackNumber: 5, durationMs: 171000, genre: "Rock", playCount: 320000000 },
  // Sgt. Pepper's
  { id: "song-lucyinthesky", title: "Lucy in the Sky with Diamonds", artistId: "artist-beatles", albumId: "album-sgtpepper", trackNumber: 3, durationMs: 207000, genre: "Psychedelic Rock", playCount: 680000000 },
  { id: "song-adayinthelife", title: "A Day in the Life", artistId: "artist-beatles", albumId: "album-sgtpepper", trackNumber: 13, durationMs: 337000, genre: "Psychedelic Rock", playCount: 520000000 },
  // Dark Side of the Moon
  { id: "song-money", title: "Money", artistId: "artist-pinkfloyd", albumId: "album-darkside", trackNumber: 6, durationMs: 382000, genre: "Progressive Rock", playCount: 920000000 },
  { id: "song-time", title: "Time", artistId: "artist-pinkfloyd", albumId: "album-darkside", trackNumber: 4, durationMs: 413000, genre: "Progressive Rock", playCount: 780000000 },
  { id: "song-breathe", title: "Breathe (In the Air)", artistId: "artist-pinkfloyd", albumId: "album-darkside", trackNumber: 2, durationMs: 169000, genre: "Progressive Rock", playCount: 450000000 },
  // Led Zeppelin IV
  { id: "song-stairwaytoheaven", title: "Stairway to Heaven", artistId: "artist-ledzeppelin", albumId: "album-ledzeppeliniv", trackNumber: 4, durationMs: 482000, genre: "Hard Rock", playCount: 1100000000 },
  { id: "song-blackdog", title: "Black Dog", artistId: "artist-ledzeppelin", albumId: "album-ledzeppeliniv", trackNumber: 1, durationMs: 295000, genre: "Hard Rock", playCount: 620000000 },
  { id: "song-rockandroll", title: "Rock and Roll", artistId: "artist-ledzeppelin", albumId: "album-ledzeppeliniv", trackNumber: 2, durationMs: 220000, genre: "Hard Rock", playCount: 480000000 },
  // Thriller
  { id: "song-thriller", title: "Thriller", artistId: "artist-michaeljackson", albumId: "album-thriller", trackNumber: 4, durationMs: 357000, genre: "Pop", playCount: 1800000000 },
  { id: "song-billiejean", title: "Billie Jean", artistId: "artist-michaeljackson", albumId: "album-thriller", trackNumber: 6, durationMs: 294000, genre: "Pop", playCount: 2100000000 },
  { id: "song-beatit", title: "Beat It", artistId: "artist-michaeljackson", albumId: "album-thriller", trackNumber: 5, durationMs: 258000, genre: "Pop", playCount: 1400000000 },
  { id: "song-humanature", title: "Human Nature", artistId: "artist-michaeljackson", albumId: "album-thriller", trackNumber: 7, durationMs: 246000, genre: "Pop", playCount: 680000000 },
  // Purple Rain
  { id: "song-purplerain", title: "Purple Rain", artistId: "artist-prince", albumId: "album-purplerain", trackNumber: 9, durationMs: 521000, genre: "Funk", playCount: 890000000 },
  { id: "song-whendovescry", title: "When Doves Cry", artistId: "artist-prince", albumId: "album-purplerain", trackNumber: 5, durationMs: 352000, genre: "Funk", playCount: 720000000 },
  { id: "song-letsgocrazy", title: "Let's Go Crazy", artistId: "artist-prince", albumId: "album-purplerain", trackNumber: 1, durationMs: 284000, genre: "Funk", playCount: 540000000 },
  // Nevermind
  { id: "song-smellsliketeenspirit", title: "Smells Like Teen Spirit", artistId: "artist-nirvana", albumId: "album-nevermind", trackNumber: 1, durationMs: 301000, genre: "Grunge", playCount: 1900000000 },
  { id: "song-comeasura", title: "Come as You Are", artistId: "artist-nirvana", albumId: "album-nevermind", trackNumber: 3, durationMs: 218000, genre: "Grunge", playCount: 1200000000 },
  { id: "song-lithium", title: "Lithium", artistId: "artist-nirvana", albumId: "album-nevermind", trackNumber: 5, durationMs: 257000, genre: "Grunge", playCount: 780000000 },
  // OK Computer
  { id: "song-paranoidandroid", title: "Paranoid Android", artistId: "artist-radiohead", albumId: "album-okcomputer", trackNumber: 2, durationMs: 383000, genre: "Alternative Rock", playCount: 420000000 },
  { id: "song-karma", title: "Karma Police", artistId: "artist-radiohead", albumId: "album-okcomputer", trackNumber: 6, durationMs: 264000, genre: "Alternative Rock", playCount: 680000000 },
  { id: "song-nosuprises", title: "No Surprises", artistId: "artist-radiohead", albumId: "album-okcomputer", trackNumber: 10, durationMs: 227000, genre: "Alternative Rock", playCount: 520000000 },
  // good kid, m.A.A.d city
  { id: "song-swimmingpools", title: "Swimming Pools (Drank)", artistId: "artist-kendrick", albumId: "album-gkmc", trackNumber: 8, durationMs: 313000, genre: "Hip-Hop", playCount: 1100000000 },
  { id: "song-maadcity", title: "m.A.A.d city", artistId: "artist-kendrick", albumId: "album-gkmc", trackNumber: 10, durationMs: 359000, genre: "Hip-Hop", playCount: 650000000 },
  { id: "song-backseatfreestyle", title: "Backseat Freestyle", artistId: "artist-kendrick", albumId: "album-gkmc", trackNumber: 4, durationMs: 213000, genre: "Hip-Hop", playCount: 520000000 },
  // To Pimp a Butterfly
  { id: "song-alright", title: "Alright", artistId: "artist-kendrick", albumId: "album-tpab", trackNumber: 7, durationMs: 219000, genre: "Hip-Hop", playCount: 980000000 },
  { id: "song-kingkunta", title: "King Kunta", artistId: "artist-kendrick", albumId: "album-tpab", trackNumber: 3, durationMs: 234000, genre: "Hip-Hop", playCount: 720000000 },
  // DAMN.
  { id: "song-humble", title: "HUMBLE.", artistId: "artist-kendrick", albumId: "album-damn", trackNumber: 8, durationMs: 177000, genre: "Hip-Hop", playCount: 2300000000 },
  { id: "song-dna", title: "DNA.", artistId: "artist-kendrick", albumId: "album-damn", trackNumber: 2, durationMs: 185000, genre: "Hip-Hop", playCount: 1400000000 },
  // My Beautiful Dark Twisted Fantasy
  { id: "song-runaway", title: "Runaway", artistId: "artist-kanye", albumId: "album-mbdtf", trackNumber: 5, durationMs: 548000, genre: "Hip-Hop", playCount: 820000000 },
  { id: "song-power", title: "Power", artistId: "artist-kanye", albumId: "album-mbdtf", trackNumber: 3, durationMs: 292000, genre: "Hip-Hop", playCount: 1100000000 },
  { id: "song-allofthelights", title: "All of the Lights", artistId: "artist-kanye", albumId: "album-mbdtf", trackNumber: 6, durationMs: 295000, genre: "Hip-Hop", playCount: 940000000 },
  // The College Dropout
  { id: "song-jesuswalks", title: "Jesus Walks", artistId: "artist-kanye", albumId: "album-collegedropout", trackNumber: 11, durationMs: 193000, genre: "Hip-Hop", playCount: 580000000 },
  { id: "song-throughthewire", title: "Through the Wire", artistId: "artist-kanye", albumId: "album-collegedropout", trackNumber: 14, durationMs: 231000, genre: "Hip-Hop", playCount: 420000000 },
  // 1989
  { id: "song-shakeitoff", title: "Shake It Off", artistId: "artist-taylorswift", albumId: "album-1989", trackNumber: 6, durationMs: 219000, genre: "Pop", playCount: 3200000000 },
  { id: "song-blankspace", title: "Blank Space", artistId: "artist-taylorswift", albumId: "album-1989", trackNumber: 2, durationMs: 231000, genre: "Pop", playCount: 2800000000 },
  { id: "song-badblood", title: "Bad Blood", artistId: "artist-taylorswift", albumId: "album-1989", trackNumber: 8, durationMs: 211000, genre: "Pop", playCount: 1600000000 },
  // Folklore
  { id: "song-cardigan", title: "Cardigan", artistId: "artist-taylorswift", albumId: "album-folklore", trackNumber: 2, durationMs: 239000, genre: "Indie Folk", playCount: 1200000000 },
  { id: "song-exile", title: "Exile", artistId: "artist-taylorswift", albumId: "album-folklore", trackNumber: 4, durationMs: 288000, genre: "Indie Folk", playCount: 820000000 },
  { id: "song-august", title: "August", artistId: "artist-taylorswift", albumId: "album-folklore", trackNumber: 8, durationMs: 261000, genre: "Indie Folk", playCount: 940000000 },
  // Lemonade
  { id: "song-formation", title: "Formation", artistId: "artist-beyonce", albumId: "album-lemonade", trackNumber: 12, durationMs: 206000, genre: "R&B", playCount: 720000000 },
  { id: "song-sorry", title: "Sorry", artistId: "artist-beyonce", albumId: "album-lemonade", trackNumber: 4, durationMs: 231000, genre: "R&B", playCount: 580000000 },
  { id: "song-holdupbey", title: "Hold Up", artistId: "artist-beyonce", albumId: "album-lemonade", trackNumber: 2, durationMs: 222000, genre: "R&B", playCount: 420000000 },
  // Rumours
  { id: "song-dreams", title: "Dreams", artistId: "artist-fleetwoodmac", albumId: "album-rumours", trackNumber: 3, durationMs: 257000, genre: "Rock", playCount: 1400000000 },
  { id: "song-goyourownway", title: "Go Your Own Way", artistId: "artist-fleetwoodmac", albumId: "album-rumours", trackNumber: 5, durationMs: 218000, genre: "Rock", playCount: 920000000 },
  { id: "song-thechain", title: "The Chain", artistId: "artist-fleetwoodmac", albumId: "album-rumours", trackNumber: 7, durationMs: 268000, genre: "Rock", playCount: 780000000 },
  // Songs in the Key of Life
  { id: "song-sirduke", title: "Sir Duke", artistId: "artist-steviewonder", albumId: "album-songsinkey", trackNumber: 4, durationMs: 244000, genre: "R&B", playCount: 420000000 },
  { id: "song-iwish", title: "I Wish", artistId: "artist-steviewonder", albumId: "album-songsinkey", trackNumber: 1, durationMs: 258000, genre: "R&B", playCount: 380000000 },
  { id: "song-isntlove", title: "Isn't She Lovely", artistId: "artist-steviewonder", albumId: "album-songsinkey", trackNumber: 5, durationMs: 382000, genre: "R&B", playCount: 620000000 },
  // Blonde
  { id: "song-nights", title: "Nights", artistId: "artist-frankocean", albumId: "album-blonde", trackNumber: 9, durationMs: 306000, genre: "R&B", playCount: 980000000 },
  { id: "song-ivy", title: "Ivy", artistId: "artist-frankocean", albumId: "album-blonde", trackNumber: 3, durationMs: 248000, genre: "R&B", playCount: 420000000 },
  { id: "song-selfc", title: "Self Control", artistId: "artist-frankocean", albumId: "album-blonde", trackNumber: 7, durationMs: 249000, genre: "R&B", playCount: 580000000 },
  // Ziggy Stardust
  { id: "song-starman", title: "Starman", artistId: "artist-davidbowie", albumId: "album-ziggystardust", trackNumber: 7, durationMs: 256000, genre: "Glam Rock", playCount: 620000000 },
  { id: "song-ziggystardust", title: "Ziggy Stardust", artistId: "artist-davidbowie", albumId: "album-ziggystardust", trackNumber: 9, durationMs: 193000, genre: "Glam Rock", playCount: 380000000 },
  // The Joshua Tree
  { id: "song-withorwithoutu", title: "With or Without You", artistId: "artist-u2", albumId: "album-joshuatree", trackNumber: 3, durationMs: 296000, genre: "Rock", playCount: 1100000000 },
  { id: "song-wherethestreets", title: "Where the Streets Have No Name", artistId: "artist-u2", albumId: "album-joshuatree", trackNumber: 1, durationMs: 336000, genre: "Rock", playCount: 520000000 },
  // A Night at the Opera
  { id: "song-bohemian", title: "Bohemian Rhapsody", artistId: "artist-queen", albumId: "album-nightatopera", trackNumber: 11, durationMs: 354000, genre: "Rock", playCount: 2200000000 },
  { id: "song-youremybestfriend", title: "You're My Best Friend", artistId: "artist-queen", albumId: "album-nightatopera", trackNumber: 4, durationMs: 172000, genre: "Rock", playCount: 580000000 },
  // Highway 61 Revisited
  { id: "song-likearollingstone", title: "Like a Rolling Stone", artistId: "artist-bobdylan", albumId: "album-highway61", trackNumber: 1, durationMs: 369000, genre: "Folk Rock", playCount: 420000000 },
];

// ============================================================================
// SEED DATA - USERS
// ============================================================================

export const USERS = [
  { id: "user-alice", username: "alice_music", email: "alice@example.com", displayName: "Alice Johnson", subscriptionType: "premium", country: "USA", birthDate: "1995-03-15" },
  { id: "user-bob", username: "bobthelistener", email: "bob@example.com", displayName: "Bob Smith", subscriptionType: "free", country: "UK", birthDate: "1988-07-22" },
  { id: "user-charlie", username: "charlie_beats", email: "charlie@example.com", displayName: "Charlie Brown", subscriptionType: "premium", country: "Canada", birthDate: "1992-11-08" },
  { id: "user-diana", username: "diana_vinyl", email: "diana@example.com", displayName: "Diana Martinez", subscriptionType: "family", country: "Spain", birthDate: "1990-05-30" },
  { id: "user-eric", username: "eric_hiphop", email: "eric@example.com", displayName: "Eric Wilson", subscriptionType: "premium", country: "USA", birthDate: "1997-01-12" },
];

// ============================================================================
// SEED DATA - PLAYLISTS
// ============================================================================

export const PLAYLISTS = [
  { id: "playlist-classicrock", name: "Classic Rock Essentials", description: "The greatest rock songs from the 60s to 80s", ownerId: "user-alice", isPublic: true, isCollaborative: false, followerCount: 15420 },
  { id: "playlist-hiphopbangers", name: "Hip-Hop Bangers", description: "Modern hip-hop hits that slap", ownerId: "user-eric", isPublic: true, isCollaborative: false, followerCount: 8930 },
  { id: "playlist-chillvibes", name: "Chill Vibes", description: "Relaxing songs for unwinding", ownerId: "user-charlie", isPublic: true, isCollaborative: true, followerCount: 4210 },
  { id: "playlist-roadtrip", name: "Road Trip Mix", description: "Perfect songs for the open road", ownerId: "user-diana", isPublic: true, isCollaborative: false, followerCount: 6780 },
  { id: "playlist-private", name: "My Private Favorites", description: "Just for me", ownerId: "user-bob", isPublic: false, isCollaborative: false, followerCount: 0 },
  { id: "playlist-90snostalgia", name: "90s Nostalgia", description: "The best of the 90s", ownerId: "user-alice", isPublic: true, isCollaborative: false, followerCount: 12300 },
];

// ============================================================================
// SEED DATA - PLAYLIST SONGS
// ============================================================================

export const PLAYLIST_SONGS = [
  // Classic Rock Essentials
  { playlistId: "playlist-classicrock", songId: "song-stairwaytoheaven", position: 1, addedById: "user-alice" },
  { playlistId: "playlist-classicrock", songId: "song-bohemian", position: 2, addedById: "user-alice" },
  { playlistId: "playlist-classicrock", songId: "song-herecomesthesun", position: 3, addedById: "user-alice" },
  { playlistId: "playlist-classicrock", songId: "song-dreams", position: 4, addedById: "user-alice" },
  { playlistId: "playlist-classicrock", songId: "song-purplerain", position: 5, addedById: "user-alice" },
  { playlistId: "playlist-classicrock", songId: "song-starman", position: 6, addedById: "user-alice" },
  { playlistId: "playlist-classicrock", songId: "song-money", position: 7, addedById: "user-alice" },
  { playlistId: "playlist-classicrock", songId: "song-withorwithoutu", position: 8, addedById: "user-alice" },
  // Hip-Hop Bangers
  { playlistId: "playlist-hiphopbangers", songId: "song-humble", position: 1, addedById: "user-eric" },
  { playlistId: "playlist-hiphopbangers", songId: "song-dna", position: 2, addedById: "user-eric" },
  { playlistId: "playlist-hiphopbangers", songId: "song-power", position: 3, addedById: "user-eric" },
  { playlistId: "playlist-hiphopbangers", songId: "song-alright", position: 4, addedById: "user-eric" },
  { playlistId: "playlist-hiphopbangers", songId: "song-runaway", position: 5, addedById: "user-eric" },
  { playlistId: "playlist-hiphopbangers", songId: "song-swimmingpools", position: 6, addedById: "user-eric" },
  // Chill Vibes
  { playlistId: "playlist-chillvibes", songId: "song-nights", position: 1, addedById: "user-charlie" },
  { playlistId: "playlist-chillvibes", songId: "song-ivy", position: 2, addedById: "user-charlie" },
  { playlistId: "playlist-chillvibes", songId: "song-cardigan", position: 3, addedById: "user-charlie" },
  { playlistId: "playlist-chillvibes", songId: "song-nosuprises", position: 4, addedById: "user-charlie" },
  { playlistId: "playlist-chillvibes", songId: "song-breathe", position: 5, addedById: "user-charlie" },
  // Road Trip Mix
  { playlistId: "playlist-roadtrip", songId: "song-shakeitoff", position: 1, addedById: "user-diana" },
  { playlistId: "playlist-roadtrip", songId: "song-billiejean", position: 2, addedById: "user-diana" },
  { playlistId: "playlist-roadtrip", songId: "song-cometogether", position: 3, addedById: "user-diana" },
  { playlistId: "playlist-roadtrip", songId: "song-blackdog", position: 4, addedById: "user-diana" },
  { playlistId: "playlist-roadtrip", songId: "song-goyourownway", position: 5, addedById: "user-diana" },
  // 90s Nostalgia
  { playlistId: "playlist-90snostalgia", songId: "song-smellsliketeenspirit", position: 1, addedById: "user-alice" },
  { playlistId: "playlist-90snostalgia", songId: "song-comeasura", position: 2, addedById: "user-alice" },
  { playlistId: "playlist-90snostalgia", songId: "song-paranoidandroid", position: 3, addedById: "user-alice" },
  { playlistId: "playlist-90snostalgia", songId: "song-karma", position: 4, addedById: "user-alice" },
];

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
