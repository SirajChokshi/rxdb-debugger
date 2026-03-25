import { useEffect, useState, useRef, useCallback } from "react";
import type { RxDatabase, RxChangeEvent } from "rxdb";
import type {
  ExplorerDatabaseInstance,
  ExplorerDebuggerAdapter,
  ExplorerLogicalDatabase,
} from "@rxdb-debugger/ui";
import { Menu } from "@base-ui/react/menu";
import {
  getDatabase,
  seedDatabase,
  setupMockReplications,
  formatDuration,
  formatPlayCount,
} from "./db";
import { MEDIA_ATTRIBUTION_LINKS } from "./media";

// ============================================================================
// TYPES
// ============================================================================

interface Artist {
  id: string;
  name: string;
  bio: string;
  genre: string;
  imageUrl?: string;
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
  coverUrl?: string;
  isPublic: boolean;
  isCollaborative?: boolean;
  followerCount: number;
  createdAt?: number;
  updatedAt?: number;
}

interface PlaylistSong {
  id: string;
  playlistId: string;
  songId: string;
  position: number;
  addedById: string;
  addedAt: number;
}

interface User {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  subscriptionType: string;
  nowPlayingSongId?: string;
  nowPlayingUpdatedAt?: number;
  lastActiveAt: number;
  updatedAt: number;
}

interface UserFriend {
  id: string;
  userId: string;
  friendId: string;
  position: number;
  createdAt: number;
}

interface FriendActivity {
  id: string;
  friendId: string;
  friendName: string;
  avatarColor: string;
  currentSongId?: string;
  currentSongTitle: string;
  currentArtistName: string;
  updatedAt: number;
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
const DEBUGGER_MINIMIZED_SIZE = 44;
const DEBUGGER_MIN_HEIGHT = 200;
const DEBUGGER_MIN_WIDTH = 300;
const LOCAL_USER_ID = "user-alice";

type DebuggerWindow = typeof window & {
  __RXDB_DEBUGGER__?: {
    snapshot: () => {
      logicalDatabases: Record<string, ExplorerLogicalDatabase>;
      instances: Record<string, ExplorerDatabaseInstance>;
    };
    getInstanceHandle: (id: string) => RxDatabase | null;
    closeInstance: (id: string) => Promise<boolean>;
    removeInstance: (id: string) => Promise<boolean>;
  };
};

// ============================================================================
// APP
// ============================================================================

export default function App(): JSX.Element {
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
  const [isResizingLayout, setIsResizingLayout] = useState(false);
  const [allowLayoutTransitions, setAllowLayoutTransitions] = useState(true);
  const [events, setEvents] = useState<DbEvent[]>([]);
  const [isFriendsCollapsed, setIsFriendsCollapsed] = useState(() => {
    return localStorage.getItem("rxtunes-friends-collapsed") === "true";
  });

  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistSongs, setPlaylistSongs] = useState<PlaylistSong[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userFriends, setUserFriends] = useState<UserFriend[]>([]);

  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [currentSong, setCurrentSong] = useState<Song | null>(null);

  const debuggerRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);

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

  useEffect(() => {
    localStorage.setItem("rxtunes-friends-collapsed", isFriendsCollapsed.toString());
  }, [isFriendsCollapsed]);

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

  useEffect(() => {
    if (!db) return;
    setupMockReplications(db);
  }, [db]);

  // Subscribe to events for the live counter
  useEffect(() => {
    if (!db) return;
    const subs: { unsubscribe: () => void }[] = [];
    const collections = [
      "artists",
      "albums",
      "songs",
      "playlists",
      "users",
      "userFriends",
      "playlistSongs",
      "userFollows",
      "userLikes",
    ];

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
    const sub = db.collections["playlistSongs"]?.find().$.subscribe((docs: unknown[]) => {
      setPlaylistSongs(docs.map((d: unknown) => (d as { toJSON: (flag: boolean) => PlaylistSong }).toJSON(true)));
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

  useEffect(() => {
    if (!db) return;
    const sub = db.collections["userFriends"]?.find().$.subscribe((docs: unknown[]) => {
      const next = docs
        .map((d: unknown) => (d as { toJSON: (flag: boolean) => UserFriend }).toJSON(true))
        .sort((a, b) => a.position - b.position);
      setUserFriends(next);
    });
    return () => sub?.unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!selectedPlaylistId) return;
    if (!playlists.some((playlist) => playlist.id === selectedPlaylistId)) {
      setSelectedPlaylistId(null);
    }
  }, [playlists, selectedPlaylistId]);

  // Mount debugger
  useEffect(() => {
    if (!debuggerRef.current || !db || !showDebugger || isMinimized) return;
    let unmount: (() => void) | undefined;

    const adapter: ExplorerDebuggerAdapter = {
      async isRegistryAvailable() {
        const registry = (window as DebuggerWindow).__RXDB_DEBUGGER__;
        return Boolean(registry && typeof registry.snapshot === "function");
      },
      async listLogicalDatabases() {
        const registry = (window as DebuggerWindow).__RXDB_DEBUGGER__;
        const logicalDatabases = registry?.snapshot().logicalDatabases ?? {};
        return Object.values(logicalDatabases);
      },
      async listInstances(logicalDatabaseId?: string) {
        const registry = (window as DebuggerWindow).__RXDB_DEBUGGER__;
        const instances = Object.values(
          registry?.snapshot().instances ?? {}
        );
        if (!logicalDatabaseId) {
          return instances;
        }
        return instances.filter((entry) => entry.logicalDatabaseId === logicalDatabaseId);
      },
      async connectToInstance(instanceId: string) {
        const registry = (window as DebuggerWindow).__RXDB_DEBUGGER__;
        const handle = registry?.getInstanceHandle(instanceId) ?? null;
        if (!handle) {
          throw new Error("Unable to connect to selected database instance");
        }
        return handle;
      },
      async disconnect() {
        return;
      },
      async closeInstance(instanceId: string) {
        const registry = (window as DebuggerWindow).__RXDB_DEBUGGER__;
        if (!registry) {
          return false;
        }
        return registry.closeInstance(instanceId);
      },
      async removeInstance(instanceId: string) {
        const registry = (window as DebuggerWindow).__RXDB_DEBUGGER__;
        if (!registry) {
          return false;
        }
        return registry.removeInstance(instanceId);
      },
    };

    import("@rxdb-debugger/ui").then(({ mountExplorerDebugger }) => {
      if (!debuggerRef.current) return;
      unmount = mountExplorerDebugger({
        container: debuggerRef.current,
        adapter,
        shellTheme: "auto",
        inspectorTheme: "auto",
        trackPerformance: true,
        initialPanel: "collections",
      });
    });

    return () => {
      unmount?.();
    };
  }, [db, showDebugger, isMinimized]);

  const currentUser = users.find((user) => user.id === LOCAL_USER_ID) || null;
  const currentUserId = currentUser?.id || LOCAL_USER_ID;

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
    const collections = [
      "userFriends",
      "playlistSongs",
      "userFollows",
      "userLikes",
      "playlists",
      "songs",
      "albums",
      "artists",
      "users",
    ];
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
    setSelectedPlaylistId(null);
    setCreatePlaylistOpen(false);
    setNewPlaylistName("");
    setEvents([]);
    setUserFriends([]);
  }, [db]);

  const handleCreatePlaylist = useCallback(async () => {
    if (!db) return;
    const name = newPlaylistName.trim();
    if (!name) return;
    const playlistsCollection = db.collections["playlists"];
    if (!playlistsCollection) return;

    const now = Date.now();
    const playlistId = `playlist-${crypto.randomUUID()}`;
    await playlistsCollection.insert({
      id: playlistId,
      name,
      description: `Created by ${currentUser?.displayName || "You"}`,
      ownerId: currentUserId,
      coverUrl: "",
      isPublic: false,
      isCollaborative: false,
      followerCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    setNewPlaylistName("");
    setCreatePlaylistOpen(false);
    setSelectedPlaylistId(playlistId);
    setSelectedArtist(null);
    setActiveView("playlists");
  }, [currentUser?.displayName, currentUserId, db, newPlaylistName]);

  const handleOpenPlaylist = useCallback((playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setSelectedArtist(null);
    setActiveView("playlists");
  }, []);

  const handleAddSongToPlaylist = useCallback(async (playlistId: string, songId: string) => {
    if (!db) return;
    const playlistSongsCollection = db.collections["playlistSongs"];
    if (!playlistSongsCollection) return;

    const existingRelation = playlistSongs.find(
      (playlistSong) => playlistSong.playlistId === playlistId && playlistSong.songId === songId,
    );
    if (existingRelation) return;

    const maxPosition = playlistSongs.reduce((max, playlistSong) => {
      if (playlistSong.playlistId !== playlistId) return max;
      return Math.max(max, playlistSong.position);
    }, 0);

    await playlistSongsCollection.insert({
      id: `ps-${crypto.randomUUID()}`,
      playlistId,
      songId,
      position: maxPosition + 1,
      addedById: currentUserId,
      addedAt: Date.now(),
    });

    const playlistDoc = await db.collections["playlists"]?.findOne(playlistId).exec();
    if (playlistDoc) {
      const playlistState = (playlistDoc as { toJSON: (withMeta?: boolean) => Playlist }).toJSON(true);
      const songToAdd = songs.find((song) => song.id === songId);
      const nextCoverUrl = songToAdd ? albums.find((album) => album.id === songToAdd.albumId)?.coverUrl || "" : "";
      const patch: { updatedAt: number; coverUrl?: string } = {
        updatedAt: Date.now(),
      };
      if (!playlistState.coverUrl && nextCoverUrl) {
        patch.coverUrl = nextCoverUrl;
      }
      await (playlistDoc as { incrementalPatch: (nextPatch: typeof patch) => Promise<void> }).incrementalPatch(patch);
    }
  }, [albums, currentUserId, db, playlistSongs, songs]);

  const handleRemoveSongFromPlaylist = useCallback(async (playlistSongId: string, playlistId: string) => {
    if (!db) return;
    const playlistSongDoc = await db.collections["playlistSongs"]?.findOne(playlistSongId).exec();
    if (!playlistSongDoc) return;

    await playlistSongDoc.remove();

    const playlistDoc = await db.collections["playlists"]?.findOne(playlistId).exec();
    if (playlistDoc) {
      const remainingEntries = [...playlistSongs]
        .filter((entry) => entry.id !== playlistSongId && entry.playlistId === playlistId)
        .sort((a, b) => a.position - b.position);
      const leadSong = remainingEntries.length > 0
        ? songs.find((song) => song.id === remainingEntries[0]?.songId) || null
        : null;
      const patch = {
        updatedAt: Date.now(),
        coverUrl: leadSong ? albums.find((album) => album.id === leadSong.albumId)?.coverUrl || "" : "",
      };
      await (playlistDoc as { incrementalPatch: (nextPatch: typeof patch) => Promise<void> }).incrementalPatch(patch);
    }
  }, [albums, db, playlistSongs, songs]);

  const handlePlaySong = useCallback(async (song: Song) => {
    setCurrentSong(song);
    if (!db) return;

    const currentUserDoc = await db.collections["users"]?.findOne(currentUserId).exec();
    if (!currentUserDoc) {
      return;
    }

    const now = Date.now();
    await (currentUserDoc as {
      incrementalPatch: (nextPatch: {
        nowPlayingSongId: string;
        nowPlayingUpdatedAt: number;
        lastActiveAt: number;
        updatedAt: number;
      }) => Promise<void>;
    }).incrementalPatch({
      nowPlayingSongId: song.id,
      nowPlayingUpdatedAt: now,
      lastActiveAt: now,
      updatedAt: now,
    });
  }, [currentUserId, db]);

  const disableLayoutTransitionsTemporarily = useCallback(() => {
    setAllowLayoutTransitions(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAllowLayoutTransitions(true);
      });
    });
  }, []);

  const handleDebuggerDockToggle = useCallback(() => {
    disableLayoutTransitionsTemporarily();
    setDebuggerDock((currentDock) => (currentDock === "bottom" ? "right" : "bottom"));
  }, [disableLayoutTransitionsTemporarily]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizingLayout(true);
    setAllowLayoutTransitions(false);
    document.body.style.cursor = debuggerDock === "bottom" ? "ns-resize" : "ew-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      if (debuggerDock === "bottom") {
        const newHeight = window.innerHeight - e.clientY;
        setDebuggerHeight(Math.max(DEBUGGER_MIN_HEIGHT, Math.min(window.innerHeight - 100, newHeight)));
      } else {
        const newWidth = window.innerWidth - e.clientX;
        setDebuggerWidth(Math.max(DEBUGGER_MIN_WIDTH, Math.min(window.innerWidth - 300, newWidth)));
      }
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      setIsResizingLayout(false);
      setAllowLayoutTransitions(true);
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
  const getUserName = (userId: string) => users.find((user) => user.id === userId)?.displayName || "Unknown";

  const artistSongs = selectedArtist ? songs.filter(s => s.artistId === selectedArtist.id) : [];
  const artistAlbums = selectedArtist ? albums.filter(a => a.artistId === selectedArtist.id) : [];
  const selectedPlaylist = selectedPlaylistId ? playlists.find((playlist) => playlist.id === selectedPlaylistId) || null : null;
  const userById = new Map(users.map((user) => [user.id, user]));
  const songById = new Map(songs.map((song) => [song.id, song]));
  const friendActivities: FriendActivity[] = userFriends
    .filter((edge) => edge.userId === currentUserId)
    .sort((a, b) => a.position - b.position)
    .flatMap((edge) => {
      const friend = userById.get(edge.friendId);
      if (!friend) {
        return [];
      }

      const currentSong = friend.nowPlayingSongId ? songById.get(friend.nowPlayingSongId) : undefined;
      return [{
        id: edge.id,
        friendId: friend.id,
        friendName: friend.displayName,
        avatarColor: friend.avatarColor,
        currentSongId: currentSong?.id,
        currentSongTitle: currentSong?.title ?? "Nothing queued",
        currentArtistName: currentSong ? getArtistName(currentSong.artistId) : "Offline",
        updatedAt: friend.nowPlayingUpdatedAt ?? friend.updatedAt ?? friend.lastActiveAt,
      }];
    });

  // Stats for the debugger header
  const stats = {
    artists: artists.length,
    albums: albums.length,
    songs: songs.length,
    playlists: playlists.length,
    users: users.length,
    userFriends: userFriends.length,
  };
  const totalDocs = stats.artists + stats.albums + stats.songs + stats.playlists + stats.users + stats.userFriends;
  const recentEvents = events.slice(0, 5);
  const debuggerReservedWidth =
    showDebugger && debuggerDock === "right"
      ? (isMinimized ? DEBUGGER_MINIMIZED_SIZE : debuggerWidth)
      : 0;
  const debuggerReservedHeight =
    showDebugger && debuggerDock === "bottom"
      ? (isMinimized ? DEBUGGER_MINIMIZED_SIZE : debuggerHeight)
      : 0;
  const shouldAnimateLayout = allowLayoutTransitions && !isResizingLayout;
  const layoutTransition = shouldAnimateLayout ? "margin 0.2s ease-out" : "none";
  const debuggerPanelTransition = shouldAnimateLayout
    ? "height 0.2s ease-out, width 0.2s ease-out"
    : "none";
  const isRightDockMinimized = debuggerDock === "right" && isMinimized;

  if (!db) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white text-black overflow-hidden isolate">
      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-white p-4 flex flex-col gap-6 border-r border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-red-400 rounded-xl flex items-center justify-center shadow">
              <span className="text-lg">♪</span>
            </div>
            <span className="font-bold text-lg tracking-tight">Music</span>
          </div>

          <nav className="flex flex-col gap-1">
            <NavButton active={activeView === "home"} onClick={() => { setActiveView("home"); setSelectedArtist(null); setSelectedPlaylistId(null); }}>
              <HomeIcon /> Home
            </NavButton>
            <NavButton active={activeView === "songs"} onClick={() => { setActiveView("songs"); setSelectedArtist(null); setSelectedPlaylistId(null); }}>
              <MusicIcon /> All Songs
            </NavButton>
          </nav>

          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Library</p>
              <button
                onClick={() => setCreatePlaylistOpen(true)}
                className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 hover:text-pink-500 hover:bg-gray-200 transition-colors flex items-center justify-center shadow-sm"
                title="Create playlist"
              >
                <PlusIcon />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              <NavButton active={activeView === "artists"} onClick={() => { setActiveView("artists"); setSelectedArtist(null); setSelectedPlaylistId(null); }}>
                <ArtistIcon /> Artists
              </NavButton>
              <NavButton active={activeView === "albums"} onClick={() => { setActiveView("albums"); setSelectedArtist(null); setSelectedPlaylistId(null); }}>
                <AlbumIcon /> Albums
              </NavButton>
              <NavButton active={activeView === "playlists"} onClick={() => { setActiveView("playlists"); setSelectedArtist(null); setSelectedPlaylistId(null); }}>
                <PlaylistIcon /> Playlists
              </NavButton>
            </nav>

            <div className="mt-4 space-y-1 max-h-44 overflow-y-auto pr-1">
              {playlists.slice(0, 8).map((playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => handleOpenPlaylist(playlist.id)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm truncate transition-colors ${
                    selectedPlaylistId === playlist.id && activeView === "playlists"
                      ? "bg-pink-50 text-pink-600"
                      : "text-gray-500 hover:text-pink-500 hover:bg-gray-100"
                  }`}
                >
                  {playlist.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-2">
            {!isSeeded ? (
              <button
                onClick={handleSeed}
                disabled={isSeeding}
                className="w-full py-2 bg-pink-500 hover:bg-pink-400 disabled:opacity-50 text-white font-semibold rounded-full text-sm transition-colors shadow"
              >
                {isSeeding ? "Loading..." : "Load Demo Data"}
              </button>
            ) : (
              <button
                onClick={handleClear}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm transition-colors shadow"
              >
                Clear Library
              </button>
            )}
          </div>
        </aside>

        <div
          className="flex flex-1 overflow-hidden"
          style={{
            marginRight: debuggerReservedWidth,
            marginBottom: debuggerReservedHeight,
            transition: layoutTransition,
          }}
        >
          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-gradient-to-b from-white to-gray-50">
            {activeView === "home" && <HomeView artists={artists} albums={albums} songs={songs} onPlaySong={(song) => { void handlePlaySong(song); }} onSelectArtist={(a) => { setSelectedArtist(a); setActiveView("artists"); }} />}
            {activeView === "artists" && !selectedArtist && <ArtistsGrid artists={artists} onSelect={setSelectedArtist} />}
            {activeView === "artists" && selectedArtist && (
              <ArtistDetail
                artist={selectedArtist}
                albums={artistAlbums}
                songs={artistSongs}
                onBack={() => setSelectedArtist(null)}
                onPlaySong={(song) => { void handlePlaySong(song); }}
                currentSong={currentSong}
              />
            )}
            {activeView === "albums" && <AlbumsGrid albums={albums} getArtistName={getArtistName} />}
            {activeView === "songs" && <SongsView songs={songs} getArtistName={getArtistName} getAlbumTitle={getAlbumTitle} onPlaySong={(song) => { void handlePlaySong(song); }} currentSong={currentSong} />}
            {activeView === "playlists" && !selectedPlaylist && (
              <PlaylistsView
                playlists={playlists}
                users={users}
                onSelectPlaylist={handleOpenPlaylist}
                onCreatePlaylist={() => setCreatePlaylistOpen(true)}
              />
            )}
            {activeView === "playlists" && selectedPlaylist && (
              <PlaylistDetailView
                playlist={selectedPlaylist}
                songs={songs}
                playlistSongs={playlistSongs}
                getArtistName={getArtistName}
                getAlbumTitle={getAlbumTitle}
                getUserName={getUserName}
                onBack={() => setSelectedPlaylistId(null)}
                onPlaySong={(song) => { void handlePlaySong(song); }}
                currentSong={currentSong}
                onAddSongToPlaylist={handleAddSongToPlaylist}
                onRemoveSongFromPlaylist={handleRemoveSongFromPlaylist}
              />
            )}
            <MediaAttributionFooter />
          </main>
          <FriendsSidebar
            friendActivities={friendActivities}
            isCollapsed={isFriendsCollapsed}
            onToggle={() => setIsFriendsCollapsed((prev) => !prev)}
          />
        </div>
      </div>

      {/* Now Playing Bar */}
      {currentSong && (
        <div
          className="h-20 bg-neutral-900 border-t border-neutral-800 px-4 flex items-center gap-4"
          style={{
            marginRight: debuggerReservedWidth,
            marginBottom: debuggerReservedHeight,
            transition: layoutTransition
          }}
        >
          <div className="w-14 h-14 bg-neutral-800 rounded overflow-hidden shrink-0">
            <AlbumCoverImage
              src={getAlbum(currentSong.albumId)?.coverUrl}
              alt={getAlbum(currentSong.albumId)?.title || currentSong.title}
              className="w-full h-full object-cover"
              fallbackClassName="bg-neutral-800 text-neutral-500 flex items-center justify-center text-lg"
              draggable={false}
            />
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

      <CreatePlaylistDialog
        open={createPlaylistOpen}
        playlistName={newPlaylistName}
        onPlaylistNameChange={setNewPlaylistName}
        onOpenChange={(open) => {
          setCreatePlaylistOpen(open);
          if (!open) {
            setNewPlaylistName("");
          }
        }}
        onCreatePlaylist={handleCreatePlaylist}
      />

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
          className={`fixed bg-neutral-950 border-neutral-800 shadow-2xl z-50 flex flex-col ${debuggerDock === "bottom"
            ? "inset-x-0 bottom-0 border-t"
            : "top-0 right-0 bottom-0 border-l"
            }`}
          style={{
            height: debuggerDock === "bottom" ? debuggerReservedHeight : "100%",
            width: debuggerDock === "right" ? debuggerReservedWidth : "100%",
            transition: debuggerPanelTransition,
          }}
        >
          {/* Resize Handle */}
          {!isRightDockMinimized && (
            <div
              onMouseDown={handleResizeStart}
              className={`absolute z-20 bg-transparent hover:bg-orange-500/30 transition-colors ${debuggerDock === "bottom"
                ? "top-0 left-0 right-0 h-2 cursor-ns-resize"
                : "top-0 left-0 bottom-0 w-2 cursor-ew-resize"
                }`}
            />
          )}

          {/* Header */}
          {isRightDockMinimized ? (
            <div className="flex flex-col items-center gap-1 p-1 border-b border-neutral-800 bg-neutral-900 shrink-0">
              <button
                onClick={() => setIsMinimized(false)}
                className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                title="Expand"
              >
                <ChevronUpIcon />
              </button>
              <button
                onClick={handleDebuggerDockToggle}
                className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                title="Dock to bottom"
              >
                <DockBottomIcon />
              </button>
              <button
                onClick={() => setShowDebugger(false)}
                className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                title="Close (Esc)"
              >
                <CloseIcon />
              </button>
            </div>
          ) : (
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
                  onClick={handleDebuggerDockToggle}
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
          )}

          {!isRightDockMinimized && (
            <>
              {/* Minimized Event Stream */}
              {isMinimized && debuggerDock === "bottom" && recentEvents.length > 0 && (
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
            </>
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

function formatPresenceRelativeTime(timestamp: number): string {
  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 1000) return "just now";
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function MediaImage({
  src,
  alt,
  className,
  fallback,
  draggable = false,
}: {
  src?: string;
  alt: string;
  className: string;
  fallback: JSX.Element;
  draggable?: boolean;
}) {
  const [hasError, setHasError] = useState(!src);

  useEffect(() => {
    setHasError(!src);
  }, [src]);

  if (!src || hasError) {
    return fallback;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={draggable}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

function ArtistImage({
  artist,
  className,
  fallbackClassName,
}: {
  artist: Artist;
  className: string;
  fallbackClassName: string;
}) {
  return (
    <MediaImage
      src={artist.imageUrl}
      alt={artist.name}
      className={className}
      fallback={(
        <div className={`${className} ${fallbackClassName}`}>
          {artist.name.charAt(0)}
        </div>
      )}
    />
  );
}

function AlbumCoverImage({
  src,
  alt,
  className,
  fallbackClassName,
  draggable = false,
}: {
  src?: string;
  alt: string;
  className: string;
  fallbackClassName: string;
  draggable?: boolean;
}) {
  return (
    <MediaImage
      src={src}
      alt={alt}
      className={className}
      draggable={draggable}
      fallback={(
        <div className={`${className} ${fallbackClassName}`}>
          ♪
        </div>
      )}
    />
  );
}

function MediaAttributionFooter() {
  return (
    <footer className="px-8 pb-10 pt-6 text-[11px] leading-5 text-neutral-500">
      Artist photos via <a className="text-neutral-300 hover:text-white transition-colors" href={MEDIA_ATTRIBUTION_LINKS.artistPhotos} target="_blank" rel="noreferrer">Wikimedia Commons</a>.
      Album artwork via <a className="text-neutral-300 hover:text-white transition-colors" href={MEDIA_ATTRIBUTION_LINKS.albumCovers} target="_blank" rel="noreferrer">Cover Art Archive</a> and <a className="text-neutral-300 hover:text-white transition-colors" href={MEDIA_ATTRIBUTION_LINKS.musicbrainz} target="_blank" rel="noreferrer">MusicBrainz</a>.
      Rights remain with the original copyright holders and licensors.
    </footer>
  );
}

function FriendsSidebar({
  friendActivities,
  isCollapsed,
  onToggle,
}: {
  friendActivities: FriendActivity[];
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={`border-l border-neutral-900 bg-neutral-950/90 backdrop-blur-sm transition-[width] duration-200 ease-out shrink-0 ${
        isCollapsed ? "w-11" : "w-72"
      }`}
    >
      <div className="flex items-center justify-between border-b border-neutral-900 px-3 py-3">
        <button
          onClick={onToggle}
          className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors flex items-center justify-center shrink-0"
          title={isCollapsed ? "Expand friends activity" : "Collapse friends activity"}
        >
          {isCollapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </button>
        {!isCollapsed && (
          <div className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">
            Friends Activity
          </div>
        )}
      </div>

      {isCollapsed ? (
        <div className="flex flex-col items-center gap-2 pt-3">
          {friendActivities.slice(0, 6).map((friend) => (
            <div
              key={friend.id}
              className="w-7 h-7 rounded-full text-[11px] font-semibold text-white flex items-center justify-center"
              style={{ backgroundColor: friend.avatarColor }}
              title={`${friend.friendName}: ${friend.currentSongTitle}`}
            >
              {friend.friendName.charAt(0)}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-y-auto h-[calc(100%-53px)] p-3">
          {friendActivities.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-700 p-4 text-xs text-neutral-400">
              Friend graph data is syncing…
            </div>
          ) : (
            <div className="space-y-2">
              {friendActivities.map((friend) => (
                <div
                  key={friend.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-7 h-7 rounded-full text-[11px] font-semibold text-white flex items-center justify-center"
                      style={{ backgroundColor: friend.avatarColor }}
                    >
                      {friend.friendName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {friend.friendName}
                      </div>
                      <div className="text-[11px] text-green-400">
                        {friend.currentSongId ? "Listening now" : "Recently active"}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-white truncate">♪ {friend.currentSongTitle}</div>
                  <div className="text-[11px] text-neutral-400 truncate">{friend.currentArtistName}</div>
                  <div className="text-[10px] text-neutral-500 mt-1">
                    Updated {formatPresenceRelativeTime(friend.updatedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function HomeView({ artists, albums, songs, onPlaySong, onSelectArtist }: {
  artists: Artist[];
  albums: Album[];
  songs: Song[];
  onPlaySong: (song: Song) => void;
  onSelectArtist: (artist: Artist) => void;
}) {
  const topSongs = [...songs].sort((a, b) => b.playCount - a.playCount).slice(0, 6);
  const featuredArtists = artists.slice(0, 6);
  const albumById = new Map(albums.map((album) => [album.id, album]));

  if (artists.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-8">
        <div className="text-center w-96">
          <div className="w-24 h-24 bg-neutral-800 rounded-full flex items-center justify-center mb-6 mx-auto">
            <span className="text-4xl">🎵</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to RxTunes</h1>
          <p className="text-neutral-400 text-lg">
            Your music library is empty. Load the demo data to explore artists, albums, and songs.
          </p>
        </div>
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
            <ArtistImage
              artist={artist}
              className="w-16 h-16 object-cover shrink-0"
              fallbackClassName="bg-linear-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl text-white"
            />
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
              <AlbumCoverImage
                src={albumById.get(song.albumId)?.coverUrl}
                alt={albumById.get(song.albumId)?.title || song.title}
                className="w-10 h-10 rounded shrink-0 object-cover"
                fallbackClassName="bg-neutral-800 text-neutral-500 flex items-center justify-center text-sm"
              />
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
                <AlbumCoverImage
                  src={album.coverUrl}
                  alt={album.title}
                  className="w-full h-full object-cover"
                  fallbackClassName="bg-neutral-800 text-neutral-500 flex items-center justify-center text-4xl"
                />
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
            <ArtistImage
              artist={artist}
              className="w-full aspect-square rounded-full mb-3 object-cover shadow-lg group-hover:scale-105 transition-transform"
              fallbackClassName="bg-linear-to-br from-purple-600 to-blue-500 flex items-center justify-center text-4xl text-white"
            />
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
  const albumById = new Map(albums.map((album) => [album.id, album]));

  return (
    <div>
      {/* Hero */}
      <div className="h-80 bg-linear-to-b from-purple-900 to-transparent p-8 flex items-end">
        <div className="flex items-end gap-6">
          <ArtistImage
            artist={artist}
            className="w-40 h-40 rounded-full object-cover shadow-2xl border border-white/10"
            fallbackClassName="bg-linear-to-br from-purple-600 to-blue-500 flex items-center justify-center text-6xl text-white"
          />
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
                <AlbumCoverImage
                  src={albumById.get(song.albumId)?.coverUrl}
                  alt={albumById.get(song.albumId)?.title || song.title}
                  className="w-10 h-10 rounded shrink-0 object-cover"
                  fallbackClassName="bg-neutral-800 text-neutral-500 flex items-center justify-center text-sm"
                />
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
                    <AlbumCoverImage
                      src={album.coverUrl}
                      alt={album.title}
                      className="w-full h-full object-cover"
                      fallbackClassName="bg-neutral-800 text-neutral-500 flex items-center justify-center text-4xl"
                    />
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
              <AlbumCoverImage
                src={album.coverUrl}
                alt={album.title}
                className="w-full h-full object-cover"
                fallbackClassName="bg-neutral-800 text-neutral-500 flex items-center justify-center text-4xl"
              />
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

function PlaylistsView({
  playlists,
  users,
  onSelectPlaylist,
  onCreatePlaylist,
}: {
  playlists: Playlist[];
  users: User[];
  onSelectPlaylist: (playlistId: string) => void;
  onCreatePlaylist: () => void;
}) {
  const getUserName = (id: string) => users.find((user) => user.id === id)?.displayName || "Unknown";

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Playlists</h1>
        <button
          onClick={onCreatePlaylist}
          className="px-4 py-2 rounded-full bg-white text-black font-semibold hover:scale-105 transition-transform"
        >
          Create playlist
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className="border border-neutral-800 rounded-xl p-10 text-center bg-neutral-900/50">
          <p className="text-xl font-semibold mb-2">No playlists yet</p>
          <p className="text-neutral-400 mb-6">Create your first playlist and start adding songs.</p>
          <button
            onClick={onCreatePlaylist}
            className="px-5 py-2.5 rounded-full bg-green-500 text-black font-semibold hover:bg-green-400 transition-colors"
          >
            Create playlist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-6">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => onSelectPlaylist(playlist.id)}
              className="group text-left rounded-lg p-3 hover:bg-neutral-800/60 transition-colors"
            >
              <div className="aspect-square bg-linear-to-br from-indigo-500 to-purple-600 rounded-lg mb-3 relative shadow-lg overflow-hidden">
                {playlist.coverUrl ? (
                  <AlbumCoverImage
                    src={playlist.coverUrl}
                    alt={playlist.name}
                    className="w-full h-full object-cover"
                    fallbackClassName="bg-linear-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-5xl"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl">🎶</div>
                )}
                <span className="absolute bottom-2 right-2 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-xl text-black">
                  <PlayIcon />
                </span>
              </div>
              <p className="font-medium truncate">{playlist.name}</p>
              <p className="text-neutral-400 text-sm truncate">By {getUserName(playlist.ownerId)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaylistDetailView({
  playlist,
  songs,
  playlistSongs,
  getArtistName,
  getAlbumTitle,
  getUserName,
  onBack,
  onPlaySong,
  currentSong,
  onAddSongToPlaylist,
  onRemoveSongFromPlaylist,
}: {
  playlist: Playlist;
  songs: Song[];
  playlistSongs: PlaylistSong[];
  getArtistName: (id: string) => string;
  getAlbumTitle: (id: string) => string;
  getUserName: (id: string) => string;
  onBack: () => void;
  onPlaySong: (song: Song) => void;
  currentSong: Song | null;
  onAddSongToPlaylist: (playlistId: string, songId: string) => Promise<void>;
  onRemoveSongFromPlaylist: (playlistSongId: string, playlistId: string) => Promise<void>;
}) {
  const playlistEntries = [...playlistSongs]
    .filter((playlistSong) => playlistSong.playlistId === playlist.id)
    .sort((a, b) => a.position - b.position);
  const songsById = new Map(songs.map((song) => [song.id, song]));
  const playlistTracks: { entry: PlaylistSong; song: Song }[] = playlistEntries.flatMap((entry) => {
    const song = songsById.get(entry.songId);
    return song ? [{ entry, song }] : [];
  });
  const playlistSongIds = new Set(playlistEntries.map((entry) => entry.songId));
  const availableSongs = songs.filter((song) => !playlistSongIds.has(song.id));
  const totalDurationMs = playlistTracks.reduce((sum, track) => sum + track.song.durationMs, 0);

  return (
    <div>
      <div className="h-72 bg-linear-to-b from-emerald-800 to-transparent p-8 flex items-end">
        <div>
          <button onClick={onBack} className="text-neutral-300 hover:text-white mb-4 text-sm flex items-center gap-1">
            ← Back
          </button>
          <p className="text-xs uppercase tracking-widest text-neutral-300 mb-2">Playlist</p>
          <h1 className="text-6xl font-bold mb-2">{playlist.name}</h1>
          <p className="text-neutral-300">
            By {getUserName(playlist.ownerId)} • {playlistTracks.length} songs • {formatDuration(totalDurationMs)}
          </p>
        </div>
      </div>

      <div className="p-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => playlistTracks[0] && onPlaySong(playlistTracks[0].song)}
            className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-xl"
          >
            <PlayIcon />
          </button>

          <Menu.Root modal={false}>
            <Menu.Trigger className="px-4 py-2 rounded-full border border-neutral-700 text-sm font-semibold hover:border-white transition-colors">
              Add songs
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={10} align="start">
                <Menu.Popup className="z-[75] w-80 max-h-80 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-2xl">
                  {availableSongs.length === 0 ? (
                    <Menu.Item disabled className="px-3 py-2 text-neutral-500 text-sm">
                      All songs are already in this playlist
                    </Menu.Item>
                  ) : (
                    availableSongs.map((song) => (
                      <Menu.Item
                        key={song.id}
                        onClick={() => void onAddSongToPlaylist(playlist.id, song.id)}
                        className="px-3 py-2 rounded text-sm cursor-pointer text-white hover:bg-neutral-800 data-[highlighted]:bg-neutral-800 data-[highlighted]:outline-none"
                      >
                        <p className="truncate">{song.title}</p>
                        <p className="text-xs text-neutral-400 truncate">{getArtistName(song.artistId)}</p>
                      </Menu.Item>
                    ))
                  )}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-b border-neutral-800 text-neutral-400 text-sm mb-2">
          <span className="w-8 text-center">#</span>
          <span className="flex-1">Title</span>
          <span className="w-56">Album</span>
          <span className="w-14 text-right">⏱</span>
          <span className="w-10" />
        </div>

        {playlistTracks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-700 p-10 text-center text-neutral-400">
            Open the Add songs menu to add tracks to this playlist.
          </div>
        ) : (
          <div className="flex flex-col">
            {playlistTracks.map(({ entry, song }, index) => (
              <div
                key={entry.id}
                className={`flex items-center gap-4 px-4 py-2 rounded transition-colors ${
                  currentSong?.id === song.id ? "bg-neutral-800/60" : "hover:bg-neutral-800/50"
                }`}
              >
                <button
                  onClick={() => onPlaySong(song)}
                  className="flex items-center gap-4 flex-1 min-w-0 text-left"
                >
                  <span className="w-8 text-neutral-500 text-center text-sm">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${currentSong?.id === song.id ? "text-green-500" : "text-white"}`}>
                      {song.title}
                    </p>
                    <p className="text-neutral-400 text-sm truncate">{getArtistName(song.artistId)}</p>
                  </div>
                  <span className="w-56 text-neutral-400 text-sm truncate">{getAlbumTitle(song.albumId)}</span>
                  <span className="w-14 text-neutral-500 text-sm text-right">{formatDuration(song.durationMs)}</span>
                </button>

                <Menu.Root modal={false}>
                  <Menu.Trigger className="w-8 h-8 rounded-full hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors flex items-center justify-center">
                    <MoreIcon />
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner sideOffset={8} align="end">
                      <Menu.Popup className="z-[75] rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-2xl min-w-52">
                        <Menu.Item
                          onClick={() => void onRemoveSongFromPlaylist(entry.id, playlist.id)}
                          className="px-3 py-2 rounded text-sm cursor-pointer text-red-300 hover:bg-red-500/20 data-[highlighted]:bg-red-500/20 data-[highlighted]:outline-none"
                        >
                          Remove from this playlist
                        </Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreatePlaylistDialog({
  open,
  playlistName,
  onPlaylistNameChange,
  onOpenChange,
  onCreatePlaylist,
}: {
  open: boolean;
  playlistName: string;
  onPlaylistNameChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onCreatePlaylist: () => Promise<void>;
}) {
  const isValid = playlistName.trim().length > 0;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/70"
        aria-label="Close create playlist modal"
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-xl bg-neutral-900 border border-neutral-700 p-6 shadow-2xl">
          <h2 className="text-2xl font-bold mb-1">Create playlist</h2>
          <p className="text-neutral-400 mb-6">Give your playlist a name to start building it.</p>

          <label htmlFor="new-playlist-name" className="text-sm text-neutral-400 block mb-2">
            Playlist name
          </label>
          <input
            id="new-playlist-name"
            value={playlistName}
            onChange={(e) => onPlaylistNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isValid) {
                e.preventDefault();
                void onCreatePlaylist();
              }
            }}
            placeholder="My Playlist #1"
            autoFocus
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-white focus:border-green-400 focus:outline-none"
          />

          <div className="flex flex-wrap gap-2 mt-3">
            {["Cursor Mix", "Weekend Drive", "Late Night Focus"].map((suggestedName) => (
              <button
                key={suggestedName}
                onClick={() => onPlaylistNameChange(suggestedName)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors"
              >
                {suggestedName}
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-full text-white hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void onCreatePlaylist()}
              disabled={!isValid}
              className="px-5 py-2 rounded-full bg-white text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
            >
              Create
            </button>
          </div>
        </div>
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

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M3 10a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0z" />
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

function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
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
