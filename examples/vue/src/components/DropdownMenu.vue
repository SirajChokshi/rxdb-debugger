<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

const props = withDefaults(
  defineProps<{
    align?: "start" | "end";
    minWidthClass?: string;
  }>(),
  {
    align: "start",
    minWidthClass: "min-w-52",
  },
);

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Node) || !rootRef.value?.contains(target)) {
    close();
  }
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick);
});

defineExpose({ close });
</script>

<template>
  <div ref="rootRef" class="relative inline-block">
    <div @click.stop="toggle">
      <slot name="trigger" :open="open" />
    </div>
    <div
      v-if="open"
      class="absolute z-[75] mt-2 rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-2xl max-h-80 overflow-y-auto"
      :class="[
        minWidthClass,
        align === 'end' ? 'right-0' : 'left-0',
      ]"
      @click.stop
    >
      <slot :close="close" />
    </div>
  </div>
</template>
