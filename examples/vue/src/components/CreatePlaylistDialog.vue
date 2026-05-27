<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  open: boolean;
  playlistName: string;
}>();

const emit = defineEmits<{
  "update:playlistName": [value: string];
  "update:open": [value: boolean];
  create: [];
}>();

const isValid = computed(() => props.playlistName.trim().length > 0);

const suggestions = ["Cursor Mix", "Weekend Drive", "Late Night Focus"];
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[70]">
    <button
      type="button"
      class="absolute inset-0 bg-black/70"
      aria-label="Close create playlist modal"
      @click="emit('update:open', false)"
    />

    <div class="absolute inset-0 flex items-center justify-center p-4">
      <div class="relative w-full max-w-lg rounded-xl bg-neutral-900 border border-neutral-700 p-6 shadow-2xl">
        <h2 class="text-2xl font-bold mb-1">Create playlist</h2>
        <p class="text-neutral-400 mb-6">Give your playlist a name to start building it.</p>

        <label for="new-playlist-name" class="text-sm text-neutral-400 block mb-2">Playlist name</label>
        <input
          id="new-playlist-name"
          :value="playlistName"
          placeholder="My Playlist #1"
          autofocus
          class="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-white focus:border-green-400 focus:outline-none"
          @input="emit('update:playlistName', ($event.target as HTMLInputElement).value)"
          @keydown.enter.prevent="isValid && emit('create')"
        />

        <div class="flex flex-wrap gap-2 mt-3">
          <button
            v-for="suggestedName in suggestions"
            :key="suggestedName"
            type="button"
            class="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors"
            @click="emit('update:playlistName', suggestedName)"
          >
            {{ suggestedName }}
          </button>
        </div>

        <div class="flex justify-end gap-3 mt-8">
          <button
            type="button"
            class="px-4 py-2 rounded-full text-white hover:bg-neutral-800 transition-colors"
            @click="emit('update:open', false)"
          >
            Cancel
          </button>
          <button
            type="button"
            class="px-5 py-2 rounded-full bg-white text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
            :disabled="!isValid"
            @click="emit('create')"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
