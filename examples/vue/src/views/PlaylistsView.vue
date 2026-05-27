<script setup lang="ts">
import type { Playlist, User } from "../types";
import AlbumCoverImage from "../components/AlbumCoverImage.vue";
import { PlayIcon } from "../components/icons";

defineProps<{
  playlists: Playlist[];
  users: User[];
}>();

const emit = defineEmits<{
  selectPlaylist: [playlistId: string];
  createPlaylist: [];
}>();

function getUserName(users: User[], id: string) {
  return users.find((user) => user.id === id)?.displayName || "Unknown";
}
</script>

<template>
  <div class="p-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold">Playlists</h1>
      <button
        type="button"
        class="px-4 py-2 rounded-full bg-white text-black font-semibold hover:scale-105 transition-transform"
        @click="emit('createPlaylist')"
      >
        Create playlist
      </button>
    </div>

    <div
      v-if="playlists.length === 0"
      class="border border-neutral-800 rounded-xl p-10 text-center bg-neutral-900/50"
    >
      <p class="text-xl font-semibold mb-2">No playlists yet</p>
      <p class="text-neutral-400 mb-6">Create your first playlist and start adding songs.</p>
      <button
        type="button"
        class="px-5 py-2.5 rounded-full bg-green-500 text-black font-semibold hover:bg-green-400 transition-colors"
        @click="emit('createPlaylist')"
      >
        Create playlist
      </button>
    </div>
    <div v-else class="grid grid-cols-5 gap-6">
      <button
        v-for="playlist in playlists"
        :key="playlist.id"
        type="button"
        class="group text-left rounded-lg p-3 hover:bg-neutral-800/60 transition-colors"
        @click="emit('selectPlaylist', playlist.id)"
      >
        <div class="aspect-square bg-linear-to-br from-indigo-500 to-purple-600 rounded-lg mb-3 relative shadow-lg overflow-hidden">
          <AlbumCoverImage
            v-if="playlist.coverUrl"
            :src="playlist.coverUrl"
            :alt="playlist.name"
            class="w-full h-full object-cover"
            fallback-class-name="bg-linear-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-5xl"
            :draggable="false"
          />
          <div v-else class="w-full h-full flex items-center justify-center text-5xl">🎶</div>
          <span class="absolute bottom-2 right-2 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-xl text-black">
            <PlayIcon />
          </span>
        </div>
        <p class="font-medium truncate">{{ playlist.name }}</p>
        <p class="text-neutral-400 text-sm truncate">By {{ getUserName(users, playlist.ownerId) }}</p>
      </button>
    </div>
  </div>
</template>
