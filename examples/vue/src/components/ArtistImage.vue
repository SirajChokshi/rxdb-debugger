<script setup lang="ts">
import type { Artist } from "../types";
import MediaImage from "./MediaImage.vue";

defineProps<{
  artist: Artist;
  class?: string;
  fallbackClassName: string;
}>();
</script>

<template>
  <MediaImage :src="artist.imageUrl" :alt="artist.name" :class="$props.class">
    <div :class="`${$props.class} ${fallbackClassName}`">
      {{ artist.name.charAt(0) }}
    </div>
  </MediaImage>
</template>
