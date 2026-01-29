import type { Playlist, PlaylistSong } from "./types.js";

export const PLAYLISTS: Playlist[] = [
  { id: "playlist-classicrock", name: "Classic Rock Essentials", description: "The greatest rock songs from the 60s to 80s", ownerId: "user-alice", isPublic: true, isCollaborative: false, followerCount: 15420 },
  { id: "playlist-hiphopbangers", name: "Hip-Hop Bangers", description: "Modern hip-hop hits that slap", ownerId: "user-eric", isPublic: true, isCollaborative: false, followerCount: 8930 },
  { id: "playlist-chillvibes", name: "Chill Vibes", description: "Relaxing songs for unwinding", ownerId: "user-charlie", isPublic: true, isCollaborative: true, followerCount: 4210 },
  { id: "playlist-roadtrip", name: "Road Trip Mix", description: "Perfect songs for the open road", ownerId: "user-diana", isPublic: true, isCollaborative: false, followerCount: 6780 },
  { id: "playlist-private", name: "My Private Favorites", description: "Just for me", ownerId: "user-bob", isPublic: false, isCollaborative: false, followerCount: 0 },
  { id: "playlist-90snostalgia", name: "90s Nostalgia", description: "The best of the 90s", ownerId: "user-alice", isPublic: true, isCollaborative: false, followerCount: 12300 },
];

export const PLAYLIST_SONGS: PlaylistSong[] = [
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
