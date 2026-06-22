<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  title: string
  width?: number
  height?: number
  x?: number
  y?: number
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  updatePosition: [x: number, y: number]
}>()

const windowRef = ref<HTMLDivElement | null>(null)
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

const pos = ref({ x: props.x ?? 100, y: props.y ?? 100 })
const w = ref(props.width ?? 320)
const h = ref(props.height ?? 260)

function startDrag(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.float-titlebar')) {
    isDragging.value = true
    dragOffset.value = { x: e.clientX - pos.value.x, y: e.clientY - pos.value.y }
    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
    e.preventDefault()
  }
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return
  pos.value = {
    x: Math.max(0, e.clientX - dragOffset.value.x),
    y: Math.max(0, e.clientY - dragOffset.value.y),
  }
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  emit('updatePosition', pos.value.x, pos.value.y)
}

// Resize from bottom-right corner
const isResizing = ref(false)
const resizeStart = ref({ x: 0, y: 0, w: 0, h: 0 })

function startResize(e: MouseEvent) {
  isResizing.value = true
  resizeStart.value = { x: e.clientX, y: e.clientY, w: w.value, h: h.value }
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

function onResize(e: MouseEvent) {
  if (!isResizing.value) return
  w.value = Math.max(180, resizeStart.value.w + (e.clientX - resizeStart.value.x))
  h.value = Math.max(100, resizeStart.value.h + (e.clientY - resizeStart.value.y))
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" ref="windowRef" class="floating-window"
      :style="{ left: pos.x + 'px', top: pos.y + 'px', width: w + 'px', height: h + 'px' }"
      @mousedown="startDrag">
      <!-- Title bar -->
      <div class="float-titlebar flex items-center justify-between px-2 py-1 cursor-move select-none"
        style="background-color: #16213e; border-bottom: 1px solid #333355;">
        <span class="text-xs font-mono font-bold text-gray-300 truncate">{{ title }}</span>
        <button @click.stop="emit('close')"
          class="text-gray-500 hover:text-red-400 text-sm leading-none px-1">&times;</button>
      </div>
      <!-- Content -->
      <div class="float-content overflow-y-auto" style="background-color: #0a0a1a;">
        <slot />
      </div>
      <!-- Resize handle -->
      <div class="float-resize" @mousedown.stop="startResize"></div>
    </div>
  </Teleport>
</template>

<style scoped>
.floating-window {
  position: fixed;
  z-index: 9999;
  border: 1px solid #333355;
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Courier New', monospace;
}

.float-titlebar {
  flex-shrink: 0;
}

.float-content {
  flex: 1;
  padding: 4px;
}

.float-resize {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  cursor: se-resize;
  background: linear-gradient(135deg, transparent 50%, #555577 50%);
}
</style>