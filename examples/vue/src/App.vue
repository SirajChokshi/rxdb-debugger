<script setup lang="ts">
import { ref } from "vue";
import { formatDuration } from "./db";
import AlbumCoverImage from "./components/AlbumCoverImage.vue";
import CreatePlaylistDialog from "./components/CreatePlaylistDialog.vue";
import FriendsSidebar from "./components/FriendsSidebar.vue";
import MediaAttributionFooter from "./components/MediaAttributionFooter.vue";
import NavButton from "./components/NavButton.vue";
import {
  AlbumIcon,
  ArtistIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  DockBottomIcon,
  DockRightIcon,
  HomeIcon,
  MusicIcon,
  PlayIcon,
  PlaylistIcon,
  PlusIcon,
  SkipBackIcon,
  SkipForwardIcon,
  TerminalIcon,
} from "./components/icons";
import { useRxTunesApp } from "./composables/useRxTunesApp";
import AlbumsGrid from "./views/AlbumsGrid.vue";
import ArtistDetail from "./views/ArtistDetail.vue";
import ArtistsGrid from "./views/ArtistsGrid.vue";
import HomeView from "./views/HomeView.vue";
import PlaylistDetailView from "./views/PlaylistDetailView.vue";
import PlaylistsView from "./views/PlaylistsView.vue";
import SongsView from "./views/SongsView.vue";

const debuggerRef = ref<HTMLDivElement | null>(null);

const {
  db,
  isSeeded,
  isSeeding,
  activeView,
  showDebugger,
  debuggerDock,
  isMinimized,
  events,
  isFriendsCollapsed,
  artists,
  albums,
  songs,
  playlists,
  playlistSongs,
  users,
  selectedArtist,
  selectedPlaylistId,
  createPlaylistOpen,
  newPlaylistName,
  currentSong,
  artistSongs,
  artistAlbums,
  selectedPlaylist,
  friendActivities,
  totalDocs,
  recentEvents,
  debuggerReservedWidth,
  debuggerReservedHeight,
  layoutTransition,
  debuggerPanelTransition,
  isRightDockMinimized,
  handleSeed,
  handleClear,
  handleCreatePlaylist,
  handleOpenPlaylist,
  handleAddSongToPlaylist,
  handleRemoveSongFromPlaylist,
  handlePlaySong,
  handleDebuggerDockToggle,
  handleResizeStart,
  getArtistName,
  getAlbumTitle,
  getAlbum,
  getUserName,
  setView,
} = useRxTunesApp(debuggerRef);
</script>

<template>
  <div v-if="!db" class="flex items-center justify-center h-screen bg-black">
    <div class="text-center">
      <div class="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p class="text-neutral-400">Loading...</p>
    </div>
  </div>

  <div v-else class="h-screen flex flex-col bg-black text-white overflow-hidden isolate">
    <div class="flex flex-1 overflow-hidden">
      <aside class="w-56 bg-black p-4 flex flex-col gap-6 border-r border-neutral-900">
        <div class="flex items-center gap-2 px-2">
          <div class="w-8 h-8 bg-linear-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
            <span class="text-lg">♪</span>
          </div>
          <span class="font-bold text-lg">RxTunes</span>
        </div>

        <nav class="flex flex-col gap-1">
          <NavButton :active="activeView === 'home'" @click="setView('home')">
            <HomeIcon /> Home
          </NavButton>
          <NavButton :active="activeView === 'songs'" @click="setView('songs')">
            <MusicIcon /> All Songs
          </NavButton>
        </nav>

        <div>
          <div class="flex items-center justify-between px-3 mb-2">
            <p class="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Library</p>
            <button
              type="button"
              class="w-6 h-6 rounded-full bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors flex items-center justify-center"
              title="Create playlist"
              @click="createPlaylistOpen = true"
            >
              <PlusIcon />
            </button>
          </div>
          <nav class="flex flex-col gap-1">
            <NavButton :active="activeView === 'artists'" @click="setView('artists')">
              <ArtistIcon /> Artists
            </NavButton>
            <NavButton :active="activeView === 'albums'" @click="setView('albums')">
              <AlbumIcon /> Albums
            </NavButton>
            <NavButton :active="activeView === 'playlists'" @click="setView('playlists')">
              <PlaylistIcon /> Playlists
            </NavButton>
          </nav>

          <div class="mt-4 space-y-1 max-h-44 overflow-y-auto pr-1">
            <button
              v-for="playlist in playlists.slice(0, 8)"
              :key="playlist.id"
              type="button"
              class="w-full text-left px-3 py-1.5 rounded text-sm truncate transition-colors"
              :class="
selectedPlaylistId === playlist.id && activeView === 'playlists'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              "
              @click="handleOpenPlaylist(playlist.id)"
            >
              {{ playlist.name }}
            </button>
          </div>
        </div>

        <div class="mt-auto flex flex-col gap-2">
          <button
            v-if="!isSeeded"
            type="button"
            class="w-full py-2 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-full text-sm transition-colors"
            :disabled="isSeeding"
            @click="handleSeed()"
          >
            {{ isSeeding ? "Loading..." : "Load Demo Data" }}
          </button>
          <button
            v-else
            type="button"
            class="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full text-sm transition-colors"
            @click="handleClear()"
          >
            Clear Library
          </button>
        </div>
      </aside>

      <div
        class="flex flex-1 overflow-hidden"
        :style="{
          marginRight: `${debuggerReservedWidth}px`,
          marginBottom: `${debuggerReservedHeight}px`,
          transition: layoutTransition,
        }"
      >
        <main class="flex-1 overflow-y-auto bg-linear-to-b from-neutral-900 to-black">
          <HomeView
            v-if="activeView === 'home'"
            :artists="artists"
            :albums="albums"
            :songs="songs"
            @play-song="handlePlaySong"
            @select-artist="(artist) => { selectedArtist = artist; activeView = 'artists'; }"
          />
          <ArtistsGrid
            v-if="activeView === 'artists' && !selectedArtist"
            :artists="artists"
            @select="selectedArtist = $event"
          />
          <ArtistDetail
            v-if="activeView === 'artists' && selectedArtist"
            :artist="selectedArtist"
            :albums="artistAlbums"
            :songs="artistSongs"
            :current-song="currentSong"
            @back="selectedArtist = null"
            @play-song="handlePlaySong"
          />
          <AlbumsGrid
            v-if="activeView === 'albums'"
            :albums="albums"
            :get-artist-name="getArtistName"
          />
          <SongsView
            v-if="activeView === 'songs'"
            :songs="songs"
            :current-song="currentSong"
            :get-artist-name="getArtistName"
            :get-album-title="getAlbumTitle"
            @play-song="handlePlaySong"
          />
          <PlaylistsView
            v-if="activeView === 'playlists' && !selectedPlaylist"
            :playlists="playlists"
            :users="users"
            @select-playlist="handleOpenPlaylist"
            @create-playlist="createPlaylistOpen = true"
          />
          <PlaylistDetailView
            v-if="activeView === 'playlists' && selectedPlaylist"
            :playlist="selectedPlaylist"
            :songs="songs"
            :playlist-songs="playlistSongs"
            :current-song="currentSong"
            :get-artist-name="getArtistName"
            :get-album-title="getAlbumTitle"
            :get-user-name="getUserName"
            @back="selectedPlaylistId = null"
            @play-song="handlePlaySong"
            @add-song-to-playlist="handleAddSongToPlaylist"
            @remove-song-from-playlist="handleRemoveSongFromPlaylist"
          />
          <MediaAttributionFooter />
        </main>

        <FriendsSidebar
          :friend-activities="friendActivities"
          :is-collapsed="isFriendsCollapsed"
          @toggle="isFriendsCollapsed = !isFriendsCollapsed"
        />
      </div>
    </div>

    <div
      v-if="currentSong"
      class="h-20 bg-neutral-900 border-t border-neutral-800 px-4 flex items-center gap-4"
      :style="{
        marginRight: `${debuggerReservedWidth}px`,
        marginBottom: `${debuggerReservedHeight}px`,
        transition: layoutTransition,
      }"
    >
      <div class="w-14 h-14 bg-neutral-800 rounded overflow-hidden shrink-0">
        <AlbumCoverImage
          :src="getAlbum(currentSong.albumId)?.coverUrl"
          :alt="getAlbum(currentSong.albumId)?.title || currentSong.title"
          class="w-full h-full object-cover"
          fallback-class-name="bg-neutral-800 text-neutral-500 flex items-center justify-center text-lg"
          :draggable="false"
        />
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-medium truncate">{{ currentSong.title }}</p>
        <p class="text-neutral-400 text-sm truncate">{{ getArtistName(currentSong.artistId) }}</p>
      </div>
      <div class="flex items-center gap-4">
        <button type="button" class="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white">
          <SkipBackIcon />
        </button>
        <button type="button" class="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform">
          <PlayIcon />
        </button>
        <button type="button" class="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white">
          <SkipForwardIcon />
        </button>
      </div>
      <div class="w-48 flex items-center gap-2 text-neutral-400 text-xs">
        <span>0:00</span>
        <div class="flex-1 h-1 bg-neutral-700 rounded-full">
          <div class="w-0 h-full bg-green-500 rounded-full" />
        </div>
        <span>{{ formatDuration(currentSong.durationMs) }}</span>
      </div>
    </div>

    <CreatePlaylistDialog
      :open="createPlaylistOpen"
      :playlist-name="newPlaylistName"
      @update:open="createPlaylistOpen = $event"
      @update:playlist-name="newPlaylistName = $event"
      @create="handleCreatePlaylist()"
    />

    <button
      v-if="!showDebugger"
      type="button"
      class="fixed bottom-4 right-4 w-12 h-12 bg-orange-500 hover:bg-orange-400 text-black rounded-full shadow-xl flex items-center justify-center z-50 transition-transform hover:scale-110"
      title="Open Debugger (⌘D)"
      @click="showDebugger = true"
    >
      <TerminalIcon />
    </button>

    <div
      v-if="showDebugger"
      class="fixed bg-neutral-950 border-neutral-800 shadow-2xl z-50 flex flex-col"
      :class="debuggerDock === 'bottom' ? 'inset-x-0 bottom-0 border-t' : 'top-0 right-0 bottom-0 border-l'"
      :style="{
        height: debuggerDock === 'bottom' ? `${debuggerReservedHeight}px` : '100%',
        width: debuggerDock === 'right' ? `${debuggerReservedWidth}px` : '100%',
        transition: debuggerPanelTransition,
      }"
    >
      <div
        v-if="!isRightDockMinimized"
        class="absolute z-20 bg-transparent hover:bg-orange-500/30 transition-colors"
        :class="debuggerDock === 'bottom' ? 'top-0 left-0 right-0 h-2 cursor-ns-resize' : 'top-0 left-0 bottom-0 w-2 cursor-ew-resize'"
        @mousedown="handleResizeStart"
      />

      <div
        v-if="isRightDockMinimized"
        class="flex flex-col items-center gap-1 p-1 border-b border-neutral-800 bg-neutral-900 shrink-0"
      >
        <button type="button" class="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded transition-colors" title="Expand" @click="isMinimized = false">
          <ChevronUpIcon />
        </button>
        <button type="button" class="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded transition-colors" title="Dock to bottom" @click="handleDebuggerDockToggle()">
          <DockBottomIcon />
        </button>
        <button type="button" class="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded transition-colors" title="Close (Esc)" @click="showDebugger = false">
          <CloseIcon />
        </button>
      </div>
      <div v-else class="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900 shrink-0">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-orange-500"><TerminalIcon /></span>
            <span class="font-semibold text-sm">RxDB Debugger</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-neutral-500 border-l border-neutral-700 pl-3 ml-1">
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 bg-green-500 rounded-full" />
              {{ totalDocs }} docs
            </span>
            <span v-if="events.length > 0" class="flex items-center gap-1 text-yellow-500">
              <span class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              {{ events.length }} events
            </span>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
            :title="debuggerDock === 'bottom' ? 'Dock to right' : 'Dock to bottom'"
            @click="handleDebuggerDockToggle()"
          >
            <component :is="debuggerDock === 'bottom' ? DockRightIcon : DockBottomIcon" />
          </button>
          <button
            type="button"
            class="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
            :title="isMinimized ? 'Expand' : 'Minimize'"
            @click="isMinimized = !isMinimized"
          >
            <component :is="isMinimized ? ChevronUpIcon : ChevronDownIcon" />
          </button>
          <button type="button" class="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors" title="Close (Esc)" @click="showDebugger = false">
            <CloseIcon />
          </button>
        </div>
      </div>

      <div
        v-if="isMinimized && debuggerDock === 'bottom' && recentEvents.length > 0"
        class="absolute left-1/2 -translate-x-1/2 top-2 flex items-center gap-2 pointer-events-none"
      >
        <span
          v-for="(event, i) in recentEvents"
          :key="event.id"
          class="text-xs px-2 py-0.5 rounded"
          :class="{
            'bg-green-500/20 text-green-400': event.operation === 'INSERT',
            'bg-yellow-500/20 text-yellow-400': event.operation === 'UPDATE',
            'bg-red-500/20 text-red-400': event.operation !== 'INSERT' && event.operation !== 'UPDATE',
          }"
          :style="{ opacity: 1 - i * 0.2 }"
        >
          {{ event.operation }} {{ event.collection }}
        </span>
      </div>

      <div v-if="!isMinimized" ref="debuggerRef" class="flex-1 overflow-hidden" />
    </div>

    <div v-if="showDebugger" class="fixed bottom-2 left-2 text-xs text-neutral-600 z-40">
      ⌘D to toggle • Esc to close • Drag edge to resize
    </div>
  </div>
</template>
