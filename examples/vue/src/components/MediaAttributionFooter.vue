<script setup lang="ts">
import { MEDIA_ATTRIBUTION_LINKS } from "../media";
</script>

<template>
  <footer class="px-8 pb-10 pt-6 text-[11px] leading-5 text-neutral-500">
    Artist photos via
    <a
      class="text-neutral-300 hover:text-white transition-colors"
      :href="MEDIA_ATTRIBUTION_LINKS.artistPhotos"
      target="_blank"
      rel="noreferrer"
    >Wikimedia Commons</a>.
    Album artwork via
    <a
      class="text-neutral-300 hover:text-white transition-colors"
      :href="MEDIA_ATTRIBUTION_LINKS.albumCovers"
      target="_blank"
      rel="noreferrer"
    >Cover Art Archive</a>
    and
    <a
      class="text-neutral-300 hover:text-white transition-colors"
      :href="MEDIA_ATTRIBUTION_LINKS.musicbrainz"
      target="_blank"
      rel="noreferrer"
    >MusicBrainz</a>.
    Rights remain with the original copyright holders and licensors.
  </footer>
</template>
