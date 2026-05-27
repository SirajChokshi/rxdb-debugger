<script setup lang="ts">
import MediaImage from "./MediaImage.vue";

withDefaults(
  defineProps<{
    src?: string;
    alt: string;
    class?: string;
    fallbackClassName: string;
    draggable?: boolean;
  }>(),
  {
    draggable: false,
  },
);
</script>

<template>
  <MediaImage
    :src="src"
    :alt="alt"
    :class="$props.class"
    :draggable="draggable"
  >
    <div :class="`${$props.class} ${fallbackClassName}`">♪</div>
  </MediaImage>
</template>
