<script setup lang="ts">
import type { Artist } from "../types";
import ArtistImage from "../components/ArtistImage.vue";

defineProps<{
  artists: Artist[];
}>();

const emit = defineEmits<{
  select: [artist: Artist];
}>();
</script>

<template>
  <div class="p-8">
    <h1 class="text-3xl font-bold mb-6">Artists</h1>
    <div class="grid grid-cols-5 gap-6">
      <button
        v-for="artist in artists"
        :key="artist.id"
        type="button"
        class="text-center group"
        @click="emit('select', artist)"
      >
        <ArtistImage
          :artist="artist"
          class="w-full aspect-square rounded-full mb-3 object-cover shadow-lg group-hover:scale-105 transition-transform"
          fallback-class-name="bg-linear-to-br from-purple-600 to-blue-500 flex items-center justify-center text-4xl text-white"
        />
        <p class="font-medium truncate">{{ artist.name }}</p>
        <p class="text-neutral-400 text-sm">{{ artist.genre }}</p>
      </button>
    </div>
  </div>
</template>
