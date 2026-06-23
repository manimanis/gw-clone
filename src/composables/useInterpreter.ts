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

const STORAGE_KEYS = {
  SOURCE: 'gwbasic_source',
  SPLITTER: 'gwbasic_splitter_pos',
}

export function saveSourceToLocalStorage(source: string) {
  try {
    localStorage.setItem(STORAGE_KEYS.SOURCE, source)
  } catch { /* ignore */ }
}

export function loadSourceFromLocalStorage(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.SOURCE) || ''
  } catch {
    return ''
  }
}

export function saveSplitterPosition(pos: number) {
  try {
    localStorage.setItem(STORAGE_KEYS.SPLITTER, String(pos))
  } catch { /* ignore */ }
}

export function loadSplitterPosition(): number {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.SPLITTER)
    return val ? Number(val) : 50
  } catch {
    return 50
  }
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
20 GOSUB 200
30 PRINT "Original array:" : GOSUB 300
40 FOR I = 0 TO 8
50 FOR J = 0 TO 8 - I
60 IF A(J) > A(J+1) THEN SWAP A(J), A(J+1)
70 NEXT J
80 NEXT I
90 PRINT "Sorted array:" : GOSUB 300
100 END
200 REM Generate random values
210 FOR I = 0 TO 9: A(I) = INT(RND * 100) : NEXT I : PRINT
220 RETURN
300 REM Display the table
310 FOR I = 0 TO 9: PRINT A(I); " "; : NEXT I : PRINT
320 RETURN
`,
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
  // --- Nouveaux exemples ---
  'Prime Numbers': `10 PRINT "Prime numbers from 2 to 100:"
20 FOR N = 2 TO 100
30 P = -1
40 FOR D = 2 TO INT(SQR(N))
50 IF N / D = INT(N / D) THEN P = 0
60 NEXT D
70 IF P THEN PRINT N; " ";
80 NEXT N
90 PRINT`,
  'Multiplication Table': `10 PRINT TAB(10); "Multiplication Table"
20 PRINT STRING$(50, "-")
30 FOR I = 1 TO 10
40 FOR J = 1 TO 10
50 PRINT USING "###"; I * J;
60 NEXT J
70 PRINT
80 NEXT I`,
  'Pi Approximation': `10 PRINT "Approximating Pi using Leibniz series"
20 P = 0
30 S = 1
40 FOR I = 1 TO 10000 STEP 2
50 P = P + S * (4 / I)
60 S = -S
70 NEXT I
80 PRINT "Pi = "; P
90 PRINT "Error = "; ABS(P - 3.1415926535)`,
  'Factorial': `10 INPUT "Enter a number: "; N
20 F = 1
30 FOR I = 1 TO N
40 F = F * I
50 NEXT I
60 PRINT "Factorial of "; N; " is "; F`,
  'Sierpinski Triangle': `10 SCREEN 1
20 X1 = 160: Y1 = 10
30 X2 = 10: Y2 = 190
40 X3 = 310: Y3 = 190
50 X = 160: Y = 100
60 FOR I = 1 TO 3000
70 R = INT(RND * 3) + 1
80 ON R GOTO 100, 200, 300
100 X = (X + X1) / 2: Y = (Y + Y1) / 2: GOTO 400
200 X = (X + X2) / 2: Y = (Y + Y2) / 2: GOTO 400
300 X = (X + X3) / 2: Y = (Y + Y3) / 2
400 PSET (X, Y), 10
410 NEXT I`,
  'Mastermind': `10 RANDOMIZE TIMER
20 DIM C(4), G(4)
30 PRINT "Mastermind - Guess 4 colors (1-6)"
40 FOR I = 1 TO 4: C(I) = INT(RND * 6) + 1: NEXT I
50 T = 0
60 T = T + 1: B = 0: W = 0
70 PRINT "Guess"; T; ": ";
80 FOR I = 1 TO 4: G(I) = INT(RND * 6) + 1: PRINT G(I); : NEXT I
90 PRINT " -> ";
100 FOR I = 1 TO 4
110 IF G(I) = C(I) THEN B = B + 1: GOTO 140
120 FOR J = 1 TO 4
130 IF I <> J AND G(I) = C(J) AND G(J) <> C(J) THEN W = W + 1: G(J) = 0: GOTO 140
140 NEXT J
150 NEXT I
160 PRINT B; "Black "; W; "White"
170 IF B = 4 THEN PRINT "Solved in"; T; "turns!" : END
180 IF T < 20 THEN GOTO 60
190 PRINT "Too many turns! The code was: ";
200 FOR I = 1 TO 4: PRINT C(I); : NEXT I`,
  'Pascal Triangle': `10 INPUT "Number of rows: "; N
20 FOR I = 0 TO N - 1
30 PRINT SPC((N - I) * 2);
40 C = 1
50 FOR J = 0 TO I
60 PRINT USING "####"; C;
70 C = C * (I - J) / (J + 1)
80 NEXT J
90 PRINT
100 NEXT I`,
  'Chessboard': `10 SCREEN 1
20 S = 20: REM square size
30 FOR R = 0 TO 7
40 FOR C = 0 TO 7
50 X1 = C * S + 80: Y1 = R * S + 20
60 X2 = X1 + S: Y2 = Y1 + S
70 IF (R + C) MOD 2 = 0 THEN L = 15 ELSE L = 0
80 LINE (X1, Y1)-(X2, Y2), L, BF
90 NEXT C
100 NEXT R`,
  'Sieve of Eratosthenes': `10 DIM P(1000)
20 FOR I = 2 TO 1000: P(I) = -1: NEXT I
30 FOR I = 2 TO INT(SQR(1000))
40 IF P(I) = 0 THEN 70
50 FOR J = I * I TO 1000 STEP I
60 P(J) = 0
70 NEXT J
80 NEXT I
90 PRINT "Primes up to 1000:"
100 C = 0
110 FOR I = 2 TO 1000
120 IF P(I) THEN PRINT I; : C = C + 1: IF C MOD 10 = 0 THEN PRINT
130 NEXT I
140 PRINT : PRINT "Total:"; C`,
  'Collatz Conjecture': `10 INPUT "Enter starting number: "; N
20 PRINT N;
30 WHILE N <> 1
40 IF N / 2 = INT(N / 2) THEN N = N / 2 ELSE N = 3 * N + 1
50 PRINT " -> "; N;
60 WEND
70 PRINT : PRINT "Reached 1!"`,
  'Data Statistics': `10 DIM D(100)
20 N = 0: S = 0
30 READ V
40 WHILE V <> -9999
50 D(N) = V: N = N + 1: S = S + V
60 READ V
70 WEND
80 PRINT "Count: "; N
90 PRINT "Sum: "; S
100 PRINT "Mean: "; S / N
110 PRINT "Min: "; MIN(D, N)
120 PRINT "Max: "; MAX(D, N)
130 PRINT "Median: "; MEDIAN(D, N)
140 PRINT "StdDev: "; STDP(D, N)
150 DATA 12, 45, 67, 23, 89, 34, 56, 78, 90, 11
160 DATA 22, 33, 44, 55, 66, 77, 88, 99, 10, 20
170 DATA -9999`,
  'Matrix Addition': `10 DIM A(3, 3), B(3, 3), C(3, 3)
20 PRINT "Matrix A:"
30 FOR I = 0 TO 2
40 FOR J = 0 TO 2
50 A(I, J) = INT(RND * 10)
60 PRINT A(I, J); " ";
70 NEXT J: PRINT
80 NEXT I: PRINT
90 PRINT "Matrix B:"
100 FOR I = 0 TO 2
110 FOR J = 0 TO 2
120 B(I, J) = INT(RND * 10)
130 PRINT B(I, J); " ";
140 NEXT J: PRINT
150 NEXT I: PRINT
160 PRINT "A + B:"
170 FOR I = 0 TO 2
180 FOR J = 0 TO 2
190 C(I, J) = A(I, J) + B(I, J)
200 PRINT C(I, J); " ";
210 NEXT J: PRINT
220 NEXT I`,
  'Sorting Demo': `10 DIM A(20)
20 PRINT "Original array:"
30 FOR I = 0 TO 19
40 A(I) = INT(RND * 100)
50 PRINT A(I); " ";
60 NEXT I: PRINT
70 CALL SORT(A, 0, 20)
80 PRINT "Sorted array:"
90 FOR I = 0 TO 19
100 PRINT A(I); " ";
110 NEXT I: PRINT
120 CALL INVERT(A, 0, 20)
130 PRINT "Reversed array:"
140 FOR I = 0 TO 19
150 PRINT A(I); " ";
160 NEXT I: PRINT`,
  'Digital Clock': `10 CLS
20 PRINT "Digital Clock (CTRL+C to stop)"
30 T$ = DATESTR$(MKDATE)
40 PRINT T$
50 FOR I = 1 TO 500: NEXT I
60 GOTO 30`,
  'Biorhythm': `10 RANDOMIZE TIMER
20 PRINT "Biorhythm Calculator"
30 INPUT "Enter your birth year: "; Y
40 INPUT "Enter your birth month: "; M
50 INPUT "Enter your birth day: "; D
60 B = MKDATE(Y, M, D)
70 T = MKDATE
80 N = INT((T - B) / 86400)
90 PRINT : PRINT "Days alive: "; N
100 PRINT "Physical:  "; INT(50 * SIN(2 * 3.14159 * N / 23) + 50); "%"
110 PRINT "Emotional: "; INT(50 * SIN(2 * 3.14159 * N / 28) + 50); "%"
120 PRINT "Intellect: "; INT(50 * SIN(2 * 3.14159 * N / 33) + 50); "%"`,
  'Clock Animation': `10 SCREEN 1
20 CLS
30 C = 160: R = 90: S = 80
40 CIRCLE (C, R), S, 15
50 FOR I = 0 TO 11
60 A = I * 30 * 3.14159 / 180
70 X = C + COS(A) * (S - 8)
80 Y = R + SIN(A) * (S - 8)
90 PSET (X, Y), 15
100 NEXT I
110 H = INT(RND * 12): M = INT(RND * 60)
120 HA = (H + M / 60) * 30 * 3.14159 / 180
130 MA = M * 6 * 3.14159 / 180
140 LINE (C, R)-(C + SIN(HA) * 35, R - COS(HA) * 35), 15
150 LINE (C, R)-(C + SIN(MA) * 55, R - COS(MA) * 55), 15`,
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
  const isStepMode = ref(false)
  const isStepping = ref(false)
  const currentLineNum = ref(0)
  const currentPhysicalLine = ref(0)
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

  // Inspecteur de variables
  const showVariables = ref(false)
  const variablesSnapshot = ref<{ name: string; value: string }[]>([])

  function refreshVariables() {
    const vars: { name: string; value: string }[] = []
    if (interpreterRef.value) {
      const allVars = interpreterRef.value.getVariables()
      allVars.forEach((val: unknown, key: string) => {
        if (typeof val === 'object' && val !== null && (val as any).dimensions) {
          // C'est un tableau
          const arr = val as { dimensions: number[]; data: unknown[] }
          vars.push({
            name: key,
            value: `Array(${arr.dimensions.join(',')}) [${arr.data.slice(0, 10).map(v => String(v)).join(', ')}${arr.data.length > 10 ? ', ...' : ''}]`
          })
        } else {
          vars.push({ name: key, value: String(val) })
        }
      })
      vars.sort((a, b) => a.name.localeCompare(b.name))
    }
    variablesSnapshot.value = vars
  }

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

    // Set up step mode callback
    interpreterRef.value = new GWBasicInterpreter(outputCallback, inputCallback)
    interpreterRef.value.setStepCallback((lineNum: number) => {
      currentLineNum.value = lineNum
      // Calculer la ligne physique correspondante
      const physLine = interpreterRef.value!.getPhysicalLine(lineNum)
      currentPhysicalLine.value = physLine > 0 ? physLine : 0
      isStepping.value = true
      refreshVariables()
    })
  }

  // Initialize on first call
  initInterpreter()

  function enableStepMode() {
    isStepMode.value = true
    interpreterRef.value?.setStepMode(true)
  }

  function disableStepMode() {
    isStepMode.value = false
    isStepping.value = false
    interpreterRef.value?.setStepMode(false)
  }

  function stepForward() {
    if (interpreterRef.value && isStepping.value) {
      isStepping.value = false
      interpreterRef.value.stepForward()
    }
  }

  function continueExecution() {
    if (interpreterRef.value && isStepping.value) {
      isStepping.value = false
      // Disable step mode for continue (run to completion)
      interpreterRef.value.setStepMode(false)
      interpreterRef.value.stepForward()
    }
  }

  // Breakpoint functions
  function setBreakpoint(lineNum: number) {
    interpreterRef.value?.setBreakpoint(lineNum)
  }

  function removeBreakpoint(lineNum: number) {
    interpreterRef.value?.removeBreakpoint(lineNum)
  }

  function toggleBreakpoint(lineNum: number) {
    interpreterRef.value?.toggleBreakpoint(lineNum)
  }

  function hasBreakpoint(lineNum: number) {
    return interpreterRef.value?.hasBreakpoint(lineNum) || false
  }

  function clearBreakpoints() {
    interpreterRef.value?.clearBreakpoints()
  }

  function runUntilBreakpoint() {
    if (interpreterRef.value && isStepping.value) {
      isStepping.value = false
      interpreterRef.value.setStepMode(false)
      interpreterRef.value.setRunToBreakpoint(true)
      interpreterRef.value.stepForward()
    }
  }

  async function runProgram(source: string, stepMode: boolean = false) {
    if (isRunning.value) return
    isRunning.value = true
    isStepping.value = false
    currentLineNum.value = 0
    output.value = []
    inputMode.value = false
    pendingGraphics.value = []
    currentFgColor.value = null
    lastOutputEndedWithNewline.value = true
    activeTab.value = screenMode.value === 1 ? 'graphics' : 'output'

    if (stepMode) {
      enableStepMode()
    }

    try {
      await interpreterRef.value?.run(source)
    } catch (e) {
      addOutput(`Error: ${(e as Error).message}\n`, true)
    }

    isRunning.value = false
    isStepping.value = false
    addOutput('\nOk\n')
    if (isStepMode.value) {
      disableStepMode()
    }
    refreshVariables()
  }

  function stopProgram() {
    interpreterRef.value?.stop()
    if (isStepping.value && interpreterRef.value) {
      interpreterRef.value.stepForward() // unblock the step pause
    }
    isRunning.value = false
    isStepping.value = false
    inputMode.value = false
    if (inputResolveRef.value) {
      inputResolveRef.value('')
      inputResolveRef.value = null
    }
    addOutput('\nBreak\n')
    refreshVariables()
  }

  function clearOutput() {
    output.value = []
    inputMode.value = false
    currentFgColor.value = null
    lastOutputEndedWithNewline.value = true
    interpreterRef.value?.reset()
    if (canvasRef.value) initCanvasClear(canvasRef.value)
    pendingGraphics.value = []
    variablesSnapshot.value = []
    isStepMode.value = false
    isStepping.value = false
    currentLineNum.value = 0
  }

  function newProgram() {
    currentFgColor.value = null
    lastOutputEndedWithNewline.value = true
    screenMode.value = 0
    activeTab.value = 'output'
    interpreterRef.value?.reset()
    interpreterRef.value?.loadProgram('')
    pendingGraphics.value = []
    variablesSnapshot.value = []
    isStepMode.value = false
    isStepping.value = false
    currentLineNum.value = 0
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
    refreshVariables()
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
    isStepMode,
    isStepping,
    currentLineNum,
    currentPhysicalLine,
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
    // Inspecteur
    showVariables,
    variablesSnapshot,
    refreshVariables,
    // Step mode
    enableStepMode,
    disableStepMode,
    stepForward,
    continueExecution,
    // Breakpoints
    setBreakpoint,
    removeBreakpoint,
    toggleBreakpoint,
    hasBreakpoint,
    clearBreakpoints,
    runUntilBreakpoint,
  }
}
