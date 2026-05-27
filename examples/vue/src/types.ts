export interface Artist {
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

export interface Album {
  id: string;
  title: string;
  artistId: string;
  releaseYear: number;
  genre: string;
  coverUrl: string;
  totalTracks: number;
}

export interface Song {
  id: string;
  title: string;
  artistId: string;
  albumId: string;
  trackNumber: number;
  durationMs: number;
  genre: string;
  playCount: number;
}

export interface Playlist {
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

export interface PlaylistSong {
  id: string;
  playlistId: string;
  songId: string;
  position: number;
  addedById: string;
  addedAt: number;
}

export interface User {
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

export interface UserFriend {
  id: string;
  userId: string;
  friendId: string;
  position: number;
  createdAt: number;
}

export interface FriendActivity {
  id: string;
  friendId: string;
  friendName: string;
  avatarColor: string;
  currentSongId?: string;
  currentSongTitle: string;
  currentArtistName: string;
  updatedAt: number;
}

export interface DbEvent {
  id: string;
  collection: string;
  operation: string;
  documentId: string;
  timestamp: number;
}

export type View = "home" | "artists" | "albums" | "songs" | "playlists";
export type DebuggerDock = "bottom" | "right";

export type DebuggerWindow = typeof window & {
  __RXDB_DEBUGGER__?: {
    snapshot: () => {
      logicalDatabases: Record<string, import("@rxdb-debugger/ui").ExplorerLogicalDatabase>;
      instances: Record<string, import("@rxdb-debugger/ui").ExplorerDatabaseInstance>;
    };
    getInstanceHandle: (id: string) => import("rxdb").RxDatabase | null;
    closeInstance: (id: string) => Promise<boolean>;
    removeInstance: (id: string) => Promise<boolean>;
  };
};
