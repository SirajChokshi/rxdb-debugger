import { useEffect, useState, useRef, useCallback } from "react";
import type { RxDatabase, RxChangeEvent } from "rxdb";
import type { RxdbDebugger } from "@rxdb-debugger/core";
import {
  getDatabase,
  seedDatabase,
  formatDuration,
  formatPlayCount,
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

interface DbEvent {
  id: string;
  collection: string;
  operation: string;
  documentId: string;
  timestamp: number;
}

type View = "home" | "artists" | "albums" | "songs" | "playlists";
type DebuggerDock = "bottom" | "right";

// ============================================================================
// APP
// ============================================================================

export default function App() {
  const [db, setDb] = useState<RxDatabase | null>(null);
  const [isSeeded, setIsSeeded] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [activeView, setActiveView] = useState<View>("home");

  // Debugger state
  const [showDebugger, setShowDebugger] = useState(() => {
    return localStorage.getItem("rxdb-debugger-open") === "true";
  });
  const [debuggerHeight, setDebuggerHeight] = useState(() => {
    return parseInt(localStorage.getItem("rxdb-debugger-height") || "400", 10);
  });
  const [debuggerWidth, setDebuggerWidth] = useState(() => {
    return parseInt(localStorage.getItem("rxdb-debugger-width") || "500", 10);
  });
  const [debuggerDock, setDebuggerDock] = useState<DebuggerDock>(() => {
    return (localStorage.getItem("rxdb-debugger-dock") as DebuggerDock) || "bottom";
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [events, setEvents] = useState<DbEvent[]>([]);

  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);

  const debuggerRef = useRef<HTMLDivElement>(null);
  const debuggerInstanceRef = useRef<RxdbDebugger | null>(null);
  const isResizing = useRef(false);

  // Persist debugger state
  useEffect(() => {
    localStorage.setItem("rxdb-debugger-open", showDebugger.toString());
  }, [showDebugger]);

  useEffect(() => {
    localStorage.setItem("rxdb-debugger-height", debuggerHeight.toString());
  }, [debuggerHeight]);

  useEffect(() => {
    localStorage.setItem("rxdb-debugger-width", debuggerWidth.toString());
  }, [debuggerWidth]);

  useEffect(() => {
    localStorage.setItem("rxdb-debugger-dock", debuggerDock);
  }, [debuggerDock]);

  // Keyboard shortcut: Cmd/Ctrl + D to toggle debugger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        setShowDebugger((prev) => !prev);
      }
      if (e.key === "Escape" && showDebugger) {
        setShowDebugger(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDebugger]);

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

  // Subscribe to events for the live counter
  useEffect(() => {
    if (!db) return;
    const subs: { unsubscribe: () => void }[] = [];
    const collections = ["artists", "albums", "songs", "playlists", "users", "playlistSongs", "userFollows", "userLikes"];

    for (const colName of collections) {
      const col = db.collections[colName];
      if (col) {
        const sub = col.$.subscribe((event: RxChangeEvent<unknown>) => {
          setEvents((prev) => [
            {
              id: crypto.randomUUID(),
              collection: colName,
              operation: event.operation,
              documentId: event.documentId,
              timestamp: Date.now(),
            },
            ...prev.slice(0, 99),
          ]);
        });
        subs.push(sub);
      }
    }
    return () => subs.forEach((s) => s.unsubscribe());
  }, [db]);

  // Subscriptions
  useEffect(() => {
    if (!db) return;
    const sub = db.collections["artists"]?.find().$.subscribe((docs: unknown[]) => {
      setArtists(docs.map((d: unknown) => (d as { toJSON: (flag: boolean) => Artist }).toJSON(true)));
    });
    return () => sub?.unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const sub = db.collections["albums"]?.find().$.subscribe((docs: unknown[]) => {
      setAlbums(docs.map((d: unknown) => (d as { toJSON: (flag: boolean) => Album }).toJSON(true)));
    });
    return () => sub?.unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const sub = db.collections["songs"]?.find().$.subscribe((docs: unknown[]) => {
      setSongs(docs.map((d: unknown) => (d as { toJSON: (flag: boolean) => Song }).toJSON(true)));
    });
    return () => sub?.unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const sub = db.collections["playlists"]?.find().$.subscribe((docs: unknown[]) => {
      setPlaylists(docs.map((d: unknown) => (d as { toJSON: (flag: boolean) => Playlist }).toJSON(true)));
    });
    return () => sub?.unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const sub = db.collections["users"]?.find().$.subscribe((docs: unknown[]) => {
      setUsers(docs.map((d: unknown) => (d as { toJSON: (flag: boolean) => User }).toJSON(true)));
    });
    return () => sub?.unsubscribe();
  }, [db]);

  // Mount debugger
  useEffect(() => {
    if (!debuggerRef.current || !db || !showDebugger || isMinimized) return;
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
  }, [db, showDebugger, isMinimized]);

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
    setCurrentSong(null);
    setSelectedArtist(null);
    setEvents([]);
  }, [db]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = debuggerDock === "bottom" ? "ns-resize" : "ew-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      if (debuggerDock === "bottom") {
        const newHeight = window.innerHeight - e.clientY;
        setDebuggerHeight(Math.max(200, Math.min(window.innerHeight - 100, newHeight)));
      } else {
        const newWidth = window.innerWidth - e.clientX;
        setDebuggerWidth(Math.max(300, Math.min(window.innerWidth - 300, newWidth)));
      }
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [debuggerDock]);

  const getArtistName = (artistId: string) => artists.find((a) => a.id === artistId)?.name || "Unknown";
  const getAlbumTitle = (albumId: string) => albums.find((a) => a.id === albumId)?.title || "Unknown";
  const getAlbum = (albumId: string) => albums.find((a) => a.id === albumId);

  const artistSongs = selectedArtist ? songs.filter(s => s.artistId === selectedArtist.id) : [];
  const artistAlbums = selectedArtist ? albums.filter(a => a.artistId === selectedArtist.id) : [];

  // Stats for the debugger header
  const stats = {
    artists: artists.length,
    albums: albums.length,
    songs: songs.length,
    playlists: playlists.length,
    users: users.length,
  };
  const totalDocs = stats.artists + stats.albums + stats.songs + stats.playlists + stats.users;
  const recentEvents = events.slice(0, 5);

  if (!db) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-black p-4 flex flex-col gap-6 border-r border-neutral-900">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 bg-linear-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
              <span className="text-lg">♪</span>
            </div>
            <span className="font-bold text-lg">RxTunes</span>
          </div>

          <nav className="flex flex-col gap-1">
            <NavButton active={activeView === "home"} onClick={() => { setActiveView("home"); setSelectedArtist(null); }}>
              <HomeIcon /> Home
            </NavButton>
            <NavButton active={activeView === "songs"} onClick={() => { setActiveView("songs"); setSelectedArtist(null); }}>
              <MusicIcon /> All Songs
            </NavButton>
          </nav>

          <div>
            <p className="text-neutral-500 text-xs font-semibold uppercase tracking-wider px-3 mb-2">Library</p>
            <nav className="flex flex-col gap-1">
              <NavButton active={activeView === "artists"} onClick={() => { setActiveView("artists"); setSelectedArtist(null); }}>
                <ArtistIcon /> Artists
              </NavButton>
              <NavButton active={activeView === "albums"} onClick={() => { setActiveView("albums"); setSelectedArtist(null); }}>
                <AlbumIcon /> Albums
              </NavButton>
              <NavButton active={activeView === "playlists"} onClick={() => { setActiveView("playlists"); setSelectedArtist(null); }}>
                <PlaylistIcon /> Playlists
              </NavButton>
            </nav>
          </div>

          <div className="mt-auto flex flex-col gap-2">
            {!isSeeded ? (
              <button
                onClick={handleSeed}
                disabled={isSeeding}
                className="w-full py-2 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-full text-sm transition-colors"
              >
                {isSeeding ? "Loading..." : "Load Demo Data"}
              </button>
            ) : (
              <button
                onClick={handleClear}
                className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full text-sm transition-colors"
              >
                Clear Library
              </button>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main
          className="flex-1 overflow-y-auto bg-linear-to-b from-neutral-900 to-black"
          style={{
            marginRight: showDebugger && debuggerDock === "right" ? debuggerWidth : 0,
            marginBottom: showDebugger && debuggerDock === "bottom" ? (isMinimized ? 44 : debuggerHeight) : 0,
            transition: isResizing.current ? "none" : "margin 0.2s ease-out"
          }}
        >
          {activeView === "home" && <HomeView artists={artists} albums={albums} songs={songs} onPlaySong={setCurrentSong} onSelectArtist={(a) => { setSelectedArtist(a); setActiveView("artists"); }} />}
          {activeView === "artists" && !selectedArtist && <ArtistsGrid artists={artists} onSelect={setSelectedArtist} />}
          {activeView === "artists" && selectedArtist && (
            <ArtistDetail
              artist={selectedArtist}
              albums={artistAlbums}
              songs={artistSongs}
              onBack={() => setSelectedArtist(null)}
              onPlaySong={setCurrentSong}
              currentSong={currentSong}
            />
          )}
          {activeView === "albums" && <AlbumsGrid albums={albums} getArtistName={getArtistName} />}
          {activeView === "songs" && <SongsView songs={songs} getArtistName={getArtistName} getAlbumTitle={getAlbumTitle} onPlaySong={setCurrentSong} currentSong={currentSong} />}
          {activeView === "playlists" && <PlaylistsView playlists={playlists} users={users} />}
        </main>
      </div>

      {/* Now Playing Bar */}
      {currentSong && (
        <div
          className="h-20 bg-neutral-900 border-t border-neutral-800 px-4 flex items-center gap-4"
          style={{
            marginRight: showDebugger && debuggerDock === "right" ? debuggerWidth : 0,
            marginBottom: showDebugger && debuggerDock === "bottom" ? (isMinimized ? 44 : debuggerHeight) : 0,
            transition: isResizing.current ? "none" : "margin 0.2s ease-out"
          }}
        >
          <div className="w-14 h-14 bg-neutral-800 rounded overflow-hidden shrink-0">
            <img src={getAlbum(currentSong.albumId)?.coverUrl || ""} alt="" className="w-full h-full object-cover" draggable={false} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{currentSong.title}</p>
            <p className="text-neutral-400 text-sm truncate">{getArtistName(currentSong.artistId)}</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white">
              <SkipBackIcon />
            </button>
            <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform">
              <PlayIcon />
            </button>
            <button className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white">
              <SkipForwardIcon />
            </button>
          </div>
          <div className="w-48 flex items-center gap-2 text-neutral-400 text-xs">
            <span>0:00</span>
            <div className="flex-1 h-1 bg-neutral-700 rounded-full">
              <div className="w-0 h-full bg-green-500 rounded-full" />
            </div>
            <span>{formatDuration(currentSong.durationMs)}</span>
          </div>
        </div>
      )}

      {/* Floating Debugger Toggle (when closed) */}
      {!showDebugger && (
        <button
          onClick={() => setShowDebugger(true)}
          className="fixed bottom-4 right-4 w-12 h-12 bg-orange-500 hover:bg-orange-400 text-black rounded-full shadow-xl flex items-center justify-center z-50 transition-transform hover:scale-110"
          title="Open Debugger (⌘D)"
        >
          <TerminalIcon />
        </button>
      )}

      {/* Debugger Panel */}
      {showDebugger && (
        <div
          className={`fixed bg-neutral-950 border-neutral-800 shadow-2xl z-50 flex flex-col transition-all duration-200 ${debuggerDock === "bottom"
              ? "inset-x-0 bottom-0 border-t"
              : "top-0 right-0 bottom-0 border-l"
            }`}
          style={{
            height: debuggerDock === "bottom" ? (isMinimized ? 44 : debuggerHeight) : "100%",
            width: debuggerDock === "right" ? debuggerWidth : "100%",
          }}
        >
          {/* Resize Handle */}
          <div
            onMouseDown={handleResizeStart}
            className={`absolute bg-transparent hover:bg-orange-500/30 transition-colors ${debuggerDock === "bottom"
                ? "top-0 left-0 right-0 h-1 cursor-ns-resize"
                : "top-0 left-0 bottom-0 w-1 cursor-ew-resize"
              }`}
          />

          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-orange-500">
                  <TerminalIcon />
                </span>
                <span className="font-semibold text-sm">RxDB Debugger</span>
              </div>

              {/* Quick Stats */}
              <div className="flex items-center gap-2 text-xs text-neutral-500 border-l border-neutral-700 pl-3 ml-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  {totalDocs} docs
                </span>
                {events.length > 0 && (
                  <span className="flex items-center gap-1 text-yellow-500">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                    {events.length} events
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Dock position toggle */}
              <button
                onClick={() => setDebuggerDock(debuggerDock === "bottom" ? "right" : "bottom")}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                title={debuggerDock === "bottom" ? "Dock to right" : "Dock to bottom"}
              >
                {debuggerDock === "bottom" ? <DockRightIcon /> : <DockBottomIcon />}
              </button>

              {/* Minimize */}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </button>

              {/* Close */}
              <button
                onClick={() => setShowDebugger(false)}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                title="Close (Esc)"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Minimized Event Stream */}
          {isMinimized && recentEvents.length > 0 && (
            <div className="absolute left-1/2 -translate-x-1/2 top-2 flex items-center gap-2 pointer-events-none">
              {recentEvents.map((event, i) => (
                <span
                  key={event.id}
                  className={`text-xs px-2 py-0.5 rounded ${event.operation === "INSERT" ? "bg-green-500/20 text-green-400" :
                      event.operation === "UPDATE" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-red-500/20 text-red-400"
                    }`}
                  style={{ opacity: 1 - (i * 0.2) }}
                >
                  {event.operation} {event.collection}
                </span>
              ))}
            </div>
          )}

          {/* Debugger Content */}
          {!isMinimized && (
            <div ref={debuggerRef} className="flex-1 overflow-hidden" />
          )}
        </div>
      )}

      {/* Keyboard Shortcut Hint */}
      {showDebugger && (
        <div className="fixed bottom-2 left-2 text-xs text-neutral-600 z-40">
          ⌘D to toggle • Esc to close • Drag edge to resize
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VIEWS
// ============================================================================

function HomeView({ artists, albums, songs, onPlaySong, onSelectArtist }: {
  artists: Artist[];
  albums: Album[];
  songs: Song[];
  onPlaySong: (song: Song) => void;
  onSelectArtist: (artist: Artist) => void;
}) {
  const topSongs = [...songs].sort((a, b) => b.playCount - a.playCount).slice(0, 6);
  const featuredArtists = artists.slice(0, 6);

  if (artists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="w-24 h-24 bg-neutral-800 rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl">🎵</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Welcome to RxTunes</h1>
        <p className="text-neutral-400 mb-6 max-w-md">
          Your music library is empty. Load the demo data to explore artists, albums, and songs.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Good evening</h1>

      {/* Quick Play Grid */}
      <div className="grid grid-cols-3 gap-3 mb-10">
        {featuredArtists.slice(0, 6).map((artist) => (
          <button
            key={artist.id}
            onClick={() => onSelectArtist(artist)}
            className="flex items-center gap-4 bg-neutral-800/50 hover:bg-neutral-800 rounded overflow-hidden text-left transition-colors group"
          >
            <div className="w-16 h-16 bg-linear-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl shrink-0">
              {artist.name.charAt(0)}
            </div>
            <span className="font-semibold truncate pr-4">{artist.name}</span>
          </button>
        ))}
      </div>

      {/* Top Songs */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Popular Tracks</h2>
        <div className="grid grid-cols-2 gap-2">
          {topSongs.map((song, idx) => (
            <button
              key={song.id}
              onClick={() => onPlaySong(song)}
              className="flex items-center gap-3 p-2 rounded hover:bg-neutral-800/50 transition-colors text-left group"
            >
              <span className="w-6 text-neutral-500 text-sm text-right">{idx + 1}</span>
              <div className="w-10 h-10 bg-neutral-800 rounded shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{song.title}</p>
                <p className="text-neutral-400 text-sm truncate">{formatPlayCount(song.playCount)} plays</p>
              </div>
              <span className="text-neutral-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                <PlayIcon />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Featured Albums */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Featured Albums</h2>
        <div className="grid grid-cols-5 gap-6">
          {albums.slice(0, 5).map((album) => (
            <div key={album.id} className="group">
              <div className="aspect-square bg-neutral-800 rounded-lg mb-3 overflow-hidden relative">
                <img src={album.coverUrl} alt="" className="w-full h-full object-cover" />
                <button className="absolute bottom-2 right-2 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-xl">
                  <PlayIcon />
                </button>
              </div>
              <p className="font-medium truncate">{album.title}</p>
              <p className="text-neutral-400 text-sm truncate">{album.releaseYear}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ArtistsGrid({ artists, onSelect }: { artists: Artist[]; onSelect: (artist: Artist) => void }) {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Artists</h1>
      <div className="grid grid-cols-5 gap-6">
        {artists.map((artist) => (
          <button key={artist.id} onClick={() => onSelect(artist)} className="text-center group">
            <div className="aspect-square bg-linear-to-br from-purple-600 to-blue-500 rounded-full mb-3 flex items-center justify-center text-4xl shadow-lg group-hover:scale-105 transition-transform">
              {artist.name.charAt(0)}
            </div>
            <p className="font-medium truncate">{artist.name}</p>
            <p className="text-neutral-400 text-sm">{artist.genre}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ArtistDetail({ artist, albums, songs, onBack, onPlaySong, currentSong }: {
  artist: Artist;
  albums: Album[];
  songs: Song[];
  onBack: () => void;
  onPlaySong: (song: Song) => void;
  currentSong: Song | null;
}) {
  return (
    <div>
      {/* Hero */}
      <div className="h-72 bg-linear-to-b from-purple-900 to-transparent p-8 flex items-end">
        <div>
          <button onClick={onBack} className="text-neutral-300 hover:text-white mb-4 text-sm flex items-center gap-1">
            ← Back
          </button>
          {artist.isVerified && (
            <p className="text-xs text-blue-400 flex items-center gap-1 mb-1">
              <span>✓</span> Verified Artist
            </p>
          )}
          <h1 className="text-6xl font-bold mb-2">{artist.name}</h1>
          <p className="text-neutral-300">{formatPlayCount(artist.monthlyListeners)} monthly listeners</p>
        </div>
      </div>

      <div className="p-8">
        {/* Play Button */}
        <div className="flex items-center gap-6 mb-8">
          <button
            onClick={() => songs[0] && onPlaySong(songs[0])}
            className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-xl"
          >
            <PlayIcon />
          </button>
        </div>

        {/* Popular Songs */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Popular</h2>
          <div className="flex flex-col">
            {songs.slice(0, 5).map((song, idx) => (
              <button
                key={song.id}
                onClick={() => onPlaySong(song)}
                className={`flex items-center gap-4 p-3 rounded hover:bg-neutral-800/50 transition-colors text-left group ${currentSong?.id === song.id ? "bg-neutral-800/50" : ""
                  }`}
              >
                <span className="w-6 text-neutral-500 text-center">{idx + 1}</span>
                <div className="w-10 h-10 bg-neutral-800 rounded shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${currentSong?.id === song.id ? "text-green-500" : ""}`}>
                    {song.title}
                  </p>
                </div>
                <span className="text-neutral-500 text-sm">{formatPlayCount(song.playCount)}</span>
                <span className="text-neutral-500 text-sm w-12 text-right">{formatDuration(song.durationMs)}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Discography */}
        {albums.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Discography</h2>
            <div className="grid grid-cols-5 gap-6">
              {albums.map((album) => (
                <div key={album.id} className="group">
                  <div className="aspect-square bg-neutral-800 rounded-lg mb-3 overflow-hidden">
                    <img src={album.coverUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <p className="font-medium truncate">{album.title}</p>
                  <p className="text-neutral-400 text-sm">{album.releaseYear} • Album</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function AlbumsGrid({ albums, getArtistName }: { albums: Album[]; getArtistName: (id: string) => string }) {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Albums</h1>
      <div className="grid grid-cols-5 gap-6">
        {albums.map((album) => (
          <div key={album.id} className="group">
            <div className="aspect-square bg-neutral-800 rounded-lg mb-3 overflow-hidden relative shadow-lg">
              <img src={album.coverUrl} alt="" className="w-full h-full object-cover" />
              <button className="absolute bottom-2 right-2 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-xl text-black">
                <PlayIcon />
              </button>
            </div>
            <p className="font-medium truncate">{album.title}</p>
            <p className="text-neutral-400 text-sm truncate">{getArtistName(album.artistId)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SongsView({ songs, getArtistName, getAlbumTitle, onPlaySong, currentSong }: {
  songs: Song[];
  getArtistName: (id: string) => string;
  getAlbumTitle: (id: string) => string;
  onPlaySong: (song: Song) => void;
  currentSong: Song | null;
}) {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">All Songs</h1>

      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-neutral-800 text-neutral-400 text-sm mb-2">
        <span className="w-8 text-center">#</span>
        <span className="flex-1">Title</span>
        <span className="w-48">Album</span>
        <span className="w-24 text-right">Plays</span>
        <span className="w-16 text-right">⏱</span>
      </div>

      <div className="flex flex-col">
        {songs.map((song, idx) => (
          <button
            key={song.id}
            onClick={() => onPlaySong(song)}
            className={`flex items-center gap-4 px-4 py-2 rounded hover:bg-neutral-800/50 transition-colors text-left group ${currentSong?.id === song.id ? "bg-neutral-800/50" : ""
              }`}
          >
            <span className="w-8 text-neutral-500 text-center text-sm group-hover:hidden">{idx + 1}</span>
            <span className="w-8 text-center hidden group-hover:block"><PlayIcon /></span>
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate ${currentSong?.id === song.id ? "text-green-500" : ""}`}>
                {song.title}
              </p>
              <p className="text-neutral-400 text-sm truncate">{getArtistName(song.artistId)}</p>
            </div>
            <span className="w-48 text-neutral-400 text-sm truncate">{getAlbumTitle(song.albumId)}</span>
            <span className="w-24 text-neutral-500 text-sm text-right">{formatPlayCount(song.playCount)}</span>
            <span className="w-16 text-neutral-500 text-sm text-right">{formatDuration(song.durationMs)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlaylistsView({ playlists, users }: { playlists: Playlist[]; users: User[] }) {
  const getUserName = (id: string) => users.find(u => u.id === id)?.displayName || "Unknown";

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Playlists</h1>
      <div className="grid grid-cols-5 gap-6">
        {playlists.map((playlist) => (
          <div key={playlist.id} className="group">
            <div className="aspect-square bg-linear-to-br from-indigo-500 to-purple-600 rounded-lg mb-3 flex items-center justify-center relative shadow-lg">
              <span className="text-5xl">🎶</span>
              <button className="absolute bottom-2 right-2 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-xl text-black">
                <PlayIcon />
              </button>
            </div>
            <p className="font-medium truncate">{playlist.name}</p>
            <p className="text-neutral-400 text-sm truncate">By {getUserName(playlist.ownerId)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ICONS
// ============================================================================

function HomeIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
    </svg>
  );
}

function ArtistIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  );
}

function AlbumIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
    </svg>
  );
}

function PlaylistIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
    </svg>
  );
}

function SkipBackIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function DockBottomIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 15h18" />
    </svg>
  );
}

function DockRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M15 3v18" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function NavButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${active ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
        }`}
    >
      {children}
    </button>
  );
}
