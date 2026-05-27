<script setup lang="ts">
import type { Song } from "../types";
import { formatDuration, formatPlayCount } from "../db";
import { PlayIcon } from "../components/icons";

defineProps<{
  songs: Song[];
  currentSong: Song | null;
  getArtistName: (id: string) => string;
  getAlbumTitle: (id: string) => string;
}>();

const emit = defineEmits<{
  playSong: [song: Song];
}>();
</script>

<template>
  <div class="p-8">
    <h1 class="text-3xl font-bold mb-6">All Songs</h1>

    <div class="flex items-center gap-4 px-4 py-2 border-b border-neutral-800 text-neutral-400 text-sm mb-2">
      <span class="w-8 text-center">#</span>
      <span class="flex-1">Title</span>
      <span class="w-48">Album</span>
      <span class="w-24 text-right">Plays</span>
      <span class="w-16 text-right">⏱</span>
    </div>

    <div class="flex flex-col">
      <button
        v-for="(song, idx) in songs"
        :key="song.id"
        type="button"
        class="flex items-center gap-4 px-4 py-2 rounded hover:bg-neutral-800/50 transition-colors text-left group"
        :class="currentSong?.id === song.id ? 'bg-neutral-800/50' : ''"
        @click="emit('playSong', song)"
      >
        <span class="w-8 text-neutral-500 text-center text-sm group-hover:hidden">{{ idx + 1 }}</span>
        <span class="w-8 text-center hidden group-hover:block"><PlayIcon /></span>
        <div class="flex-1 min-w-0">
          <p class="font-medium truncate" :class="currentSong?.id === song.id ? 'text-green-500' : ''">
            {{ song.title }}
          </p>
          <p class="text-neutral-400 text-sm truncate">{{ getArtistName(song.artistId) }}</p>
        </div>
        <span class="w-48 text-neutral-400 text-sm truncate">{{ getAlbumTitle(song.albumId) }}</span>
        <span class="w-24 text-neutral-500 text-sm text-right">{{ formatPlayCount(song.playCount) }}</span>
        <span class="w-16 text-neutral-500 text-sm text-right">{{ formatDuration(song.durationMs) }}</span>
      </button>
    </div>
  </div>
</template>
