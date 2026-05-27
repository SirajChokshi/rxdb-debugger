<script setup lang="ts">
import { computed } from "vue";
import type { Album, Artist, Song } from "../types";
import { formatDuration, formatPlayCount } from "../db";
import AlbumCoverImage from "../components/AlbumCoverImage.vue";
import ArtistImage from "../components/ArtistImage.vue";
import { PlayIcon } from "../components/icons";

const props = defineProps<{
  artist: Artist;
  albums: Album[];
  songs: Song[];
  currentSong: Song | null;
}>();

const emit = defineEmits<{
  back: [];
  playSong: [song: Song];
}>();

const albumById = computed(() => new Map(props.albums.map((album) => [album.id, album])));
</script>

<template>
  <div>
    <div class="h-80 bg-linear-to-b from-purple-900 to-transparent p-8 flex items-end">
      <div class="flex items-end gap-6">
        <ArtistImage
          :artist="artist"
          class="w-40 h-40 rounded-full object-cover shadow-2xl border border-white/10"
          fallback-class-name="bg-linear-to-br from-purple-600 to-blue-500 flex items-center justify-center text-6xl text-white"
        />
        <div>
          <button
            type="button"
            class="text-neutral-300 hover:text-white mb-4 text-sm flex items-center gap-1"
            @click="emit('back')"
          >
            ← Back
          </button>
          <p v-if="artist.isVerified" class="text-xs text-blue-400 flex items-center gap-1 mb-1">
            <span>✓</span> Verified Artist
          </p>
          <h1 class="text-6xl font-bold mb-2">{{ artist.name }}</h1>
          <p class="text-neutral-300">{{ formatPlayCount(artist.monthlyListeners) }} monthly listeners</p>
        </div>
      </div>
    </div>

    <div class="p-8">
      <div class="flex items-center gap-6 mb-8">
        <button
          type="button"
          class="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-xl"
          @click="songs[0] && emit('playSong', songs[0])"
        >
          <PlayIcon />
        </button>
      </div>

      <section class="mb-10">
        <h2 class="text-xl font-bold mb-4">Popular</h2>
        <div class="flex flex-col">
          <button
            v-for="(song, idx) in songs.slice(0, 5)"
            :key="song.id"
            type="button"
            class="flex items-center gap-4 p-3 rounded hover:bg-neutral-800/50 transition-colors text-left group"
            :class="currentSong?.id === song.id ? 'bg-neutral-800/50' : ''"
            @click="emit('playSong', song)"
          >
            <span class="w-6 text-neutral-500 text-center">{{ idx + 1 }}</span>
            <AlbumCoverImage
              :src="albumById.get(song.albumId)?.coverUrl"
              :alt="albumById.get(song.albumId)?.title || song.title"
              class="w-10 h-10 rounded shrink-0 object-cover"
              fallback-class-name="bg-neutral-800 text-neutral-500 flex items-center justify-center text-sm"
            />
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate" :class="currentSong?.id === song.id ? 'text-green-500' : ''">
                {{ song.title }}
              </p>
            </div>
            <span class="text-neutral-500 text-sm">{{ formatPlayCount(song.playCount) }}</span>
            <span class="text-neutral-500 text-sm w-12 text-right">{{ formatDuration(song.durationMs) }}</span>
          </button>
        </div>
      </section>

      <section v-if="albums.length > 0">
        <h2 class="text-xl font-bold mb-4">Discography</h2>
        <div class="grid grid-cols-5 gap-6">
          <div v-for="album in albums" :key="album.id" class="group">
            <div class="aspect-square bg-neutral-800 rounded-lg mb-3 overflow-hidden">
              <AlbumCoverImage
                :src="album.coverUrl"
                :alt="album.title"
                class="w-full h-full object-cover"
                fallback-class-name="bg-neutral-800 text-neutral-500 flex items-center justify-center text-4xl"
              />
            </div>
            <p class="font-medium truncate">{{ album.title }}</p>
            <p class="text-neutral-400 text-sm">{{ album.releaseYear }} • Album</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
