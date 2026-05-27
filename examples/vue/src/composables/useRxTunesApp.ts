import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
  type Ref,
} from "vue";
import type { RxChangeEvent, RxDatabase } from "rxdb";
import type { ExplorerDebuggerAdapter } from "@rxdb-debugger/ui";
import {
  getDatabase,
  seedDatabase,
  setupMockReplications,
} from "../db";
import type {
  Album,
  Artist,
  DbEvent,
  DebuggerDock,
  DebuggerWindow,
  FriendActivity,
  Playlist,
  PlaylistSong,
  Song,
  User,
  UserFriend,
  View,
} from "../types";

export const DEBUGGER_MINIMIZED_SIZE = 44;
export const DEBUGGER_MIN_HEIGHT = 200;
export const DEBUGGER_MIN_WIDTH = 300;
export const LOCAL_USER_ID = "user-alice";

function readBoolStorage(key: string, fallback = false): boolean {
  return localStorage.getItem(key) === "true" || fallback;
}

function readIntStorage(key: string, fallback: number): number {
  return parseInt(localStorage.getItem(key) || String(fallback), 10);
}

export function useRxTunesApp(debuggerRef: Ref<HTMLDivElement | null>) {
  const db = shallowRef<RxDatabase | null>(null);
  const isSeeded = ref(false);
  const isSeeding = ref(false);
  const activeView = ref<View>("home");

  const showDebugger = ref(readBoolStorage("rxdb-debugger-open"));
  const debuggerHeight = ref(readIntStorage("rxdb-debugger-height", 400));
  const debuggerWidth = ref(readIntStorage("rxdb-debugger-width", 500));
  const debuggerDock = ref<DebuggerDock>(
    (localStorage.getItem("rxdb-debugger-dock") as DebuggerDock) || "bottom",
  );
  const isMinimized = ref(false);
  const isResizingLayout = ref(false);
  const allowLayoutTransitions = ref(true);
  const events = ref<DbEvent[]>([]);
  const isFriendsCollapsed = ref(readBoolStorage("rxtunes-friends-collapsed"));

  const artists = ref<Artist[]>([]);
  const albums = ref<Album[]>([]);
  const songs = ref<Song[]>([]);
  const playlists = ref<Playlist[]>([]);
  const playlistSongs = ref<PlaylistSong[]>([]);
  const users = ref<User[]>([]);
  const userFriends = ref<UserFriend[]>([]);

  const selectedArtist = ref<Artist | null>(null);
  const selectedPlaylistId = ref<string | null>(null);
  const createPlaylistOpen = ref(false);
  const newPlaylistName = ref("");
  const currentSong = ref<Song | null>(null);

  const isResizingRef = ref(false);

  watch(showDebugger, (value) => {
    localStorage.setItem("rxdb-debugger-open", String(value));
  });
  watch(debuggerHeight, (value) => {
    localStorage.setItem("rxdb-debugger-height", String(value));
  });
  watch(debuggerWidth, (value) => {
    localStorage.setItem("rxdb-debugger-width", String(value));
  });
  watch(debuggerDock, (value) => {
    localStorage.setItem("rxdb-debugger-dock", value);
  });
  watch(isFriendsCollapsed, (value) => {
    localStorage.setItem("rxtunes-friends-collapsed", String(value));
  });

  function onKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "d") {
      e.preventDefault();
      showDebugger.value = !showDebugger.value;
    }
    if (e.key === "Escape" && showDebugger.value) {
      showDebugger.value = false;
    }
  }

  onMounted(() => {
    window.addEventListener("keydown", onKeyDown);
    let mounted = true;
    getDatabase().then(async (database) => {
      if (!mounted) return;
      db.value = database;
      const artistsCol = database.collections["artists"];
      if (artistsCol) {
        const artistCount = await artistsCol.count().exec();
        isSeeded.value = artistCount > 0;
      }
    });
    return () => {
      mounted = false;
    };
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", onKeyDown);
  });

  watch(db, (database) => {
    if (database) {
      setupMockReplications(database);
    }
  });

  const collectionSubscriptions: { unsubscribe: () => void }[] = [];

  function subscribeCollection<T>(
    colName: string,
    setter: (docs: T[]) => void,
    sort?: (a: T, b: T) => number,
  ) {
    const database = db.value;
    if (!database) return;
    const col = database.collections[colName];
    if (!col) return;
    const sub = col.find().$.subscribe((docs: unknown[]) => {
      let next = docs.map((d: unknown) =>
        (d as { toJSON: (flag: boolean) => T }).toJSON(true),
      );
      if (sort) {
        next = [...next].sort(sort);
      }
      setter(next);
    });
    collectionSubscriptions.push(sub);
  }

  watch(db, (database) => {
    for (const sub of collectionSubscriptions) {
      sub.unsubscribe();
    }
    collectionSubscriptions.length = 0;
    if (!database) return;

    const eventSubs: { unsubscribe: () => void }[] = [];
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
      const col = database.collections[colName];
      if (col) {
        const sub = col.$.subscribe((event: RxChangeEvent<unknown>) => {
          events.value = [
            {
              id: crypto.randomUUID(),
              collection: colName,
              operation: event.operation,
              documentId: event.documentId,
              timestamp: Date.now(),
            },
            ...events.value.slice(0, 99),
          ];
        });
        eventSubs.push(sub);
      }
    }

    subscribeCollection<Artist>("artists", (next) => { artists.value = next; });
    subscribeCollection<Album>("albums", (next) => { albums.value = next; });
    subscribeCollection<Song>("songs", (next) => { songs.value = next; });
    subscribeCollection<Playlist>("playlists", (next) => { playlists.value = next; });
    subscribeCollection<PlaylistSong>("playlistSongs", (next) => { playlistSongs.value = next; });
    subscribeCollection<User>("users", (next) => { users.value = next; });
    subscribeCollection<UserFriend>(
      "userFriends",
      (next) => { userFriends.value = next; },
      (a, b) => a.position - b.position,
    );

    return () => {
      eventSubs.forEach((s) => s.unsubscribe());
      collectionSubscriptions.forEach((s) => s.unsubscribe());
      collectionSubscriptions.length = 0;
    };
  });

  watch([playlists, selectedPlaylistId], () => {
    if (!selectedPlaylistId.value) return;
    if (!playlists.value.some((playlist) => playlist.id === selectedPlaylistId.value)) {
      selectedPlaylistId.value = null;
    }
  });

  const debuggerAdapter: ExplorerDebuggerAdapter = {
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
      const instances = Object.values(registry?.snapshot().instances ?? {});
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

  let debuggerUnmount: (() => void) | undefined;

  watch(
    [db, showDebugger, isMinimized, debuggerRef],
    async () => {
      debuggerUnmount?.();
      debuggerUnmount = undefined;
      const container = debuggerRef.value;
      const database = db.value;
      if (!container || !database || !showDebugger.value || isMinimized.value) {
        return;
      }
      const { mountExplorerDebugger } = await import("@rxdb-debugger/ui");
      debuggerUnmount = mountExplorerDebugger({
        container,
        adapter: debuggerAdapter,
        shellTheme: "auto",
        inspectorTheme: "auto",
        trackPerformance: true,
        initialPanel: "collections",
      });
    },
    { flush: "post" },
  );

  onUnmounted(() => {
    debuggerUnmount?.();
  });

  const currentUser = computed(
    () => users.value.find((user) => user.id === LOCAL_USER_ID) || null,
  );
  const currentUserId = computed(() => currentUser.value?.id || LOCAL_USER_ID);

  async function handleSeed() {
    const database = db.value;
    if (!database || isSeeding.value) return;
    isSeeding.value = true;
    try {
      await seedDatabase(database);
      isSeeded.value = true;
    } finally {
      isSeeding.value = false;
    }
  }

  async function handleClear() {
    const database = db.value;
    if (!database) return;
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
      const col = database.collections[colName];
      if (col) {
        const docs = await col.find().exec();
        await Promise.all(docs.map((d: { remove: () => Promise<void> }) => d.remove()));
      }
    }
    isSeeded.value = false;
    currentSong.value = null;
    selectedArtist.value = null;
    selectedPlaylistId.value = null;
    createPlaylistOpen.value = false;
    newPlaylistName.value = "";
    events.value = [];
    userFriends.value = [];
  }

  async function handleCreatePlaylist() {
    const database = db.value;
    if (!database) return;
    const name = newPlaylistName.value.trim();
    if (!name) return;
    const playlistsCollection = database.collections["playlists"];
    if (!playlistsCollection) return;

    const now = Date.now();
    const playlistId = `playlist-${crypto.randomUUID()}`;
    await playlistsCollection.insert({
      id: playlistId,
      name,
      description: `Created by ${currentUser.value?.displayName || "You"}`,
      ownerId: currentUserId.value,
      coverUrl: "",
      isPublic: false,
      isCollaborative: false,
      followerCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    newPlaylistName.value = "";
    createPlaylistOpen.value = false;
    selectedPlaylistId.value = playlistId;
    selectedArtist.value = null;
    activeView.value = "playlists";
  }

  function handleOpenPlaylist(playlistId: string) {
    selectedPlaylistId.value = playlistId;
    selectedArtist.value = null;
    activeView.value = "playlists";
  }

  async function handleAddSongToPlaylist(playlistId: string, songId: string) {
    const database = db.value;
    if (!database) return;
    const playlistSongsCollection = database.collections["playlistSongs"];
    if (!playlistSongsCollection) return;

    const existingRelation = playlistSongs.value.find(
      (playlistSong) => playlistSong.playlistId === playlistId && playlistSong.songId === songId,
    );
    if (existingRelation) return;

    const maxPosition = playlistSongs.value.reduce((max, playlistSong) => {
      if (playlistSong.playlistId !== playlistId) return max;
      return Math.max(max, playlistSong.position);
    }, 0);

    await playlistSongsCollection.insert({
      id: `ps-${crypto.randomUUID()}`,
      playlistId,
      songId,
      position: maxPosition + 1,
      addedById: currentUserId.value,
      addedAt: Date.now(),
    });

    const playlistDoc = await database.collections["playlists"]?.findOne(playlistId).exec();
    if (playlistDoc) {
      const playlistState = (playlistDoc as { toJSON: (withMeta?: boolean) => Playlist }).toJSON(true);
      const songToAdd = songs.value.find((song) => song.id === songId);
      const nextCoverUrl = songToAdd
        ? albums.value.find((album) => album.id === songToAdd.albumId)?.coverUrl || ""
        : "";
      const patch: { updatedAt: number; coverUrl?: string } = {
        updatedAt: Date.now(),
      };
      if (!playlistState.coverUrl && nextCoverUrl) {
        patch.coverUrl = nextCoverUrl;
      }
      await (playlistDoc as { incrementalPatch: (nextPatch: typeof patch) => Promise<void> })
        .incrementalPatch(patch);
    }
  }

  async function handleRemoveSongFromPlaylist(playlistSongId: string, playlistId: string) {
    const database = db.value;
    if (!database) return;
    const playlistSongDoc = await database.collections["playlistSongs"]?.findOne(playlistSongId).exec();
    if (!playlistSongDoc) return;

    await playlistSongDoc.remove();

    const playlistDoc = await database.collections["playlists"]?.findOne(playlistId).exec();
    if (playlistDoc) {
      const remainingEntries = [...playlistSongs.value]
        .filter((entry) => entry.id !== playlistSongId && entry.playlistId === playlistId)
        .sort((a, b) => a.position - b.position);
      const leadSong = remainingEntries.length > 0
        ? songs.value.find((song) => song.id === remainingEntries[0]?.songId) || null
        : null;
      const patch = {
        updatedAt: Date.now(),
        coverUrl: leadSong
          ? albums.value.find((album) => album.id === leadSong.albumId)?.coverUrl || ""
          : "",
      };
      await (playlistDoc as { incrementalPatch: (nextPatch: typeof patch) => Promise<void> })
        .incrementalPatch(patch);
    }
  }

  async function handlePlaySong(song: Song) {
    currentSong.value = song;
    const database = db.value;
    if (!database) return;

    const currentUserDoc = await database.collections["users"]?.findOne(currentUserId.value).exec();
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
  }

  function disableLayoutTransitionsTemporarily() {
    allowLayoutTransitions.value = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        allowLayoutTransitions.value = true;
      });
    });
  }

  function handleDebuggerDockToggle() {
    disableLayoutTransitionsTemporarily();
    debuggerDock.value = debuggerDock.value === "bottom" ? "right" : "bottom";
  }

  function handleResizeStart(e: MouseEvent) {
    e.preventDefault();
    isResizingRef.value = true;
    isResizingLayout.value = true;
    allowLayoutTransitions.value = false;
    document.body.style.cursor = debuggerDock.value === "bottom" ? "ns-resize" : "ew-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.value) return;
      if (debuggerDock.value === "bottom") {
        const newHeight = window.innerHeight - moveEvent.clientY;
        debuggerHeight.value = Math.max(
          DEBUGGER_MIN_HEIGHT,
          Math.min(window.innerHeight - 100, newHeight),
        );
      } else {
        const newWidth = window.innerWidth - moveEvent.clientX;
        debuggerWidth.value = Math.max(
          DEBUGGER_MIN_WIDTH,
          Math.min(window.innerWidth - 300, newWidth),
        );
      }
    };

    const handleMouseUp = () => {
      isResizingRef.value = false;
      isResizingLayout.value = false;
      allowLayoutTransitions.value = true;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  function getArtistName(artistId: string) {
    return artists.value.find((a) => a.id === artistId)?.name || "Unknown";
  }

  function getAlbumTitle(albumId: string) {
    return albums.value.find((a) => a.id === albumId)?.title || "Unknown";
  }

  function getAlbum(albumId: string) {
    return albums.value.find((a) => a.id === albumId);
  }

  function getUserName(userId: string) {
    return users.value.find((user) => user.id === userId)?.displayName || "Unknown";
  }

  const artistSongs = computed(() =>
    selectedArtist.value
      ? songs.value.filter((s) => s.artistId === selectedArtist.value!.id)
      : [],
  );

  const artistAlbums = computed(() =>
    selectedArtist.value
      ? albums.value.filter((a) => a.artistId === selectedArtist.value!.id)
      : [],
  );

  const selectedPlaylist = computed(() =>
    selectedPlaylistId.value
      ? playlists.value.find((playlist) => playlist.id === selectedPlaylistId.value) || null
      : null,
  );

  const friendActivities = computed<FriendActivity[]>(() => {
    const userById = new Map(users.value.map((user) => [user.id, user]));
    const songById = new Map(songs.value.map((song) => [song.id, song]));
    return userFriends.value
      .filter((edge) => edge.userId === currentUserId.value)
      .sort((a, b) => a.position - b.position)
      .flatMap((edge) => {
        const friend = userById.get(edge.friendId);
        if (!friend) {
          return [];
        }
        const playingSong = friend.nowPlayingSongId
          ? songById.get(friend.nowPlayingSongId)
          : undefined;
        return [{
          id: edge.id,
          friendId: friend.id,
          friendName: friend.displayName,
          avatarColor: friend.avatarColor,
          currentSongId: playingSong?.id,
          currentSongTitle: playingSong?.title ?? "Nothing queued",
          currentArtistName: playingSong ? getArtistName(playingSong.artistId) : "Offline",
          updatedAt: friend.nowPlayingUpdatedAt ?? friend.updatedAt ?? friend.lastActiveAt,
        }];
      });
  });

  const totalDocs = computed(() =>
    artists.value.length
    + albums.value.length
    + songs.value.length
    + playlists.value.length
    + users.value.length
    + userFriends.value.length,
  );

  const recentEvents = computed(() => events.value.slice(0, 5));

  const debuggerReservedWidth = computed(() =>
    showDebugger.value && debuggerDock.value === "right"
      ? (isMinimized.value ? DEBUGGER_MINIMIZED_SIZE : debuggerWidth.value)
      : 0,
  );

  const debuggerReservedHeight = computed(() =>
    showDebugger.value && debuggerDock.value === "bottom"
      ? (isMinimized.value ? DEBUGGER_MINIMIZED_SIZE : debuggerHeight.value)
      : 0,
  );

  const shouldAnimateLayout = computed(
    () => allowLayoutTransitions.value && !isResizingLayout.value,
  );

  const layoutTransition = computed(() =>
    shouldAnimateLayout.value ? "margin 0.2s ease-out" : "none",
  );

  const debuggerPanelTransition = computed(() =>
    shouldAnimateLayout.value ? "height 0.2s ease-out, width 0.2s ease-out" : "none",
  );

  const isRightDockMinimized = computed(
    () => debuggerDock.value === "right" && isMinimized.value,
  );

  function resetMainViews() {
    selectedArtist.value = null;
    selectedPlaylistId.value = null;
  }

  function setView(view: View) {
    activeView.value = view;
    resetMainViews();
  }

  return {
    db,
    isSeeded,
    isSeeding,
    activeView,
    showDebugger,
    debuggerHeight,
    debuggerWidth,
    debuggerDock,
    isMinimized,
    events,
    isFriendsCollapsed,
    artists,
    albums,
    songs,
    playlists,
    playlistSongs,
    users,
    selectedArtist,
    selectedPlaylistId,
    createPlaylistOpen,
    newPlaylistName,
    currentSong,
    artistSongs,
    artistAlbums,
    selectedPlaylist,
    friendActivities,
    totalDocs,
    recentEvents,
    debuggerReservedWidth,
    debuggerReservedHeight,
    layoutTransition,
    debuggerPanelTransition,
    isRightDockMinimized,
    handleSeed,
    handleClear,
    handleCreatePlaylist,
    handleOpenPlaylist,
    handleAddSongToPlaylist,
    handleRemoveSongFromPlaylist,
    handlePlaySong,
    handleDebuggerDockToggle,
    handleResizeStart,
    getArtistName,
    getAlbumTitle,
    getAlbum,
    getUserName,
    setView,
  };
}
