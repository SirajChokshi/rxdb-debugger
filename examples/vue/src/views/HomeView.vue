<script setup lang="ts">
import { computed } from "vue";
import type { Album, Artist, Song } from "../types";
import { formatPlayCount } from "../db";
import AlbumCoverImage from "../components/AlbumCoverImage.vue";
import ArtistImage from "../components/ArtistImage.vue";
import { PlayIcon } from "../components/icons";

const props = defineProps<{
  artists: Artist[];
  albums: Album[];
  songs: Song[];
}>();

const emit = defineEmits<{
  playSong: [song: Song];
  selectArtist: [artist: Artist];
}>();

const topSongs = computed(() =>
  [...props.songs].sort((a, b) => b.playCount - a.playCount).slice(0, 6),
);
const featuredArtists = computed(() => props.artists.slice(0, 6));
const albumById = computed(() => new Map(props.albums.map((album) => [album.id, album])));
</script>

<template>
  <div v-if="artists.length === 0" class="flex items-center justify-center h-full px-8">
    <div class="text-center w-96">
      <div class="w-24 h-24 bg-neutral-800 rounded-full flex items-center justify-center mb-6 mx-auto">
        <span class="text-4xl">🎵</span>
      </div>
      <h1 class="text-3xl font-bold mb-2">Welcome to RxTunes</h1>
      <p class="text-neutral-400 text-lg">
        Your music library is empty. Load the demo data to explore artists, albums, and songs.
      </p>
    </div>
  </div>
  <div v-else class="p-8">
    <h1 class="text-3xl font-bold mb-8">Good evening</h1>

    <div class="grid grid-cols-3 gap-3 mb-10">
      <button
        v-for="artist in featuredArtists.slice(0, 6)"
        :key="artist.id"
        type="button"
        class="flex items-center gap-4 bg-neutral-800/50 hover:bg-neutral-800 rounded overflow-hidden text-left transition-colors group"
        @click="emit('selectArtist', artist)"
      >
        <ArtistImage
          :artist="artist"
          class="w-16 h-16 object-cover shrink-0"
          fallback-class-name="bg-linear-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl text-white"
        />
        <span class="font-semibold truncate pr-4">{{ artist.name }}</span>
      </button>
    </div>

    <section class="mb-10">
      <h2 class="text-2xl font-bold mb-4">Popular Tracks</h2>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="(song, idx) in topSongs"
          :key="song.id"
          type="button"
          class="flex items-center gap-3 p-2 rounded hover:bg-neutral-800/50 transition-colors text-left group"
          @click="emit('playSong', song)"
        >
          <span class="w-6 text-neutral-500 text-sm text-right">{{ idx + 1 }}</span>
          <AlbumCoverImage
            :src="albumById.get(song.albumId)?.coverUrl"
            :alt="albumById.get(song.albumId)?.title || song.title"
            class="w-10 h-10 rounded shrink-0 object-cover"
            fallback-class-name="bg-neutral-800 text-neutral-500 flex items-center justify-center text-sm"
          />
          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">{{ song.title }}</p>
            <p class="text-neutral-400 text-sm truncate">{{ formatPlayCount(song.playCount) }} plays</p>
          </div>
          <span class="text-neutral-500 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
            <PlayIcon />
          </span>
        </button>
      </div>
    </section>

    <section>
      <h2 class="text-2xl font-bold mb-4">Featured Albums</h2>
      <div class="grid grid-cols-5 gap-6">
        <div v-for="album in albums.slice(0, 5)" :key="album.id" class="group">
          <div class="aspect-square bg-neutral-800 rounded-lg mb-3 overflow-hidden relative">
            <AlbumCoverImage
              :src="album.coverUrl"
              :alt="album.title"
              class="w-full h-full object-cover"
              fallback-class-name="bg-neutral-800 text-neutral-500 flex items-center justify-center text-4xl"
            />
            <button
              type="button"
              class="absolute bottom-2 right-2 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-xl"
            >
              <PlayIcon />
            </button>
          </div>
          <p class="font-medium truncate">{{ album.title }}</p>
          <p class="text-neutral-400 text-sm truncate">{{ album.releaseYear }}</p>
        </div>
      </div>
    </section>
  </div>
</template>
