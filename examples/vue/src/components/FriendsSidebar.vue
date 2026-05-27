<script setup lang="ts">
import type { FriendActivity } from "../types";
import { formatPresenceRelativeTime } from "../utils/format";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

defineProps<{
  friendActivities: FriendActivity[];
  isCollapsed: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <aside
    class="border-l border-neutral-900 bg-neutral-950/90 backdrop-blur-sm transition-[width] duration-200 ease-out shrink-0"
    :class="isCollapsed ? 'w-11' : 'w-72'"
  >
    <div class="flex items-center justify-between border-b border-neutral-900 px-3 py-3">
      <button
        type="button"
        class="w-6 h-6 rounded-full bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors flex items-center justify-center shrink-0"
        :title="isCollapsed ? 'Expand friends activity' : 'Collapse friends activity'"
        @click="emit('toggle')"
      >
        <component :is="isCollapsed ? ChevronLeftIcon : ChevronRightIcon" />
      </button>
      <div
        v-if="!isCollapsed"
        class="text-xs uppercase tracking-wider text-neutral-400 font-semibold"
      >
        Friends Activity
      </div>
    </div>

    <div v-if="isCollapsed" class="flex flex-col items-center gap-2 pt-3">
      <div
        v-for="friend in friendActivities.slice(0, 6)"
        :key="friend.id"
        class="w-7 h-7 rounded-full text-[11px] font-semibold text-white flex items-center justify-center"
        :style="{ backgroundColor: friend.avatarColor }"
        :title="`${friend.friendName}: ${friend.currentSongTitle}`"
      >
        {{ friend.friendName.charAt(0) }}
      </div>
    </div>
    <div v-else class="overflow-y-auto h-[calc(100%-53px)] p-3">
      <div
        v-if="friendActivities.length === 0"
        class="rounded-lg border border-dashed border-neutral-700 p-4 text-xs text-neutral-400"
      >
        Friend graph data is syncing…
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="friend in friendActivities"
          :key="friend.id"
          class="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3"
        >
          <div class="flex items-center gap-2 mb-2">
            <div
              class="w-7 h-7 rounded-full text-[11px] font-semibold text-white flex items-center justify-center"
              :style="{ backgroundColor: friend.avatarColor }"
            >
              {{ friend.friendName.charAt(0) }}
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold text-white truncate">{{ friend.friendName }}</div>
              <div class="text-[11px] text-green-400">
                {{ friend.currentSongId ? "Listening now" : "Recently active" }}
              </div>
            </div>
          </div>
          <div class="text-xs text-white truncate">♪ {{ friend.currentSongTitle }}</div>
          <div class="text-[11px] text-neutral-400 truncate">{{ friend.currentArtistName }}</div>
          <div class="text-[10px] text-neutral-500 mt-1">
            Updated {{ formatPresenceRelativeTime(friend.updatedAt) }}
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
