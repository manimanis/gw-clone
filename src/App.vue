<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useInterpreter, EXAMPLE_PROGRAMS, getTermColor, type TerminalColor, type ActiveTab } from './composables/useInterpreter'

const {
  output,
  inputMode,
  inputPrompt,
  currentInput,
  isRunning,
  activeTab,
  screenMode,
  terminalColor,
  canvasRef,
  termRef,
  runProgram,
  stopProgram,
  clearOutput,
  newProgram,
  executeDirect,
  submitInput,
  getLineColor,
  scrollToBottom,
} = useInterpreter()

const source = ref(EXAMPLE_PROGRAMS['Hello World'])
const selectedExample = ref('Hello World')
const directCmd = ref('')

const inputEl = ref<HTMLInputElement | null>(null)

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
    executeDirect(directCmd.value)
    directCmd.value = ''
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
</script>

<template>
  <div class="min-h-screen flex flex-col" style="background-color: #1a1a2e">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-2 border-b border-[#333355]" style="background-color: #16213e">
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
          <button
            v-for="c in (['green', 'amber', 'white'] as const)"
            :key="c"
            @click="setTermColor(c)"
            class="w-4 h-4 rounded-sm border border-gray-600"
            :class="{ 'ring-1 ring-white': terminalColor === c }"
            :style="{ backgroundColor: c === 'green' ? '#33FF33' : c === 'amber' ? '#FFB000' : '#CCCCCC' }"
            :title="c"
          />
        </div>
        <select
          class="bg-[#0a0a1a] text-gray-300 text-xs font-mono px-2 py-1 border border-[#333355] rounded"
          :value="selectedExample"
          @change="handleExampleSelect(($event.target as HTMLSelectElement).value)"
        >
          <option value="">-- Examples --</option>
          <option v-for="(_, name) in EXAMPLE_PROGRAMS" :key="name" :value="name">{{ name }}</option>
        </select>
      </div>
    </header>

    <!-- Main content -->
    <div class="flex-1 flex flex-col lg:flex-row gap-0">
      <!-- Editor panel -->
      <div class="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-[#333355]" style="min-height: 200px">
        <!-- Toolbar -->
        <div class="flex items-center gap-2 px-3 py-2 border-b border-[#333355] flex-wrap" style="background-color: #0f0f2a">
          <button
            @click="handleRun"
            :disabled="isRunning"
            class="px-3 py-1.5 text-xs font-mono font-bold rounded transition-all hover:scale-105 disabled:opacity-50"
            style="background-color: #1a5c1a; color: #33FF33; border: 1px solid #33FF33"
          >
            ▶ RUN
          </button>
          <button
            @click="handleStop"
            :disabled="!isRunning"
            class="px-3 py-1.5 text-xs font-mono font-bold rounded transition-all hover:scale-105 disabled:opacity-50"
            style="background-color: #5c1a1a; color: #FF5555; border: 1px solid #FF5555"
          >
            ■ STOP
          </button>
          <button
            @click="handleClear"
            class="px-3 py-1.5 text-xs font-mono font-bold rounded transition-all hover:scale-105"
            style="background-color: #1a1a5c; color: #5555FF; border: 1px solid #5555FF"
          >
            CLR
          </button>
          <button
            @click="handleNew"
            class="px-3 py-1.5 text-xs font-mono font-bold rounded transition-all hover:scale-105"
            style="background-color: #5c5c1a; color: #FFFF55; border: 1px solid #FFFF55"
          >
            NEW
          </button>
          <span v-if="isRunning" class="text-xs font-mono text-[#33FF33] animate-pulse ml-2">
            ● RUNNING
          </span>
        </div>

        <!-- Code Editor -->
        <div class="flex-1 relative" style="background-color: #0a0a1a">
          <div class="absolute top-0 left-0 right-0 bottom-0 flex">
            <!-- Line numbers -->
            <div
              class="w-10 flex-shrink-0 py-2 px-1 text-right font-mono text-[10px] leading-[20px] select-none overflow-hidden"
              style="color: #555577; background-color: #080818"
            >
              <div v-for="(_, i) in source.split('\n')" :key="i">{{ i + 1 }}</div>
            </div>
            <!-- Textarea -->
            <textarea
              v-model="source"
              class="flex-1 bg-transparent font-mono text-sm leading-[20px] p-2 resize-none outline-none"
              :style="{ color: termColor(), caretColor: termColor(), tabSize: 4 }"
              spellcheck="false"
              placeholder="Enter your GW-BASIC program here..."
              :disabled="isRunning"
            />
          </div>
        </div>
      </div>

      <!-- Output panel -->
      <div class="flex-1 flex flex-col" style="min-height: 200px">
        <!-- Output tabs -->
        <div class="flex items-center gap-1 px-3 py-1 border-b border-[#333355]" style="background-color: #0f0f2a">
          <button
            v-for="tab in (['output', 'graphics'] as const)"
            :key="tab"
            @click="activeTab = tab"
            class="px-3 py-1 text-xs font-mono rounded-t transition-all"
            :class="activeTab === tab ? 'border-b-2' : 'text-gray-500 hover:text-gray-300'"
            :style="activeTab === tab ? { color: termColor(), borderColor: termColor() } : {}"
          >
            {{ tab === 'output' ? 'TERMINAL' : 'GRAPHICS' }}
          </button>
          <span class="ml-auto text-[10px] font-mono text-gray-600">
            {{ output.length }} lines
          </span>
        </div>

        <!-- Terminal output (always in DOM) -->
        <div
          class="flex-1 relative overflow-hidden"
          :style="{ backgroundColor: '#0A0A0A', display: activeTab === 'output' ? 'block' : 'none' }"
        >
          <!-- CRT scanline effect -->
          <div
            class="absolute inset-0 pointer-events-none z-10"
            :style="{
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
            }"
          />
          <!-- CRT vignette -->
          <div
            class="absolute inset-0 pointer-events-none z-10"
            :style="{
              background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)',
            }"
          />

          <pre
            ref="termRef"
            class="absolute inset-0 p-3 font-mono text-sm overflow-y-auto overflow-x-hidden"
            :style="{ color: termColor() }"
          >
            <span
              v-for="(line, i) in output"
              :key="i"
              :style="{ color: getLineColor(line) }"
            >{{ line.text }}{{ '\n' }}</span>
            <span v-if="inputMode" class="flex items-center">
              <span>{{ inputPrompt }}</span>
              <input
                id="basic-input"
                ref="inputEl"
                v-model="currentInput"
                type="text"
                class="bg-transparent outline-none font-mono text-sm flex-1 min-w-0"
                :style="{ color: termColor(), caretColor: termColor() }"
                @keydown="handleInputKey"
                autofocus
              />
            </span>
          </pre>
        </div>

        <!-- Graphics canvas (always in DOM) -->
        <div
          class="flex-1 flex items-center justify-center"
          :style="{ backgroundColor: '#000000', display: activeTab === 'graphics' ? 'flex' : 'none' }"
        >
          <canvas
            ref="canvasRef"
            width="320"
            height="200"
            class="border border-[#333355]"
            style="image-rendering: pixelated; max-width: 100%; max-height: 100%"
          />
        </div>
      </div>
    </div>

    <!-- Direct command bar -->
    <div class="flex items-center gap-2 px-4 py-2 border-t border-[#333355]" style="background-color: #0f0f2a">
      <span class="text-xs font-mono text-gray-500">CMD&gt;</span>
      <input
        v-model="directCmd"
        type="text"
        class="flex-1 bg-[#0a0a1a] text-sm font-mono px-3 py-1.5 border border-[#333355] rounded outline-none focus:border-[#33FF33] min-w-0"
        :style="{ color: termColor() }"
        placeholder="Enter direct command (RUN, LIST, NEW, CLS, or BASIC statements)..."
        :disabled="isRunning || inputMode"
        @keydown="handleDirectCmd"
      />
    </div>

    <!-- Status bar -->
    <div class="flex items-center justify-between px-4 py-1 border-t border-[#333355] text-[10px] font-mono text-gray-600" style="background-color: #0a0a1a">
      <div class="flex items-center gap-4">
        <span>LINES: {{ source.split('\n').filter(l => l.trim()).length }}</span>
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
