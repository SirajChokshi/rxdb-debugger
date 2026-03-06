export interface Artist {
  id: string;
  name: string;
  bio: string;
  genre: string;
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
  label: string;
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

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  subscriptionType: "free" | "premium" | "family";
  country: string;
  birthDate: string;
  avatarColor: string;
  nowPlayingSongId?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  isPublic: boolean;
  isCollaborative: boolean;
  followerCount: number;
}

export interface PlaylistSong {
  playlistId: string;
  songId: string;
  position: number;
  addedById: string;
}

export interface UserFriend {
  id: string;
  userId: string;
  friendId: string;
  position: number;
}
