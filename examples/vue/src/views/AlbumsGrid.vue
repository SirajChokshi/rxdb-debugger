<script setup lang="ts">
import type { Album } from "../types";
import AlbumCoverImage from "../components/AlbumCoverImage.vue";
import { PlayIcon } from "../components/icons";

defineProps<{
  albums: Album[];
  getArtistName: (id: string) => string;
}>();
</script>

<template>
  <div class="p-8">
    <h1 class="text-3xl font-bold mb-6">Albums</h1>
    <div class="grid grid-cols-5 gap-6">
      <div v-for="album in albums" :key="album.id" class="group">
        <div class="aspect-square bg-neutral-800 rounded-lg mb-3 overflow-hidden relative shadow-lg">
          <AlbumCoverImage
            :src="album.coverUrl"
            :alt="album.title"
            class="w-full h-full object-cover"
            fallback-class-name="bg-neutral-800 text-neutral-500 flex items-center justify-center text-4xl"
          />
          <button
            type="button"
            class="absolute bottom-2 right-2 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-xl text-black"
          >
            <PlayIcon />
          </button>
        </div>
        <p class="font-medium truncate">{{ album.title }}</p>
        <p class="text-neutral-400 text-sm truncate">{{ getArtistName(album.artistId) }}</p>
      </div>
    </div>
  </div>
</template>
