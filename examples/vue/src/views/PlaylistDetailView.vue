<script setup lang="ts">
import { computed } from "vue";
import type { Playlist, PlaylistSong, Song } from "../types";
import { formatDuration } from "../db";
import DropdownMenu from "../components/DropdownMenu.vue";
import { MoreIcon, PlayIcon } from "../components/icons";

const props = defineProps<{
  playlist: Playlist;
  songs: Song[];
  playlistSongs: PlaylistSong[];
  currentSong: Song | null;
  getArtistName: (id: string) => string;
  getAlbumTitle: (id: string) => string;
  getUserName: (id: string) => string;
}>();

const emit = defineEmits<{
  back: [];
  playSong: [song: Song];
  addSongToPlaylist: [playlistId: string, songId: string];
  removeSongFromPlaylist: [playlistSongId: string, playlistId: string];
}>();

const playlistEntries = computed(() =>
  [...props.playlistSongs]
    .filter((playlistSong) => playlistSong.playlistId === props.playlist.id)
    .sort((a, b) => a.position - b.position),
);

const songsById = computed(() => new Map(props.songs.map((song) => [song.id, song])));

const playlistTracks = computed(() =>
  playlistEntries.value.flatMap((entry) => {
    const song = songsById.value.get(entry.songId);
    return song ? [{ entry, song }] : [];
  }),
);

const playlistSongIds = computed(
  () => new Set(playlistEntries.value.map((entry) => entry.songId)),
);

const availableSongs = computed(() =>
  props.songs.filter((song) => !playlistSongIds.value.has(song.id)),
);

const totalDurationMs = computed(() =>
  playlistTracks.value.reduce((sum, track) => sum + track.song.durationMs, 0),
);
</script>

<template>
  <div>
    <div class="h-72 bg-linear-to-b from-emerald-800 to-transparent p-8 flex items-end">
      <div>
        <button
          type="button"
          class="text-neutral-300 hover:text-white mb-4 text-sm flex items-center gap-1"
          @click="emit('back')"
        >
          ← Back
        </button>
        <p class="text-xs uppercase tracking-widest text-neutral-300 mb-2">Playlist</p>
        <h1 class="text-6xl font-bold mb-2">{{ playlist.name }}</h1>
        <p class="text-neutral-300">
          By {{ getUserName(playlist.ownerId) }} • {{ playlistTracks.length }} songs •
          {{ formatDuration(totalDurationMs) }}
        </p>
      </div>
    </div>

    <div class="p-8">
      <div class="flex items-center gap-4 mb-8">
        <button
          type="button"
          class="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-xl"
          @click="playlistTracks[0] && emit('playSong', playlistTracks[0].song)"
        >
          <PlayIcon />
        </button>

        <DropdownMenu min-width-class="w-80">
          <template #trigger>
            <button
              type="button"
              class="px-4 py-2 rounded-full border border-neutral-700 text-sm font-semibold hover:border-white transition-colors"
            >
              Add songs
            </button>
          </template>
          <template #default="{ close }">
            <button
              v-if="availableSongs.length === 0"
              type="button"
              disabled
              class="w-full px-3 py-2 text-neutral-500 text-sm text-left"
            >
              All songs are already in this playlist
            </button>
            <button
              v-for="song in availableSongs"
              :key="song.id"
              type="button"
              class="w-full px-3 py-2 rounded text-sm cursor-pointer text-white hover:bg-neutral-800 text-left"
              @click="emit('addSongToPlaylist', playlist.id, song.id); close()"
            >
              <p class="truncate">{{ song.title }}</p>
              <p class="text-xs text-neutral-400 truncate">{{ getArtistName(song.artistId) }}</p>
            </button>
          </template>
        </DropdownMenu>
      </div>

      <div class="flex items-center gap-4 px-4 py-2 border-b border-neutral-800 text-neutral-400 text-sm mb-2">
        <span class="w-8 text-center">#</span>
        <span class="flex-1">Title</span>
        <span class="w-56">Album</span>
        <span class="w-14 text-right">⏱</span>
        <span class="w-10" />
      </div>

      <div
        v-if="playlistTracks.length === 0"
        class="rounded-xl border border-dashed border-neutral-700 p-10 text-center text-neutral-400"
      >
        Open the Add songs menu to add tracks to this playlist.
      </div>
      <div v-else class="flex flex-col">
        <div
          v-for="(track, index) in playlistTracks"
          :key="track.entry.id"
          class="flex items-center gap-4 px-4 py-2 rounded transition-colors"
          :class="currentSong?.id === track.song.id ? 'bg-neutral-800/60' : 'hover:bg-neutral-800/50'"
        >
          <button
            type="button"
            class="flex items-center gap-4 flex-1 min-w-0 text-left"
            @click="emit('playSong', track.song)"
          >
            <span class="w-8 text-neutral-500 text-center text-sm">{{ index + 1 }}</span>
            <div class="flex-1 min-w-0">
              <p
                class="font-medium truncate"
                :class="currentSong?.id === track.song.id ? 'text-green-500' : 'text-white'"
              >
                {{ track.song.title }}
              </p>
              <p class="text-neutral-400 text-sm truncate">{{ getArtistName(track.song.artistId) }}</p>
            </div>
            <span class="w-56 text-neutral-400 text-sm truncate">{{ getAlbumTitle(track.song.albumId) }}</span>
            <span class="w-14 text-neutral-500 text-sm text-right">{{ formatDuration(track.song.durationMs) }}</span>
          </button>

          <DropdownMenu align="end">
            <template #trigger>
              <button
                type="button"
                class="w-8 h-8 rounded-full hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors flex items-center justify-center"
              >
                <MoreIcon />
              </button>
            </template>
            <template #default="{ close }">
              <button
                type="button"
                class="w-full px-3 py-2 rounded text-sm cursor-pointer text-red-300 hover:bg-red-500/20 text-left"
                @click="emit('removeSongFromPlaylist', track.entry.id, playlist.id); close()"
              >
                Remove from this playlist
              </button>
            </template>
          </DropdownMenu>
        </div>
      </div>
    </div>
  </div>
</template>
