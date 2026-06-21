import { ref, type Ref } from 'vue'
import { GWBasicInterpreter, type InterpreterOutput, type GraphicsCommand } from '../gwbasic'

// GW-BASIC CGA color palette
export const GWBASIC_COLORS = [
  '#000000', '#0000AA', '#00AA00', '#00AAAA',
  '#AA0000', '#AA00AA', '#AA5500', '#AAAAAA',
  '#555555', '#5555FF', '#55FF55', '#55FFFF',
  '#FF5555', '#FF55FF', '#FFFF55', '#FFFFFF',
]

export type TerminalColor = 'green' | 'amber' | 'white'
export type ActiveTab = 'output' | 'graphics'

export function getTermColor(c: TerminalColor): string {
  switch (c) {
    case 'green': return '#33FF33'
    case 'amber': return '#FFB000'
    case 'white': return '#CCCCCC'
  }
}

export interface OutputLine {
  text: string
  fgColorIdx: number | null  // null = default terminal color, -1 = error
  bgColorIdx: number | null  // null = default terminal color, -1 = error
}

export const EXAMPLE_PROGRAMS: Record<string, string> = {
  'Hello World': `10 PRINT "Hello, World!"
20 PRINT "Welcome to GW-BASIC!"
30 END`,
  'Countdown': `10 FOR I = 10 TO 1 STEP -1
20 PRINT I
30 NEXT I
40 PRINT "LIFTOFF!"`,
  'Fibonacci': `10 PRINT "Fibonacci Sequence"
20 A = 0
30 B = 1
40 FOR I = 1 TO 20
50 PRINT A; ", ";
60 C = A + B
70 A = B
80 B = C
90 NEXT I`,
  'Guess Number': `10 RANDOMIZE TIMER
20 N = INT(RND * 100) + 1
30 PRINT "I'm thinking of a number between 1 and 100"
40 G = 0
50 G = G + 1
60 INPUT "Your guess: "; GUESS
70 IF GUESS < N THEN PRINT "Too low!" : GOTO 50
80 IF GUESS > N THEN PRINT "Too high!" : GOTO 50
90 PRINT "You got it in "; G; " guesses!"`,
  'Star Pattern': `10 FOR I = 1 TO 10
20 PRINT SPC(10 - I); STRING$(I * 2 - 1, "*")
30 NEXT I
40 FOR I = 9 TO 1 STEP -1
50 PRINT SPC(10 - I); STRING$(I * 2 - 1, "*")
60 NEXT I`,
  'Bubble Sort': `10 DIM A(10)
20 PRINT "Original array:"
30 FOR I = 1 TO 10
40 A(I) = INT(RND * 100)
50 PRINT A(I); " ";
60 NEXT I
70 PRINT
80 FOR I = 1 TO 9
90 FOR J = 1 TO 10 - I
100 IF A(J) > A(J+1) THEN SWAP A(J), A(J+1)
110 NEXT J
120 NEXT I
130 PRINT "Sorted array:"
140 FOR I = 1 TO 10
150 PRINT A(I); " ";
160 NEXT I`,
  'Draw Circles': `10 SCREEN 1
20 FOR I = 1 TO 15
30 CIRCLE (160, 100), I * 8, I
40 NEXT I`,
  'Draw Boxes': `10 SCREEN 1
20 FOR I = 1 TO 10
30 LINE (I*20, I*12)-(320-I*20, 200-I*12), I, B
40 NEXT I`,
  'GOSUB Demo': `10 PRINT "Main program start"
20 GOSUB 100
30 PRINT "Back in main"
40 GOSUB 200
50 PRINT "Main program end"
60 END
100 PRINT "  Subroutine 1"
110 FOR I = 1 TO 5
120 PRINT "    Count:"; I
130 NEXT I
140 RETURN
200 PRINT "  Subroutine 2"
210 FOR I = 5 TO 1 STEP -1
220 PRINT "    Count:"; I
230 NEXT I
240 RETURN`,
  'READ/DATA': `10 PRINT "Reading data..."
20 READ N$
30 WHILE N$ <> "END"
40 READ A
50 PRINT N$; " is "; A; " years old"
60 READ N$
70 WEND
80 DATA "Alice", 25, "Bob", 30, "Carol", 28
90 DATA "Dave", 35, "END", 0`,
  'Color Demo': `10 FOR I = 0 TO 15
20 COLOR I, 15-I
30 PRINT "Color "; I; " - Hello World!"
40 NEXT I
50 COLOR 7`,
}

function initCanvasClear(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
}

function drawGraphicsOnCanvas(canvas: HTMLCanvasElement, cmd: GraphicsCommand) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height

  switch (cmd.type) {
    case 'pset': {
      const color = cmd.color !== undefined ? GWBASIC_COLORS[cmd.color % 16] : '#FFFFFF'
      ctx.fillStyle = color
      ctx.fillRect(cmd.x1!, cmd.y1!, 2, 2)
      break
    }
    case 'line': {
      const color = cmd.color !== undefined ? GWBASIC_COLORS[cmd.color % 16] : '#FFFFFF'
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = 2
      if (cmd.style === 'BF') {
        ctx.fillRect(
          Math.min(cmd.x1!, cmd.x2!),
          Math.min(cmd.y1!, cmd.y2!),
          Math.abs(cmd.x2! - cmd.x1!),
          Math.abs(cmd.y2! - cmd.y1!)
        )
      } else if (cmd.style === 'B') {
        ctx.strokeRect(
          Math.min(cmd.x1!, cmd.x2!),
          Math.min(cmd.y1!, cmd.y2!),
          Math.abs(cmd.x2! - cmd.x1!),
          Math.abs(cmd.y2! - cmd.y1!)
        )
      } else {
        ctx.beginPath()
        ctx.moveTo(cmd.x1!, cmd.y1!)
        ctx.lineTo(cmd.x2!, cmd.y2!)
        ctx.stroke()
      }
      break
    }
    case 'circle': {
      const color = cmd.color !== undefined ? GWBASIC_COLORS[cmd.color % 16] : '#FFFFFF'
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cmd.x1!, cmd.y1!, cmd.radius!, 0, 2 * Math.PI)
      ctx.stroke()
      break
    }
    case 'cls': {
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, w, h)
      break
    }
    case 'draw': {
      if (!cmd.commands) break
      ctx.strokeStyle = GWBASIC_COLORS[7]
      ctx.lineWidth = 2
      ctx.beginPath()
      let x = w / 2, y = h / 2
      ctx.moveTo(x, y)
      const drawCmd = cmd.commands.toUpperCase()
      let idx = 0
      while (idx < drawCmd.length) {
        const ch = drawCmd[idx]
        let num = ''
        idx++
        while (idx < drawCmd.length && drawCmd[idx] >= '0' && drawCmd[idx] <= '9') {
          num += drawCmd[idx]
          idx++
        }
        const dist = parseInt(num) || 10
        switch (ch) {
          case 'U': y -= dist; break
          case 'D': y += dist; break
          case 'L': x -= dist; break
          case 'R': x += dist; break
          case 'E': x += dist; y -= dist; break
          case 'F': x += dist; y += dist; break
          case 'G': x -= dist; y += dist; break
          case 'H': x -= dist; y -= dist; break
        }
        ctx.lineTo(x, y)
      }
      ctx.stroke()
      break
    }
    case 'paint': {
      const color = cmd.color !== undefined ? GWBASIC_COLORS[cmd.color % 16] : '#FFFFFF'
      ctx.fillStyle = color
      ctx.fillRect(cmd.x1! - 2, cmd.y1! - 2, 4, 4)
      break
    }
  }
}

export function useInterpreter() {
  const output: Ref<OutputLine[]> = ref([])
  const inputMode = ref(false)
  const inputPrompt = ref('')
  const currentInput = ref('')
  const isRunning = ref(false)
  const activeTab: Ref<ActiveTab> = ref('output')
  const screenMode = ref(0)
  const terminalColor: Ref<TerminalColor> = ref('green')

  const interpreterRef = ref<GWBasicInterpreter | null>(null)
  const inputResolveRef = ref<((value: string) => void) | null>(null)
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const termRef = ref<HTMLPreElement | null>(null)
  const pendingGraphics: Ref<GraphicsCommand[]> = ref([])
  const currentFgColor = ref<number | null>(null)
  const currentBgColor = ref<number | null>(null)
  const lastOutputEndedWithNewline = ref(true)

  // Add output with color support
  function addOutput(text: string, isError: boolean = false) {
    const fgColorIdx = isError ? -1 : currentFgColor.value
    const bgColorIdx = isError ? -1 : currentBgColor.value
    
    const lines = text.split('\n')
    
    if (lines.length > 1 && lines[lines.length - 1] === '') {
      lines.pop()
    }

    // If the first segment doesn't start with a newline, append it to the last existing line
    if (lines.length > 0 && lines[0] !== '' && output.value.length > 0 && !lastOutputEndedWithNewline.value) {
      const lastIdx = output.value.length - 1
      output.value[lastIdx].text += lines[0]
      lines.shift()
    }

    for (const line of lines) {
      output.value.push({ text: line, fgColorIdx, bgColorIdx })
    }

    // Limit output buffer
    if (output.value.length > 5000) {
      output.value = output.value.slice(-3000)
    }

    // Track whether this output ended with a newline
    lastOutputEndedWithNewline.value = text.endsWith('\n')
  }

  function processPendingGraphics() {
    if (!canvasRef.value) return
    const pending = pendingGraphics.value
    if (pending.length === 0) return
    initCanvasClear(canvasRef.value)
    for (const cmd of pending) {
      drawGraphicsOnCanvas(canvasRef.value, cmd)
    }
    pendingGraphics.value = []
  }

  function initInterpreter() {
    const outputCallback = (out: InterpreterOutput) => {
      switch (out.type) {
        case 'print':
          addOutput(out.value || '')
          break
        case 'input':
          inputMode.value = true
          inputPrompt.value = out.value || '? '
          currentInput.value = ''
          setTimeout(() => {
            const inputEl = document.querySelector('#basic-input') as HTMLInputElement
            inputEl?.focus()
          }, 50)
          break
        case 'error':
          addOutput(out.value || '', true)
          break
        case 'clear':
          output.value = []
          if (canvasRef.value) initCanvasClear(canvasRef.value)
          break
        case 'color':
          currentFgColor.value = out.fg ?? null
          currentBgColor.value = out.bg ?? null
          break
        case 'locate':
          break
        case 'screen':
          screenMode.value = out.mode || 0
          if (out.mode === 1) {
            activeTab.value = 'graphics'
            setTimeout(() => processPendingGraphics(), 150)
          } else {
            activeTab.value = 'output'
          }
          break
        case 'graphics':
          if (out.graphicsCommand) {
            if (canvasRef.value) {
              drawGraphicsOnCanvas(canvasRef.value, out.graphicsCommand)
            } else {
              pendingGraphics.value.push(out.graphicsCommand)
            }
          }
          break
        case 'beep':
          try {
            const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
            const osc = audioCtx.createOscillator()
            const gain = audioCtx.createGain()
            osc.connect(gain)
            gain.connect(audioCtx.destination)
            osc.frequency.value = 800
            gain.gain.value = 0.1
            osc.start()
            osc.stop(audioCtx.currentTime + 0.1)
          } catch { /* ignore */ }
          break
        case 'info':
          addOutput(out.value || '')
          break
      }
    }

    const inputCallback = async (): Promise<string> => {
      return new Promise<string>((resolve) => {
        inputResolveRef.value = resolve
      })
    }

    interpreterRef.value = new GWBasicInterpreter(outputCallback, inputCallback)
  }

  // Initialize on first call
  initInterpreter()

  async function runProgram(source: string) {
    if (isRunning.value) return
    isRunning.value = true
    output.value = []
    inputMode.value = false
    pendingGraphics.value = []
    currentFgColor.value = null
    lastOutputEndedWithNewline.value = true
    activeTab.value = screenMode.value === 1 ? 'graphics' : 'output'

    try {
      await interpreterRef.value?.run(source)
    } catch (e) {
      addOutput(`Error: ${(e as Error).message}\n`, true)
    }

    isRunning.value = false
    addOutput('\nOk\n')
  }

  function stopProgram() {
    interpreterRef.value?.stop()
    isRunning.value = false
    inputMode.value = false
    if (inputResolveRef.value) {
      inputResolveRef.value('')
      inputResolveRef.value = null
    }
    addOutput('\nBreak\n')
  }

  function clearOutput() {
    output.value = []
    inputMode.value = false
    currentFgColor.value = null
    lastOutputEndedWithNewline.value = true
    interpreterRef.value?.reset()
    if (canvasRef.value) initCanvasClear(canvasRef.value)
    pendingGraphics.value = []
  }

  function newProgram() {
    currentFgColor.value = null
    lastOutputEndedWithNewline.value = true
    screenMode.value = 0
    activeTab.value = 'output'
    interpreterRef.value?.reset()
    interpreterRef.value?.loadProgram('')
    pendingGraphics.value = []
  }

  async function executeDirect(cmd: string) {
    if (!cmd.trim()) return
    addOutput(`${cmd}\n`)

    try {
      await interpreterRef.value?.executeDirect(cmd)
    } catch (e) {
      addOutput(`Error: ${(e as Error).message}\n`, true)
    }

    if (!interpreterRef.value?.isRunning()) {
      addOutput('Ok\n')
    }
  }

  function submitInput() {
    if (inputResolveRef.value) {
      addOutput(`${inputPrompt.value}${currentInput.value}\n`)
      inputResolveRef.value(currentInput.value)
      inputResolveRef.value = null
      inputMode.value = false
      currentInput.value = ''
    }
  }

  function getForegroundColor(line: OutputLine): string {
    if (line.fgColorIdx === -1) return '#FF5555'
    if (line.fgColorIdx !== null && line.fgColorIdx >= 0 && line.fgColorIdx <= 15) {
      return GWBASIC_COLORS[line.fgColorIdx]
    }
    return getTermColor(terminalColor.value)
  }

  function getBackgroundColor(line: OutputLine): string {
    if (line.bgColorIdx === -1) return 'transparent'
    if (line.bgColorIdx !== null && line.bgColorIdx >= 0 && line.bgColorIdx <= 15) {
      return GWBASIC_COLORS[line.bgColorIdx]
    }
    return 'transparent'
  }

  function scrollToBottom() {
    if (termRef.value) {
      termRef.value.scrollTop = termRef.value.scrollHeight
    }
  }

  return {
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
    getForegroundColor,
    getBackgroundColor,
    scrollToBottom,
    processPendingGraphics,
  }
}
