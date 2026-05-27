<script setup lang="ts">
defineProps<{
  active: boolean;
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <button
    type="button"
    class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors"
    :class="active ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'"
    @click="emit('click')"
  >
    <slot />
  </button>
</template>
