<script setup lang="ts">
import { ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    src?: string;
    alt: string;
    class?: string;
    draggable?: boolean;
  }>(),
  {
    draggable: false,
  },
);

const hasError = ref(!props.src);

watch(
  () => props.src,
  (src) => {
    hasError.value = !src;
  },
);
</script>

<template>
  <img
    v-if="src && !hasError"
    :src="src"
    :alt="alt"
    :class="$props.class"
    :draggable="draggable"
    loading="lazy"
    @error="hasError = true"
  />
  <slot v-else />
</template>
