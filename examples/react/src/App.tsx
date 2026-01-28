import { useEffect, useState, useRef, useCallback } from "react";
import type { RxDatabase, RxChangeEvent } from "rxdb";
import type { RxdbDebugger } from "@rxdb-debugger/core";
import {
  getDatabase,
  seedDatabase,
  formatDuration,
  formatPlayCount,
  ARTISTS,
  ALBUMS,
  SONGS,
} from "./db";

// ============================================================================
// TYPES
// ============================================================================

interface Artist {
  id: string;
  name: string;
  bio: string;
  genre: string;
  country: string;
  formedYear: number;
  isVerified: boolean;
  monthlyListeners: number;
}

interface Album {
  id: string;
  title: string;
  artistId: string;
  releaseYear: number;
  genre: string;
  coverUrl: string;
  totalTracks: number;
}

interface Song {
  id: string;
  title: string;
  artistId: string;
  albumId: string;
  trackNumber: number;
  durationMs: number;
  genre: string;
  playCount: number;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  isPublic: boolean;
  followerCount: number;
}

interface User {
  id: string;
  username: string;
  displayName: string;
  subscriptionType: string;
}

interface ChangeLogEntry {
  id: string;
  collection: string;
  operation: string;
  documentId: string;
  timestamp: number;
}

// ============================================================================
// APP COMPONENT
// ============================================================================

export default function App() {
  const [db, setDb] = useState<RxDatabase | null>(null);
  const [isSeeded, setIsSeeded] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [activeTab, setActiveTab] = useState<"artists" | "albums" | "songs" | "playlists" | "users">("artists");
  
  // Data states
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Filter states
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Event log
  const [eventLog, setEventLog] = useState<ChangeLogEntry[]>([]);
  
  // Stats
  const [stats, setStats] = useState({ artists: 0, albums: 0, songs: 0, playlists: 0, users: 0 });
  
  const debuggerRef = useRef<HTMLDivElement>(null);
  const debuggerInstanceRef = useRef<RxdbDebugger | null>(null);

  // Initialize database
  useEffect(() => {
    let mounted = true;
    getDatabase().then(async (database) => {
      if (mounted) {
        setDb(database);
        const artistsCol = database.collections["artists"];
        if (artistsCol) {
          const artistCount = await artistsCol.count().exec();
          setIsSeeded(artistCount > 0);
        }
      }
    });
    return () => { mounted = false; };
  }, []);

  // Subscribe to artists
  useEffect(() => {
    if (!db) return;
    const col = db.collections["artists"];
    if (!col) return;
    const sub = col.find().$.subscribe((docs: unknown[]) => {
      setArtists(docs.map((d: unknown) => (d as { toJSON: (flag: boolean) => Artist }).toJSON(true)));
    });
    return () => sub.unsubscribe();
  }, [db]);

  // Subscribe to albums
  useEffect(() => {
    if (!db) return;
    const col = db.collections["albums"];
    if (!col) return;
    const sub = col.find().$.subscribe((docs: unknown[]) => {
      setAlbums(docs.map((d: unknown) => (d as { toJSON: (flag: boolean) => Album }).toJSON(true)));
    });
    return () => sub.unsubscribe();
  }, [db]);

  // Subscribe to songs with optional genre filter
  useEffect(() => {
    if (!db) return;
    const col = db.collections["songs"];
    if (!col) return;
    const selector = genreFilter ? { genre: genreFilter } : {};
    const sub = col.find({ selector }).$.subscribe((docs: unknown[]) => {
      setSongs(docs.map((d: unknown) => (d as { toJSON: (flag: boolean) => Song }).toJSON(true)));
    });
    return () => sub.unsubscribe();
  }, [db, genreFilter]);

  // Subscribe to playlists
  useEffect(() => {
    if (!db) return;
    const col = db.collections["playlists"];
    if (!col) return;
    const sub = col.find().$.subscribe((docs: unknown[]) => {
      setPlaylists(docs.map((d: unknown) => (d as { toJSON: (flag: boolean) => Playlist }).toJSON(true)));
    });
    return () => sub.unsubscribe();
  }, [db]);

  // Subscribe to users
  useEffect(() => {
    if (!db) return;
    const col = db.collections["users"];
    if (!col) return;
    const sub = col.find().$.subscribe((docs: unknown[]) => {
      setUsers(docs.map((d: unknown) => (d as { toJSON: (flag: boolean) => User }).toJSON(true)));
    });
    return () => sub.unsubscribe();
  }, [db]);

  // Subscribe to all collection events
  useEffect(() => {
    if (!db) return;
    const subs: { unsubscribe: () => void }[] = [];
    const collections = ["artists", "albums", "songs", "playlists", "users", "playlistSongs", "userFollows", "userLikes"];
    
    for (const colName of collections) {
      const col = db.collections[colName];
      if (col) {
        const sub = col.$.subscribe((event: RxChangeEvent<unknown>) => {
          setEventLog((prev) => [
            {
              id: crypto.randomUUID(),
              collection: colName,
              operation: event.operation,
              documentId: event.documentId,
              timestamp: Date.now(),
            },
            ...prev.slice(0, 49),
          ]);
        });
        subs.push(sub);
      }
    }
    return () => subs.forEach((s) => s.unsubscribe());
  }, [db]);

  // Update stats
  useEffect(() => {
    setStats({
      artists: artists.length,
      albums: albums.length,
      songs: songs.length,
      playlists: playlists.length,
      users: users.length,
    });
  }, [artists, albums, songs, playlists, users]);

  // Mount debugger
  useEffect(() => {
    if (!debuggerRef.current || !db) return;
    let unmount: (() => void) | undefined;

    Promise.all([
      import("@rxdb-debugger/core"),
      import("@rxdb-debugger/core/ui") as unknown as Promise<{
        mountDebugger: (opts: {
          container: HTMLElement;
          db: unknown;
          theme?: string;
          trackPerformance?: boolean;
          initialPanel?: string;
        }) => () => void;
      }>,
    ]).then(([{ RxdbDebugger }, { mountDebugger }]) => {
      if (!debuggerRef.current) return;
      const debuggerInstance = new RxdbDebugger({ db, trackPerformance: true });
      debuggerInstance.performance.start();
      debuggerInstanceRef.current = debuggerInstance;
      unmount = mountDebugger({
        container: debuggerRef.current,
        db,
        theme: "dark",
        trackPerformance: true,
        initialPanel: "collections",
      });
    });

    return () => {
      unmount?.();
      debuggerInstanceRef.current?.dispose();
      debuggerInstanceRef.current = null;
    };
  }, [db]);

  // Seed database
  const handleSeed = useCallback(async () => {
    if (!db || isSeeding) return;
    setIsSeeding(true);
    try {
      await seedDatabase(db);
      setIsSeeded(true);
    } finally {
      setIsSeeding(false);
    }
  }, [db, isSeeding]);

  // Clear database
  const handleClear = useCallback(async () => {
    if (!db) return;
    const collections = ["playlistSongs", "userFollows", "userLikes", "playlists", "songs", "albums", "artists", "users"];
    for (const colName of collections) {
      const col = db.collections[colName];
      if (col) {
        const docs = await col.find().exec();
        await Promise.all(docs.map((d: { remove: () => Promise<void> }) => d.remove()));
      }
    }
    setIsSeeded(false);
    setEventLog([]);
  }, [db]);

  // Get unique genres
  const genres = [...new Set(SONGS.map((s) => s.genre))].sort();

  // Get artist name by ID
  const getArtistName = (artistId: string) => artists.find((a) => a.id === artistId)?.name || "Unknown";
  const getAlbumTitle = (albumId: string) => albums.find((a) => a.id === albumId)?.title || "Unknown";
  const getUserName = (userId: string) => users.find((u) => u.id === userId)?.displayName || "Unknown";

  // Filter data by search
  const filteredArtists = artists.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredAlbums = albums.filter((a) => a.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredSongs = songs.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!db) {
    return <div style={styles.loading}>Loading Music Database...</div>;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🎵 Music Catalog Demo</h1>
        <div style={styles.headerActions}>
          {!isSeeded ? (
            <button onClick={handleSeed} disabled={isSeeding} style={styles.seedButton}>
              {isSeeding ? "Seeding..." : "Seed Database with Real Music Data"}
            </button>
          ) : (
            <button onClick={handleClear} style={styles.clearButton}>
              Clear All Data
            </button>
          )}
        </div>
      </header>

      <main style={styles.main}>
        {/* Stats Bar */}
        <div style={styles.statsBar}>
          <div style={styles.stat}><span style={styles.statValue}>{stats.artists}</span> Artists</div>
          <div style={styles.stat}><span style={styles.statValue}>{stats.albums}</span> Albums</div>
          <div style={styles.stat}><span style={styles.statValue}>{stats.songs}</span> Songs</div>
          <div style={styles.stat}><span style={styles.statValue}>{stats.playlists}</span> Playlists</div>
          <div style={styles.stat}><span style={styles.statValue}>{stats.users}</span> Users</div>
        </div>

        {/* Search and Filters */}
        <div style={styles.filterBar}>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          {activeTab === "songs" && (
            <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} style={styles.genreSelect}>
              <option value="">All Genres</option>
              {genres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {(["artists", "albums", "songs", "playlists", "users"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={activeTab === tab ? styles.tabActive : styles.tab}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Left: Data List */}
          <div style={styles.dataPanel}>
            {activeTab === "artists" && (
              <div style={styles.grid}>
                {filteredArtists.map((artist) => (
                  <div key={artist.id} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <strong>{artist.name}</strong>
                      {artist.isVerified && <span style={styles.verified}>✓</span>}
                    </div>
                    <div style={styles.cardMeta}>{artist.genre} • {artist.country}</div>
                    <div style={styles.cardMeta}>Since {artist.formedYear}</div>
                    <div style={styles.cardStat}>{formatPlayCount(artist.monthlyListeners)} monthly listeners</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "albums" && (
              <div style={styles.grid}>
                {filteredAlbums.map((album) => (
                  <div key={album.id} style={styles.card}>
                    <strong>{album.title}</strong>
                    <div style={styles.cardMeta}>{getArtistName(album.artistId)}</div>
                    <div style={styles.cardMeta}>{album.releaseYear} • {album.genre}</div>
                    <div style={styles.cardStat}>{album.totalTracks} tracks</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "songs" && (
              <div style={styles.songList}>
                {filteredSongs.slice(0, 50).map((song, idx) => (
                  <div key={song.id} style={styles.songRow}>
                    <span style={styles.songNumber}>{idx + 1}</span>
                    <div style={styles.songInfo}>
                      <div style={styles.songTitle}>{song.title}</div>
                      <div style={styles.songArtist}>{getArtistName(song.artistId)} • {getAlbumTitle(song.albumId)}</div>
                    </div>
                    <span style={styles.songDuration}>{formatDuration(song.durationMs)}</span>
                    <span style={styles.songPlays}>{formatPlayCount(song.playCount)}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "playlists" && (
              <div style={styles.grid}>
                {playlists.map((playlist) => (
                  <div key={playlist.id} style={styles.card}>
                    <div style={styles.cardHeader}>
                      <strong>{playlist.name}</strong>
                      {!playlist.isPublic && <span style={styles.private}>🔒</span>}
                    </div>
                    <div style={styles.cardMeta}>{playlist.description}</div>
                    <div style={styles.cardMeta}>By {getUserName(playlist.ownerId)}</div>
                    <div style={styles.cardStat}>{formatPlayCount(playlist.followerCount)} followers</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "users" && (
              <div style={styles.grid}>
                {users.map((user) => (
                  <div key={user.id} style={styles.card}>
                    <strong>{user.displayName}</strong>
                    <div style={styles.cardMeta}>@{user.username}</div>
                    <div style={styles.subscriptionBadge} data-type={user.subscriptionType}>
                      {user.subscriptionType.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Event Log */}
          <div style={styles.eventPanel}>
            <h3 style={styles.eventTitle}>Event Log ({eventLog.length})</h3>
            <div style={styles.eventList}>
              {eventLog.length === 0 ? (
                <div style={styles.emptyLog}>No events yet. Seed the database to see changes.</div>
              ) : (
                eventLog.map((entry) => (
                  <div key={entry.id} style={styles.eventRow}>
                    <span style={{ ...styles.eventOp, color: getOpColor(entry.operation) }}>{entry.operation}</span>
                    <span style={styles.eventCol}>{entry.collection}</span>
                    <span style={styles.eventId}>{entry.documentId.slice(0, 12)}...</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Debugger Panel */}
        <section style={styles.debuggerSection}>
          <h2 style={styles.sectionTitle}>RxDB Debugger</h2>
          <div ref={debuggerRef} style={styles.debuggerContainer} />
        </section>
      </main>
    </div>
  );
}

function getOpColor(op: string): string {
  switch (op) {
    case "INSERT": return "#4ade80";
    case "UPDATE": return "#facc15";
    case "DELETE": return "#f87171";
    default: return "#888";
  }
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0a0a0a" },
  loading: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontSize: "1.25rem", color: "#fff" },
  header: { padding: "1rem 2rem", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { margin: 0, fontSize: "1.5rem", fontWeight: 600, color: "#fff" },
  headerActions: { display: "flex", gap: "0.5rem" },
  seedButton: { padding: "0.5rem 1rem", background: "#22c55e", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 500 },
  clearButton: { padding: "0.5rem 1rem", background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 500 },
  main: { flex: 1, padding: "1rem 2rem", display: "flex", flexDirection: "column", gap: "1rem" },
  statsBar: { display: "flex", gap: "2rem", padding: "1rem", background: "#111", borderRadius: "8px" },
  stat: { color: "#888", fontSize: "0.875rem" },
  statValue: { color: "#fff", fontWeight: 600, fontSize: "1.25rem", marginRight: "0.25rem" },
  filterBar: { display: "flex", gap: "1rem", alignItems: "center" },
  searchInput: { flex: 1, padding: "0.5rem 1rem", background: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", color: "#fff", fontSize: "0.875rem" },
  genreSelect: { padding: "0.5rem 1rem", background: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", color: "#fff", fontSize: "0.875rem" },
  tabs: { display: "flex", gap: "0.25rem", borderBottom: "1px solid #222", paddingBottom: "0.5rem" },
  tab: { padding: "0.5rem 1rem", background: "transparent", border: "none", color: "#888", cursor: "pointer", borderRadius: "6px 6px 0 0", fontSize: "0.875rem" },
  tabActive: { padding: "0.5rem 1rem", background: "#1a1a1a", border: "none", color: "#fff", cursor: "pointer", borderRadius: "6px 6px 0 0", fontSize: "0.875rem", fontWeight: 500 },
  content: { display: "flex", gap: "1rem", flex: 1, minHeight: 0 },
  dataPanel: { flex: 2, overflow: "auto", background: "#111", borderRadius: "8px", padding: "1rem" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem" },
  card: { background: "#1a1a1a", padding: "1rem", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "0.25rem" },
  cardHeader: { display: "flex", alignItems: "center", gap: "0.5rem", color: "#fff" },
  verified: { color: "#3b82f6", fontSize: "0.75rem" },
  private: { fontSize: "0.75rem" },
  cardMeta: { color: "#666", fontSize: "0.8rem" },
  cardStat: { color: "#888", fontSize: "0.75rem", marginTop: "0.25rem" },
  subscriptionBadge: { padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 600, marginTop: "0.5rem", display: "inline-block", background: "#333", color: "#fff" },
  songList: { display: "flex", flexDirection: "column" },
  songRow: { display: "flex", alignItems: "center", gap: "1rem", padding: "0.5rem", borderBottom: "1px solid #222", color: "#fff" },
  songNumber: { color: "#666", width: "2rem", textAlign: "right", fontSize: "0.8rem" },
  songInfo: { flex: 1, minWidth: 0 },
  songTitle: { fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  songArtist: { color: "#666", fontSize: "0.8rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  songDuration: { color: "#666", fontSize: "0.8rem", width: "3rem", textAlign: "right" },
  songPlays: { color: "#888", fontSize: "0.75rem", width: "4rem", textAlign: "right" },
  eventPanel: { flex: 1, background: "#111", borderRadius: "8px", padding: "1rem", display: "flex", flexDirection: "column" },
  eventTitle: { margin: "0 0 0.75rem", fontSize: "0.875rem", color: "#888" },
  eventList: { flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: "0.25rem" },
  emptyLog: { color: "#444", fontStyle: "italic", fontSize: "0.8rem" },
  eventRow: { display: "flex", gap: "0.5rem", fontSize: "0.75rem", padding: "0.25rem 0" },
  eventOp: { fontWeight: 600, width: "4rem" },
  eventCol: { color: "#888", width: "5rem" },
  eventId: { color: "#555", fontFamily: "monospace" },
  debuggerSection: { background: "#111", borderRadius: "8px", padding: "1rem", marginTop: "1rem" },
  sectionTitle: { margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 500, color: "#888" },
  debuggerContainer: { height: "500px", borderRadius: "4px", overflow: "hidden" },
};
