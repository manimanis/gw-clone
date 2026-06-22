<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import {
  useInterpreter, EXAMPLE_PROGRAMS, getTermColor,
  saveSourceToLocalStorage, loadSourceFromLocalStorage,
  saveSplitterPosition, loadSplitterPosition,
  type TerminalColor
} from './composables/useInterpreter'

const {
  output,
  inputMode,
  inputPrompt,
  currentInput,
  isRunning,
  activeTab,
  screenMode,
  terminalColor,
  // @ts-ignore used in template
  canvasRef,
  // @ts-ignore used in template
  termRef,
  runProgram,
  stopProgram,
  clearOutput,
  newProgram,
  executeDirect,
  submitInput,
  getForegroundColor,
  getBackgroundColor,
  scrollToBottom,
  showVariables,
  variablesSnapshot,
  refreshVariables,
} = useInterpreter()

const source = ref(loadSourceFromLocalStorage() || EXAMPLE_PROGRAMS['Hello World'])
const selectedExample = ref('Hello World')
const directCmd = ref('')
const cmdHistory = ref<string[]>([])
const cmdHistoryIndex = ref(-1)

const inputEl = ref<HTMLInputElement | null>(null)

// Splitter
const splitterPos = ref(loadSplitterPosition())
const isDragging = ref(false)

// File input ref for import
const fileInputRef = ref<HTMLInputElement | null>(null)

let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(source, (val) => {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    saveSourceToLocalStorage(val)
  }, 500)
})

// Auto-scroll terminal on output change
watch(output, () => {
  nextTick(() => scrollToBottom())
}, { deep: true })

// Focus input when input mode activates
watch(inputMode, (val) => {
  if (val) {
    nextTick(() => inputEl.value?.focus())
  }
})

onMounted(() => {
  // Si on a chargé depuis localStorage, mettre à jour le selectedExample
  if (source.value) {
    for (const [name, code] of Object.entries(EXAMPLE_PROGRAMS)) {
      if (code === source.value) {
        selectedExample.value = name
        break
      }
    }
  }
})

function handleRun() {
  runProgram(source.value)
}

function handleStop() {
  stopProgram()
}

function handleClear() {
  clearOutput()
}

function handleNew() {
  source.value = ''
  newProgram()
}

function handleExampleSelect(name: string) {
  selectedExample.value = name
  source.value = EXAMPLE_PROGRAMS[name] || ''
  clearOutput()
}

function handleDirectCmd(e: KeyboardEvent) {
  if (e.key === 'Enter' && directCmd.value.trim()) {
    const cmd = directCmd.value.trim()
    cmdHistory.value.push(cmd)
    cmdHistoryIndex.value = -1
    executeDirect(cmd)
    directCmd.value = ''
  } else if (e.key === 'ArrowUp') {
    if (cmdHistory.value.length > 0) {
      if (cmdHistoryIndex.value === -1) {
        cmdHistoryIndex.value = cmdHistory.value.length - 1
      } else if (cmdHistoryIndex.value > 0) {
        cmdHistoryIndex.value--
      }
      directCmd.value = cmdHistory.value[cmdHistoryIndex.value]
    }
    e.preventDefault()
  } else if (e.key === 'ArrowDown') {
    if (cmdHistoryIndex.value >= 0) {
      cmdHistoryIndex.value++
      if (cmdHistoryIndex.value >= cmdHistory.value.length) {
        cmdHistoryIndex.value = -1
        directCmd.value = ''
      } else {
        directCmd.value = cmdHistory.value[cmdHistoryIndex.value]
      }
    }
    e.preventDefault()
  }
}

function handleInputKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    submitInput()
  }
}

function setTermColor(c: TerminalColor) {
  terminalColor.value = c
}

const termColor = () => getTermColor(terminalColor.value)

// Export .BAS
function exportProgram() {
  if (!source.value.trim()) return
  const blob = new Blob([source.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'program.bas'
  a.click()
  URL.revokeObjectURL(url)
}

// Import .BAS
function importProgram(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  const file = input.files[0]
  const reader = new FileReader()
  reader.onload = (ev) => {
    const content = ev.target?.result as string
    if (content) {
      source.value = content
      clearOutput()
    }
  }
  reader.readAsText(file)
  input.value = '' // reset
}

function triggerImport() {
  fileInputRef.value?.click()
}

// Splitter drag handlers
function startDrag(e: MouseEvent) {
  isDragging.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return
  const container = document.getElementById('split-container')
  if (!container) return
  const rect = container.getBoundingClientRect()
  let pct = ((e.clientX - rect.left) / rect.width) * 100
  pct = Math.max(20, Math.min(80, pct))
  splitterPos.value = pct
  saveSplitterPosition(pct)
}

function stopDrag() {
  isDragging.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}
</script>

<template>
  <div class="min-h-screen flex flex-col" style="background-color: #1a1a2e">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-2 border-b border-[#333355]"
      style="background-color: #16213e">
      <div class="flex items-center gap-3">
        <div class="flex gap-1.5">
          <div class="w-3 h-3 rounded-full bg-red-500"></div>
          <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div class="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <h1 class="text-sm font-mono font-bold tracking-wider" :style="{ color: termColor() }">
          GW-BASIC INTERPRETER
        </h1>
        <span class="text-[10px] font-mono text-gray-500 ml-2">v1.0 — Vue.js 3</span>
      </div>
      <div class="flex items-center gap-2">
        <!-- CRT color selector -->
        <div class="flex items-center gap-1 mr-2">
          <span class="text-[10px] font-mono text-gray-500 hidden sm:inline">CRT:</span>
          <button v-for="c in (['green', 'amber', 'white'] as const)" :key="c" @click="setTermColor(c)"
            class="w-4 h-4 rounded-sm border border-gray-600" :class="{ 'ring-1 ring-white': terminalColor === c }"
            :style="{ backgroundColor: c === 'green' ? '#33FF33' : c === 'amber' ? '#FFB000' : '#CCCCCC' }"
            :title="c" />
        </div>
        <select class="bg-[#0a0a1a] text-gray-300 text-xs font-mono px-2 py-1 border border-[#333355] rounded"
          :value="selectedExample" @change="handleExampleSelect(($event.target as HTMLSelectElement).value)">
          <option value="">-- Examples --</option>
          <option v-for="(_, name) in EXAMPLE_PROGRAMS" :key="name" :value="name">{{ name }}</option>
        </select>
      </div>
    </header>

    <!-- Main content with splitter -->
    <div id="split-container" class="flex-1 flex flex-row" style="overflow: hidden;">
      <!-- Editor panel -->
      <div class="flex flex-col border-r border-[#333355]" :style="{ width: splitterPos + '%', minWidth: '200px' }">
        <!-- Toolbar -->
        <div class="flex items-center gap-2 px-3 py-2 border-b border-[#333355] flex-wrap"
          style="background-color: #0f0f2a">
          <button @click="handleRun" :disabled="isRunning"
            class="px-3 py-1.5 text-xs font-mono font-bold rounded transition-all hover:scale-105 disabled:opacity-50"
            style="background-color: #1a5c1a; color: #33FF33; border: 1px solid #33FF33">
            ▶ RUN
          </button>
          <button @click="handleStop" :disabled="!isRunning"
            class="px-3 py-1.5 text-xs font-mono font-bold rounded transition-all hover:scale-105 disabled:opacity-50"
            style="background-color: #5c1a1a; color: #FF5555; border: 1px solid #FF5555">
            ■ STOP
          </button>
          <button @click="handleClear"
            class="px-3 py-1.5 text-xs font-mono font-bold rounded transition-all hover:scale-105"
            style="background-color: #1a1a5c; color: #5555FF; border: 1px solid #5555FF">
            CLR
          </button>
          <button @click="handleNew"
            class="px-3 py-1.5 text-xs font-mono font-bold rounded transition-all hover:scale-105"
            style="background-color: #5c5c1a; color: #FFFF55; border: 1px solid #FFFF55">
            NEW
          </button>
          <!-- Export / Import buttons -->
          <button @click="exportProgram"
            class="px-3 py-1.5 text-xs font-mono font-bold rounded transition-all hover:scale-105"
            style="background-color: #1a5c5c; color: #55FFFF; border: 1px solid #55FFFF">
            ⬇ EXP
          </button>
          <button @click="triggerImport"
            class="px-3 py-1.5 text-xs font-mono font-bold rounded transition-all hover:scale-105"
            style="background-color: #5c1a5c; color: #FF55FF; border: 1px solid #FF55FF">
            ⬆ IMP
          </button>
          <!-- Variables inspector toggle -->
          <button @click="showVariables = !showVariables"
            class="px-3 py-1.5 text-xs font-mono font-bold rounded transition-all hover:scale-105"
            :style="showVariables ? { backgroundColor: '#5c5c1a', color: '#FFFF55', border: '1px solid #FFFF55' } : { backgroundColor: '#1a1a5c', color: '#5555FF', border: '1px solid #5555FF' }">
            {{ showVariables ? '▼ VARS' : '▶ VARS' }}
          </button>
          <span v-if="isRunning" class="text-xs font-mono text-[#33FF33] animate-pulse ml-2">
            ● RUNNING
          </span>
        </div>

        <!-- Variables inspector panel -->
        <div v-if="showVariables" class="border-b border-[#333355] overflow-y-auto"
          style="background-color: #080818; max-height: 200px">
          <div class="px-3 py-2 text-xs font-mono text-gray-400 border-b border-[#222244]">
            Variables Inspector
            <button @click="refreshVariables" class="ml-2 text-[#55FF55] hover:underline">↻</button>
            <span class="text-gray-600 ml-2">{{ variablesSnapshot.length }} vars</span>
          </div>
          <div v-if="variablesSnapshot.length === 0" class="px-3 py-2 text-[10px] font-mono text-gray-600 italic">
            No variables (run a program first)
          </div>
          <div v-for="v in variablesSnapshot" :key="v.name"
            class="px-3 py-1 flex items-center gap-2 hover:bg-[#0a0a2a] border-b border-[#111133]">
            <span class="text-[10px] font-mono text-[#55FF55] font-bold">{{ v.name }}</span>
            <span class="text-[10px] font-mono text-gray-300 truncate flex-1">{{ v.value }}</span>
          </div>
        </div>

        <!-- Code Editor -->
        <div class="flex-1 relative" style="background-color: #0a0a1a">
          <div class="absolute top-0 left-0 right-0 bottom-0 flex">
            <!-- Line numbers -->
            <div
              class="w-10 flex-shrink-0 py-2 px-1 text-right font-mono text-[10px] leading-[20px] select-none overflow-hidden"
              style="color: #555577; background-color: #080818">
              <div v-for="(_, i) in source.split('\n')" :key="i">{{ i + 1 }}</div>
            </div>
            <!-- Textarea -->
            <textarea v-model="source"
              class="flex-1 bg-transparent font-mono text-sm leading-[20px] p-2 resize-none outline-none"
              :style="{ color: termColor(), caretColor: termColor(), tabSize: 4 }" spellcheck="false"
              placeholder="Enter your GW-BASIC program here..." :disabled="isRunning" />
          </div>
        </div>
      </div>

      <!-- Splitter handle -->
      <div
        class="w-1.5 bg-[#222244] cursor-col-resize hover:bg-[#33FF33] transition-colors flex-shrink-0 relative"
        @mousedown="startDrag">
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-0.5 h-6 bg-[#555577] rounded"></div>
        </div>
      </div>

      <!-- Output panel -->
      <div class="flex flex-col" :style="{ flex: '1', minWidth: '200px' }">
        <!-- Output tabs -->
        <div class="flex items-center gap-1 px-3 py-1 border-b border-[#333355]" style="background-color: #0f0f2a">
          <button v-for="tab in (['output', 'graphics'] as const)" :key="tab" @click="activeTab = tab"
            class="px-3 py-1 text-xs font-mono rounded-t transition-all"
            :class="activeTab === tab ? 'border-b-2' : 'text-gray-500 hover:text-gray-300'"
            :style="activeTab === tab ? { color: termColor(), borderColor: termColor() } : {}">
            {{ tab === 'output' ? 'TERMINAL' : 'GRAPHICS' }}
          </button>
          <span class="ml-auto text-[10px] font-mono text-gray-600">
            {{ output.length }} lines
          </span>
        </div>

        <!-- Terminal output (always in DOM) -->
        <div class="flex-1 relative overflow-hidden"
          :style="{ backgroundColor: '#0A0A0A', display: activeTab === 'output' ? 'block' : 'none' }">
          <!-- CRT scanline effect -->
          <div class="absolute inset-0 pointer-events-none z-10" :style="{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
          }" />
          <!-- CRT vignette -->
          <div class="absolute inset-0 pointer-events-none z-10" :style="{
            background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)',
          }" />
          <pre ref="termRef" class="absolute inset-0 p-3 font-mono text-sm overflow-y-auto overflow-x-hidden"
            :style="{ color: termColor() }"><span
              v-for="(line, i) in output"
              :key="i"
              :style="{ color: getForegroundColor(line), backgroundColor: getBackgroundColor(line) }">{{ line.text + '\n' }}</span><span v-if="inputMode" class="flex items-center"><span>{{ inputPrompt }}</span><input
                id="basic-input"
                ref="inputEl"
                v-model="currentInput"
                type="text"
                class="bg-transparent outline-none font-mono text-sm flex-1 min-w-0"
                :style="{ color: termColor(), caretColor: termColor() }"
                @keydown="handleInputKey"
                autofocus
              /></span></pre>
        </div>

        <!-- Graphics canvas (always in DOM) -->
        <div class="flex-1 flex items-center justify-center"
          :style="{ backgroundColor: '#000000', display: activeTab === 'graphics' ? 'flex' : 'none' }">
          <canvas ref="canvasRef" width="320" height="200" class="border border-[#333355]"
            style="image-rendering: pixelated; width: 100%; max-width: 100%; max-height: 100%" />
        </div>
      </div>
    </div>

    <!-- Hidden file input for import -->
    <input ref="fileInputRef" type="file" accept=".bas,.txt" class="hidden" @change="importProgram" />

    <!-- Direct command bar -->
    <div class="flex items-center gap-2 px-4 py-2 border-t border-[#333355]" style="background-color: #0f0f2a">
      <span class="text-xs font-mono text-gray-500">CMD></span>
      <input v-model="directCmd" type="text"
        class="flex-1 bg-[#0a0a1a] text-sm font-mono px-3 py-1.5 border border-[#333355] rounded outline-none focus:border-[#33FF33] min-w-0"
        :style="{ color: termColor() }" placeholder="Enter direct command (RUN, LIST, NEW, CLS, or BASIC statements)..."
        :disabled="isRunning || inputMode" @keydown="handleDirectCmd" />
      <span v-if="cmdHistory.length > 0" class="text-[10px] font-mono text-gray-600 hidden sm:inline">
        {{ cmdHistory.length }} cmds
      </span>
    </div>

    <!-- Status bar -->
    <div
      class="flex items-center justify-between px-4 py-1 border-t border-[#333355] text-[10px] font-mono text-gray-600"
      style="background-color: #0a0a1a">
      <div class="flex items-center gap-4">
        <span>LINES: {{source.split('\n').filter(l => l.trim()).length}}</span>
        <span>MODE: {{ screenMode === 0 ? 'TEXT' : 'GRAPHICS' }}</span>
        <span>CRT: {{ terminalColor.toUpperCase() }}</span>
        <span>Vue.js 3 + Vite</span>
      </div>
      <div class="flex items-center gap-4">
        <span>GW-BASIC Clone by Z.ai</span>
      </div>
    </div>
  </div>
</template>