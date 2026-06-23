// GW-BASIC Interpreter / Executor

import type {
  Expression, NumberLiteral, StringLiteral, VariableRef, BinaryOp, UnaryOp, FunctionCall,
  Statement, PrintStatement, InputStatement, LetStatement, IfStatement,
  ForStatement, NextStatement, GotoStatement, GosubStatement, ReturnStatement,
  WhileStatement, WendStatement, SelectStatement, DimStatement, ReadStatement,
  DataStatement,
  SwapStatement, RandomizeStatement, ColorStatement, LocateStatement,
  ScreenStatement, PsetStatement, LineStatement, CircleStatement, DrawStatement,
  PaintStatement, SoundStatement,
  OnGotoStatement, OnGosubStatement, MidAssignStatement, CallStatement,
  DefFnStatement, OnErrorStatement, ResumeStatement, RenumStatement,
  InterpreterOutput, ASTNode,
} from './types';
import { Lexer } from './lexer';
import { Parser } from './parser';

export type OutputCallback = (output: InterpreterOutput) => void;
export type InputCallback = () => Promise<string>;
export type StepCallback = (lineNum: number) => void;

export class GWBasicInterpreter {
  private variables: Map<string, any> = new Map();
  private program: Map<number, Statement[]> = new Map();
  private flatProgram: Statement[] = [];
  private lineNumbers: number[] = [];
  private dataPointer: number = 0;
  private dataValues: (number | string)[] = [];
  private forStack: { variable: string; endValue: number; step: number; pc: number }[] = [];
  private gosubStack: { pc: number }[] = [];
  private whileStack: { pc: number }[] = [];
  private selectStack: { value: unknown; matched: boolean }[] = [];
  private running: boolean = false;
  private stopped: boolean = false;
  private pc: number = 0;
  private screenMode: number = 0;
  private foregroundColor: number = 7;
  private backgroundColor: number = -1;
  private cursorRow: number = 1;
  private cursorCol: number = 1;
  private lastRandom: number = 0;
  private startTime: number = Date.now();
  private sourceLines: Map<number, string> = new Map();
  private currentLineNum: number = 0;
  private currentColNum: number = 0;
  private errorHandlerLine: number | null = null;
  private lastErrorLine: number | null = null;
  private lastErrorCode: number = 0;
  private customFunctions: Map<string, { paramName: string; expression: Expression }> = new Map();
  private originalSource: string = '';
  private lineNumberMap: Map<number, number> = new Map();

  // Step mode support
  private stepMode: boolean = false;
  private stepResolve: (() => void) | null = null;
  private stepCallback: StepCallback | null = null;
  private physicalLineNum: number = 0;

  // Breakpoint support
  private breakpoints: Set<number> = new Set();
  private runToBreakpoint: boolean = false;
  private skipNextBreakpointCheck: boolean = false;

  private outputCallback: OutputCallback;
  private inputCallback: InputCallback;

  constructor(outputCallback: OutputCallback, inputCallback: InputCallback) {
    this.outputCallback = outputCallback;
    this.inputCallback = inputCallback;
    this.lastRandom = Math.random();
  }

  private verifyLineNumbers(lines: string[]) {
    // Vérifier l'unicité des numéros de ligne dans l'ordre du source
    const seenLineNumbers = new Set<number>();
    let curLine = 1;
    for (const line of lines) {
      const match = line.match(/^\s*(\d+)\s+(.*)$/);
      if (match) {
        const lineNum = parseInt(match[1]);
        if (seenLineNumbers.has(lineNum)) {
          throw new Error(`Duplicate line number ${lineNum} at line ${curLine}`);
        }
        seenLineNumbers.add(lineNum);
        this.sourceLines.set(lineNum, match[2]);
        this.lineNumberMap.set(lineNum, curLine);
      }
      curLine++;
    }
  }

  // Load a program from source text
  loadProgram(source: string): void {
    this.sourceLines.clear();
    this.lineNumberMap.clear();
    this.originalSource = source;
    const lines = source.split('\n');

    this.verifyLineNumbers(lines);

    try {
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const flatAst = parser.parseProgram();

      let currentLineNum: number | undefined = undefined;

      // Reconstruire program et flatProgram
      this.program = new Map();
      currentLineNum = undefined;
      let currentStmts: Statement[] = [];

      for (const stmt of flatAst) {
        const lineNum = (stmt as any).line;
        if (lineNum !== undefined) {
          if (lineNum !== currentLineNum) {
            if (currentLineNum !== undefined) {
              this.program.set(currentLineNum, currentStmts);
            }
            currentLineNum = lineNum;
            currentStmts = [stmt];
          } else {
            currentStmts.push(stmt);
          }
        }
      }
      if (currentLineNum !== undefined) {
        this.program.set(currentLineNum, currentStmts);
      }

      this.flatProgram = flatAst;
      this.lineNumbers = Array.from(this.program.keys()).sort((a, b) => a - b);

      // If no line numbers found but source has content, treat as a single direct line
      if (this.lineNumbers.length === 0 && source.trim()) {
        const lexer2 = new Lexer(source);
        const tokens2 = lexer2.tokenize();
        const parser2 = new Parser(tokens2);
        const stmts = parser2.parseLineStatements();
        if (stmts.length > 0) {
          this.program.set(10, stmts);
          this.lineNumbers = [10];
          this.sourceLines.set(10, source.trim());
          this.flatProgram = stmts;
        }
      }

      this.collectData();
    } catch (e: unknown) {
      const err = e as Error;
      // Convertir les numéros de ligne physique en numéros de ligne GW-BASIC
      const match = err.message.match(/^(Unterminated string|Expected .+) at line (\d+)$/);
      if (match) {
        const physLine = parseInt(match[2]);
        // Chercher le numéro de ligne GW-BASIC correspondant à la ligne physique
        const lines = source.split('\n');
        if (physLine >= 1 && physLine <= lines.length) {
          const gwLineMatch = lines[physLine - 1].match(/^\s*(\d+)/);
          if (gwLineMatch) {
            throw new Error(`${match[1]} at line ${gwLineMatch[1]}`);
          }
        }
        throw err;
      }
      if (err.message.startsWith('Unterminated string') ||
        err.message.startsWith('Duplicate line number') ||
        err.message.startsWith('Syntax error') ||
        err.message.startsWith('Expected')) {
        throw err;
      }
      throw new Error(`Syntax error: ${err.message}`);
    }
  }

  // Collect all DATA values
  private collectData(): void {
    this.dataValues = [];
    this.dataPointer = 0;

    for (const lineNum of this.lineNumbers) {
      const stmts = this.program.get(lineNum);
      if (!stmts) continue;
      for (const stmt of stmts) {
        if (stmt.type === 'Data') {
          const dataStmt = stmt as DataStatement;
          this.dataValues.push(...dataStmt.values);
        }
      }
    }
  }

  // Run the program
  async run(source?: string): Promise<void> {
    try {
      if (source) {
        this.loadProgram(source);
      }

      this.reset();
      this.running = true;
      this.stopped = false;
      this.pc = 0;

      await this.executeProgram();
    } catch (e: unknown) {
      const err = e as Error;
      if (err.message !== 'PROGRAM_ENDED' && err.message !== 'PROGRAM_STOPPED') {
        // Si l'erreur contient déjà "at line" (ex: du lexer), ne pas ajouter le suffixe
        const errMsg = err.message.includes(' at line ')
          ? `Error: ${err.message}`
          : `Error: ${err.message} at line ${this.currentLineNum}`;
        this.output({ type: 'error', value: errMsg });
        throw new Error(errMsg);
      }
    } finally {
      this.running = false;
    }
  }

  // Stop execution
  stop(): void {
    this.running = false;
    this.stopped = true;
  }

  // Continue execution after STOP
  async cont(): Promise<void> {
    if (!this.stopped) {
      this.output({ type: 'error', value: "Can't continue" });
      return;
    }
    this.running = true;
    this.stopped = false;
    try {
      await this.executeProgram();
    } catch (e: unknown) {
      const err = e as Error;
      if (err.message !== 'PROGRAM_ENDED' && err.message !== 'PROGRAM_STOPPED') {
        this.output({ type: 'error', value: `Error: ${err.message} at line ${this.currentLineNum}` });
      }
    } finally {
      this.running = false;
    }
  }

  // Reset state
  reset(): void {
    this.variables.clear();
    this.forStack = [];
    this.gosubStack = [];
    this.whileStack = [];
    this.selectStack = [];
    this.dataPointer = 0;
    this.screenMode = 0;
    this.foregroundColor = 7;
    this.backgroundColor = 0;
    this.cursorRow = 1;
    this.cursorCol = 1;
    this.startTime = Date.now();
  }

  // List program
  list(): string {
    const lines: string[] = [];
    for (const lineNum of this.lineNumbers) {
      const src = this.sourceLines.get(lineNum);
      if (src) {
        lines.push(`${lineNum} ${src}`);
      } else {
        const stmts = this.program.get(lineNum);
        if (stmts) {
          lines.push(`${lineNum} [program data]`);
        }
      }
    }
    return lines.join('\n');
  }

  // Execute the program starting from current instruction
  private async executeProgram(): Promise<void> {
    const maxIterations = 5000000; // Safety limit
    let iterations = 0;

    while (this.running && this.pc < this.flatProgram.length) {
      if (iterations++ > maxIterations) {
        this.output({ type: 'error', value: 'Error: Maximum iterations exceeded (possible infinite loop) at line ' + this.currentLineNum });
        break;
      }

      const stmt = this.flatProgram[this.pc];
      this.currentLineNum = (stmt as any).line || 0;
      this.currentColNum = (stmt as any).col || 0;

      try {
        // Track the pc before executing the statement
        // so we can detect if it was modified by a jump (GOTO, WHILE/WEND, etc.)
        const pcBefore = this.pc;
        await this.executeStatement(stmt);
        const pcAfter = this.pc;

        // If the statement modified pc (e.g., GOTO, WEND looping back),
        // we've already jumped, so continue from the new pc
        if (pcAfter === pcBefore) {
          // No jump, advance to next instruction
          this.pc++;
        }

        // In step mode, pause after each statement
        await this.stepPause();
        
        // Check for breakpoint
        await this.checkBreakpoint();
      } catch (e: unknown) {
        const err = e as Error;
        // Check if there's an error handler
        if (this.errorHandlerLine !== null) {
          // Jump to error handler
          this.lastErrorLine = this.currentLineNum;
          this.lastErrorCode = 1; // Generic error code
          const targetPc = this.findPcByLine(this.errorHandlerLine);
          if (targetPc !== -1) {
            this.pc = targetPc;
            continue;
          }
        }
        // No error handler, throw the error
        throw err;
      }
    }

    if (this.running && this.pc >= this.flatProgram.length) {
      this.running = false;
    }
  }

  // Execute a single statement
  private async executeStatement(stmt: Statement): Promise<void> {
    if (!this.running) return;

    // Update current position tracking from statement metadata
    if ((stmt as any).line !== undefined) {
      this.currentLineNum = (stmt as any).line;
    }
    if ((stmt as any).col !== undefined) {
      this.currentColNum = (stmt as any).col;
    }

    switch (stmt.type) {
      case 'Print': await this.execPrint(stmt as PrintStatement); break;
      case 'Input': await this.execInput(stmt as InputStatement); break;
      case 'Let': this.execLet(stmt as LetStatement); break;
      case 'If': await this.execIf(stmt as IfStatement); break;
      case 'For': this.execFor(stmt as ForStatement); break;
      case 'Next': this.execNext(stmt as NextStatement); break;
      case 'Goto': this.execGoto(stmt as GotoStatement); break;
      case 'Gosub': this.execGosub(stmt as GosubStatement); break;
      case 'Return': this.execReturn(stmt as ReturnStatement); break;
      case 'While': this.execWhile(stmt as WhileStatement); break;
      case 'Wend': this.execWend(stmt as WendStatement); break;
      case 'Select': await this.execSelect(stmt as SelectStatement); break;
      case 'Dim': this.execDim(stmt as DimStatement); break;
      case 'Read': this.execRead(stmt as ReadStatement); break;
      case 'Data': break; // Data is pre-collected
      case 'Restore': this.dataPointer = 0; break;
      case 'Rem': break; // Comments - ignore
      case 'Cls': this.output({ type: 'clear' }); break;
      case 'End': this.running = false; break;
      case 'Stop': this.stopped = true; this.running = false; break;
      case 'Swap': this.execSwap(stmt as SwapStatement); break;
      case 'Randomize': this.execRandomize(stmt as RandomizeStatement); break;
      case 'Color': this.execColor(stmt as ColorStatement); break;
      case 'Locate': this.execLocate(stmt as LocateStatement); break;
      case 'Screen': this.execScreen(stmt as ScreenStatement); break;
      case 'Pset': this.execPset(stmt as PsetStatement); break;
      case 'Line': this.execLine(stmt as LineStatement); break;
      case 'Circle': this.execCircle(stmt as CircleStatement); break;
      case 'Draw': this.execDraw(stmt as DrawStatement); break;
      case 'Paint': this.execPaint(stmt as PaintStatement); break;
      case 'Beep': this.output({ type: 'beep' }); break;
      case 'Sound': this.execSound(stmt as SoundStatement); break;
      case 'Poke': break; // POKE - no-op in browser
      case 'OnGoto': this.execOnGoto(stmt as OnGotoStatement); break;
      case 'OnGosub': await this.execOnGosub(stmt as OnGosubStatement); break;
      case 'MidAssign': this.execMidAssign(stmt as MidAssignStatement); break;
      case 'Call': this.execCall(stmt as CallStatement); break;
      case 'DefFn': this.execDefFn(stmt as DefFnStatement); break;
      case 'OnError': this.execOnError(stmt as OnErrorStatement); break;
      case 'Resume': this.execResume(stmt as ResumeStatement); break;
      case 'Renum': this.execRenum(stmt as RenumStatement); break;
    }
  }

  // Evaluate an expression
  evalExpr(expr: Expression): unknown {
    switch (expr.type) {
      case 'NumberLiteral': return (expr as NumberLiteral).value;
      case 'StringLiteral': return (expr as StringLiteral).value;
      case 'VariableRef': return this.getVariable(expr as VariableRef);
      case 'BinaryOp': return this.evalBinaryOp(expr as BinaryOp);
      case 'UnaryOp': return this.evalUnaryOp(expr as UnaryOp);
      case 'FunctionCall': return this.evalFunctionCall(expr as FunctionCall);
      default: return 0;
    }
  }

  getVariables() {
    return this.variables;
  }

  private getVariable(ref: VariableRef): unknown {
    // Check if it's a custom function call (DEF FN)
    if (this.customFunctions.has(ref.name) && ref.indices.length > 0) {
      const customFn = this.customFunctions.get(ref.name)!;
      const arg = this.evalExpr(ref.indices[0]);
      // Save current value of parameter
      const paramValue = this.variables.get(customFn.paramName);
      // Set parameter value
      this.variables.set(customFn.paramName, arg);
      // Evaluate expression
      const result = this.evalExpr(customFn.expression);
      // Restore parameter
      if (paramValue !== undefined) {
        this.variables.set(customFn.paramName, paramValue);
      } else {
        this.variables.delete(customFn.paramName);
      }
      return result;
    }
    
    if (!this.variables.has(ref.name)) {
      throw new Error(`Variable ${ref.name} not declared`);
    }
    const variable = this.variables.get(ref.name);
    if (ref.indices.length > 0) {
      if (variable.dimensions) {
        return this.getArrayElement(ref.name, ref.indices);
      }
      return this.getStringChar(ref.name, ref.indices);
    }
    return variable ?? 0;
  }

  // Accéder au caractère d'indice ind (1-indexé) dans une chaîne
  private getStringChar(name: string, indexExprs: Expression[]): string {
    const str = this.toString(this.variables.get(name) ?? '');
    const index = Math.floor(this.toNumber(this.evalExpr(indexExprs[0])));
    if (index < 1 || index > str.length) {
      throw new Error(`String index out of range: ${index} (valid: 1-${str.length})`);
    }
    return str[index - 1];
  }

  private getArrayElement(name: string, indexExprs: Expression[]): unknown {
    if (!this.variables.has(name)) {
      throw new Error(`Array ${name} not declared`);
    }
    const arr = this.variables.get(name);
    if (arr.dimensions.length !== indexExprs.length) {
      throw new Error(`Variable ${name} has ${arr.dimensions.length} dimensions, but ${indexExprs.length} indices provided`);
    }
    const indices = indexExprs.map(e => Math.floor(this.toNumber(this.evalExpr(e))));

    let invalidIndex = -1;
    indices.forEach((index, i) => {
      if (index < 0 || index >= arr.dimensions[i]) {
        invalidIndex = i;
      }
    });
    if (invalidIndex !== -1) {
      throw new Error(`Array index out of range ${indices[invalidIndex]} for ${name} at dimension ${invalidIndex + 1}`);
    }

    let flatIndex = 0;
    let multiplier = 1;
    for (let i = arr.dimensions.length - 1; i >= 0; i--) {
      flatIndex += indices[i] * multiplier;
      multiplier *= arr.dimensions[i];
    }

    return arr.data[flatIndex];
  }

  private setArrayElement(name: string, indexExprs: Expression[], value: unknown): void {
    if (!this.variables.has(name)) {
      throw new Error(`Array ${name} not declared`);
    }
    let arr = this.variables.get(name);

    const indices = indexExprs.map(e => Math.floor(this.toNumber(this.evalExpr(e))));
    let flatIndex = 0;
    let multiplier = 1;
    for (let i = arr.dimensions.length - 1; i >= 0; i--) {
      flatIndex += indices[i] * multiplier;
      multiplier *= arr.dimensions[i];
    }

    if (flatIndex >= 0 && flatIndex < arr.data.length) {
      arr.data[flatIndex] = value;
    }
  }

  private toNumber(val: unknown): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    return 0;
  }

  private toString(val: unknown): string {
    if (typeof val === 'string') return val;
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return val.toString();
      return val.toString();
    }
    return String(val);
  }

  private toBool(val: unknown): boolean {
    if (typeof val === 'number') return val !== 0;
    if (typeof val === 'string') return val.length > 0;
    return !!val;
  }

  private evalBinaryOp(op: BinaryOp): unknown {
    const left = this.evalExpr(op.left);
    const right = this.evalExpr(op.right);

    switch (op.op) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return this.toString(left) + this.toString(right);
        }
        return this.toNumber(left) + this.toNumber(right);
      case '-': return this.toNumber(left) - this.toNumber(right);
      case '*': return this.toNumber(left) * this.toNumber(right);
      case '/':
        if (this.toNumber(right) === 0) throw new Error('Division by zero');
        return this.toNumber(left) / this.toNumber(right);
      case '\\': return Math.floor(this.toNumber(left) / this.toNumber(right)); // Integer division
      case '^': return Math.pow(this.toNumber(left), this.toNumber(right));
      case 'MOD': return this.toNumber(left) % this.toNumber(right);
      case '=':
        if (typeof left === 'string' && typeof right === 'string') return left === right ? -1 : 0;
        return this.toNumber(left) === this.toNumber(right) ? -1 : 0;
      case '<>':
      case '!=':
        if (typeof left === 'string' && typeof right === 'string') return left !== right ? -1 : 0;
        return this.toNumber(left) !== this.toNumber(right) ? -1 : 0;
      case '<':
        if (typeof left === 'string' && typeof right === 'string') return left < right ? -1 : 0;
        return this.toNumber(left) < this.toNumber(right) ? -1 : 0;
      case '>':
        if (typeof left === 'string' && typeof right === 'string') return left > right ? -1 : 0;
        return this.toNumber(left) > this.toNumber(right) ? -1 : 0;
      case '<=':
        if (typeof left === 'string' && typeof right === 'string') return left <= right ? -1 : 0;
        return this.toNumber(left) <= this.toNumber(right) ? -1 : 0;
      case '>=':
        if (typeof left === 'string' && typeof right === 'string') return left >= right ? -1 : 0;
        return this.toNumber(left) >= this.toNumber(right) ? -1 : 0;
      case 'AND': return (this.toBool(left) && this.toBool(right)) ? -1 : 0;
      case 'OR': return (this.toBool(left) || this.toBool(right)) ? -1 : 0;
      case 'XOR': return (this.toBool(left) !== this.toBool(right)) ? -1 : 0;
      default: return 0;
    }
  }

  private evalUnaryOp(op: UnaryOp): unknown {
    const val = this.evalExpr(op.operand);
    switch (op.op) {
      case '-': return -this.toNumber(val);
      case 'NOT': return this.toBool(val) ? 0 : -1;
      case '+': return this.toNumber(val);
      default: return val;
    }
  }

  private evalFunctionCall(func: FunctionCall): unknown {
    const args = func.args.map(a => this.evalExpr(a));

    // Check custom functions first (DEF FN)
    if (this.customFunctions.has(func.name)) {
      const customFn = this.customFunctions.get(func.name)!;
      // Save current value of parameter
      const paramValue = this.variables.get(customFn.paramName);
      // Set parameter value
      this.variables.set(customFn.paramName, args[0] || 0);
      // Evaluate expression
      const result = this.evalExpr(customFn.expression);
      // Restore parameter
      if (paramValue !== undefined) {
        this.variables.set(customFn.paramName, paramValue);
      } else {
        this.variables.delete(customFn.paramName);
      }
      return result;
    }

    switch (func.name) {
      case 'ABS': return Math.abs(this.toNumber(args[0]));
      case 'INT': return Math.floor(this.toNumber(args[0]));
      case 'FIX': return Math.trunc(this.toNumber(args[0]));
      case 'SQR': return Math.sqrt(this.toNumber(args[0]));
      case 'SIN': return Math.sin(this.toNumber(args[0]));
      case 'COS': return Math.cos(this.toNumber(args[0]));
      case 'TAN': return Math.tan(this.toNumber(args[0]));
      case 'ATN': return Math.atan(this.toNumber(args[0]));
      case 'ATAN2': return Math.atan2(this.toNumber(args[1]), this.toNumber(args[0]));
      case 'HYPO': return Math.hypot(this.toNumber(args[0]), this.toNumber(args[1]));
      case 'LOG': return Math.log(this.toNumber(args[0]));
      case 'EXP': return Math.exp(this.toNumber(args[0]));
      case 'SGN': {
        const n = this.toNumber(args[0]);
        return n > 0 ? 1 : n < 0 ? -1 : 0;
      }
      case 'RND': {
        if (args.length > 0) {
          const n = this.toNumber(args[0]);
          if (n < 0) this.lastRandom = Math.random();
          if (n === 0) { /* return same value */ }
          else this.lastRandom = Math.random();
        } else {
          this.lastRandom = Math.random();
        }
        return this.lastRandom;
      }
      case 'LEN': return this.toString(args[0]).length;
      case 'LEFT$': return this.toString(args[0]).substring(0, this.toNumber(args[1]));
      case 'RIGHT$': {
        const s = this.toString(args[0]);
        const n = this.toNumber(args[1]);
        return s.substring(s.length - n);
      }
      case 'MID$': {
        const s = this.toString(args[0]);
        const start = this.toNumber(args[1]) - 1; // BASIC is 1-indexed
        if (args.length > 2) {
          const len = this.toNumber(args[2]);
          return s.substring(start, start + len);
        }
        return s.substring(start);
      }
      case 'CHR$': return String.fromCharCode(Math.floor(this.toNumber(args[0])));
      case 'ASC': return this.toString(args[0]).charCodeAt(0);
      case 'STR$': {
        const n = this.toNumber(args[0]);
        return n >= 0 ? ' ' + n.toString() : n.toString();
      }
      case 'VAL': {
        const s = this.toString(args[0]).trim();
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
      }
      case 'STRING$': {
        const n = Math.floor(this.toNumber(args[0]));
        const secondArg = args[1];
        let char: string;
        if (typeof secondArg === 'string') {
          // If string, use first character
          char = secondArg.charAt(0) || ' ';
        } else {
          // If number, use as ASCII code
          const charCode = Math.floor(this.toNumber(secondArg));
          char = String.fromCharCode(charCode);
        }
        return char.repeat(n);
      }
      case 'SPACE$': return ' '.repeat(Math.floor(this.toNumber(args[0])));
      case 'INSTR': {
        const haystack = this.toString(args.length > 2 ? args[1] : args[0]);
        const needle = this.toString(args.length > 2 ? args[2] : args[1]);
        const start = args.length > 2 ? Math.floor(this.toNumber(args[0])) - 1 : 0;
        const idx = haystack.indexOf(needle, start);
        return idx === -1 ? 0 : idx + 1;
      }
      case 'UCASE$': return this.toString(args[0]).toUpperCase();
      case 'LCASE$': return this.toString(args[0]).toLowerCase();
      case 'TAB': return ' '.repeat(Math.max(0, Math.floor(this.toNumber(args[0])) - 1));
      case 'SPC': return ' '.repeat(Math.max(0, Math.floor(this.toNumber(args[0]))));
      case 'INKEY$': return ''; // No key input in browser
      case 'PEEK': return 0; // No memory in browser
      case 'TIMER': return (Date.now() - this.startTime) / 1000;
      // Date functions
      case 'MKDATE': {
        const now = new Date();
        if (args.length === 0) return Math.floor(now.getTime() / 1000);
        const year = args.length >= 1 ? this.toNumber(args[0]) : now.getFullYear();
        const month = args.length >= 2 ? this.toNumber(args[1]) : (now.getMonth() + 1);
        const day = args.length >= 3 ? this.toNumber(args[2]) : now.getDate();
        const hour = args.length >= 4 ? this.toNumber(args[3]) : now.getHours();
        const minute = args.length >= 5 ? this.toNumber(args[4]) : now.getMinutes();
        const second = args.length >= 6 ? this.toNumber(args[5]) : now.getSeconds();
        return Math.floor(new Date(year, month - 1, day, hour, minute, second).getTime() / 1000);
      }
      case 'YEAR': {
        const d = new Date(this.toNumber(args[0]) * 1000);
        return d.getFullYear();
      }
      case 'MONTH': {
        const d = new Date(this.toNumber(args[0]) * 1000);
        return d.getMonth() + 1;
      }
      case 'DAY': {
        const d = new Date(this.toNumber(args[0]) * 1000);
        return d.getDate();
      }
      case 'DAYW': {
        const d = new Date(this.toNumber(args[0]) * 1000);
        return d.getDay();
      }
      case 'HOUR': {
        const d = new Date(this.toNumber(args[0]) * 1000);
        return d.getHours();
      }
      case 'MINUTE': {
        const d = new Date(this.toNumber(args[0]) * 1000);
        return d.getMinutes();
      }
      case 'SECONDS': {
        const d = new Date(this.toNumber(args[0]) * 1000);
        return d.getSeconds();
      }
      case 'DATESTR$': {
        const d = new Date(this.toNumber(args[0]) * 1000);
        const y = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        const s = String(d.getSeconds()).padStart(2, '0');
        return `${y}-${mo}-${da} ${h}:${mi}:${s}`;
      }
      case 'TODATE': {
        const str = this.toString(args[0]);
        const match = str.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
        if (!match) {
          this.output({ type: 'error', value: 'ERROR: Invalid date format\n' });
          return 0;
        }
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);
        const hour = parseInt(match[4]);
        const minute = parseInt(match[5]);
        const second = parseInt(match[6]);
        return Math.floor(new Date(year, month - 1, day, hour, minute, second).getTime() / 1000);
      }
      // Statistical functions
      case 'SUM': {
        if (args.length === 2 && typeof args[1] === 'number' && func.args[0].type === 'VariableRef') {
          // SUM(array, n) - sum of n elements from array
          const arrName = (func.args[0] as VariableRef).name;
          const n = Math.floor(this.toNumber(args[1]));
          let sum = 0;
          for (let i = 0; i < n; i++) {
            const idxExpr = { type: 'NumberLiteral', value: i } as any;
            sum += this.toNumber(this.getArrayElement(arrName, [idxExpr]));
          }
          return sum;
        }
        // SUM(a1, a2, a3, ...)
        return args.reduce((acc: number, val) => acc + this.toNumber(val), 0);
      }
      case 'AVG': {
        if (args.length === 2 && typeof args[1] === 'number' && func.args[0].type === 'VariableRef') {
          // AVG(array, n) - average of n elements from array
          const arrName = (func.args[0] as VariableRef).name;
          const n = Math.floor(this.toNumber(args[1]));
          if (n === 0) return 0;
          let sum = 0;
          for (let i = 0; i < n; i++) {
            const idxExpr = { type: 'NumberLiteral', value: i } as any;
            sum += this.toNumber(this.getArrayElement(arrName, [idxExpr]));
          }
          return sum / n;
        }
        // AVG(a1, a2, a3, ...)
        if (args.length === 0) return 0;
        const sum = args.reduce((acc: number, val) => acc + this.toNumber(val), 0);
        return sum / args.length;
      }
      case 'SUMPROD': {
        if (args.length === 3 && typeof args[2] === 'number' &&
          func.args[0].type === 'VariableRef' && func.args[1].type === 'VariableRef') {
          // SUMPROD(a, b, n)
          const aName = (func.args[0] as VariableRef).name;
          const bName = (func.args[1] as VariableRef).name;
          const n = Math.floor(this.toNumber(args[2]));
          let sum = 0;
          for (let i = 0; i < n; i++) {
            const idxExpr = { type: 'NumberLiteral', value: i } as any;
            const aVal = this.toNumber(this.getArrayElement(aName, [idxExpr]));
            const bVal = this.toNumber(this.getArrayElement(bName, [idxExpr]));
            sum += aVal * bVal;
          }
          return sum;
        }
        // SUMPROD(a1, b1, a2, b2, ...)
        let sum = 0;
        for (let i = 0; i < args.length; i += 2) {
          sum += this.toNumber(args[i]) * this.toNumber(args[i + 1]);
        }
        return sum;
      }
      case 'AVGP': {
        if (args.length === 3 && typeof args[2] === 'number' &&
          func.args[0].type === 'VariableRef' && func.args[1].type === 'VariableRef') {
          // AVGP(a, b, n) - weighted average of two arrays
          const aName = (func.args[0] as VariableRef).name;
          const bName = (func.args[1] as VariableRef).name;
          const n = Math.floor(this.toNumber(args[2]));
          let sumA = 0;
          let sumB = 0;
          for (let i = 0; i < n; i++) {
            const idxExpr = { type: 'NumberLiteral', value: i } as any;
            sumA += this.toNumber(this.getArrayElement(aName, [idxExpr]));
            sumB += this.toNumber(this.getArrayElement(bName, [idxExpr]));
          }
          return sumB === 0 ? 0 : sumA / sumB;
        }
        // AVGP(a1, b1, a2, b2, ...)
        let sumA = 0;
        let sumB = 0;
        for (let i = 0; i < args.length; i += 2) {
          sumA += this.toNumber(args[i]);
          sumB += this.toNumber(args[i + 1]);
        }
        return sumB === 0 ? 0 : sumA / sumB;
      }
      case 'MIN': {
        if (args.length === 2 && typeof args[1] === 'number' && func.args[0].type === 'VariableRef') {
          // MIN(array, n)
          const arrName = (func.args[0] as VariableRef).name;
          const n = Math.floor(this.toNumber(args[1]));
          let min = Infinity;
          for (let i = 0; i < n; i++) {
            const idxExpr = { type: 'NumberLiteral', value: i } as any;
            const val = this.toNumber(this.getArrayElement(arrName, [idxExpr]));
            if (val < min) min = val;
          }
          return min === Infinity ? 0 : min;
        }
        // MIN(a1, a2, a3, ...)
        if (args.length === 0) return 0;
        return Math.min(...args.map(a => this.toNumber(a)));
      }
      case 'MAX': {
        if (args.length === 2 && typeof args[1] === 'number' && func.args[0].type === 'VariableRef') {
          // MAX(array, n)
          const arrName = (func.args[0] as VariableRef).name;
          const n = Math.floor(this.toNumber(args[1]));
          let max = -Infinity;
          for (let i = 0; i < n; i++) {
            const idxExpr = { type: 'NumberLiteral', value: i } as any;
            const val = this.toNumber(this.getArrayElement(arrName, [idxExpr]));
            if (val > max) max = val;
          }
          return max === -Infinity ? 0 : max;
        }
        // MAX(a1, a2, a3, ...)
        if (args.length === 0) return 0;
        return Math.max(...args.map(a => this.toNumber(a)));
      }
      case 'VARIP': {
        if (args.length === 2 && typeof args[1] === 'number' && func.args[0].type === 'VariableRef') {
          // VARIP(array, n) - sample variance
          const arrName = (func.args[0] as VariableRef).name;
          const n = Math.floor(this.toNumber(args[1]));
          if (n < 2) return 0;
          const values: number[] = [];
          for (let i = 0; i < n; i++) {
            const idxExpr = { type: 'NumberLiteral', value: i } as any;
            values.push(this.toNumber(this.getArrayElement(arrName, [idxExpr])));
          }
          const mean = values.reduce((a, b) => a + b, 0) / n;
          const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
          return variance;
        }
        // VARIP(a1, a2, a3, ...)
        const values = args.map(a => this.toNumber(a));
        if (values.length < 2) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (values.length - 1);
        return variance;
      }
      case 'STDP': {
        if (args.length === 2 && typeof args[1] === 'number' && func.args[0].type === 'VariableRef') {
          // STDP(array, n) - sample standard deviation
          const arrName = (func.args[0] as VariableRef).name;
          const n = Math.floor(this.toNumber(args[1]));
          if (n < 2) return 0;
          const values: number[] = [];
          for (let i = 0; i < n; i++) {
            const idxExpr = { type: 'NumberLiteral', value: i } as any;
            values.push(this.toNumber(this.getArrayElement(arrName, [idxExpr])));
          }
          const mean = values.reduce((a, b) => a + b, 0) / n;
          const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
          return Math.sqrt(variance);
        }
        // STDP(a1, a2, a3, ...)
        const values = args.map(a => this.toNumber(a));
        if (values.length < 2) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (values.length - 1);
        return Math.sqrt(variance);
      }
      case 'MEDIAN': {
        if (args.length === 2 && typeof args[1] === 'number' && func.args[0].type === 'VariableRef') {
          // MEDIAN(array, n)
          const arrName = (func.args[0] as VariableRef).name;
          const n = Math.floor(this.toNumber(args[1]));
          const values: number[] = [];
          for (let i = 0; i < n; i++) {
            const idxExpr = { type: 'NumberLiteral', value: i } as any;
            values.push(this.toNumber(this.getArrayElement(arrName, [idxExpr])));
          }
          values.sort((a, b) => a - b);
          if (values.length % 2 === 0) {
            return (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
          }
          return values[Math.floor(values.length / 2)];
        }
        // MEDIAN(a1, a2, a3, ...)
        const values = args.map(a => this.toNumber(a));
        values.sort((a, b) => a - b);
        if (values.length % 2 === 0) {
          return (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
        }
        return values[Math.floor(values.length / 2)];
      }
      case 'FIND': {
        // FIND(val, arr, count) -> search for position of val in first count elements of arr
        // FIND(val, arr, count, p) -> search for position of val in first count elements of arr starting from position p
        if (func.args.length < 3 || func.args[1].type !== 'VariableRef') {
          return 0;
        }
        const val = args[0];
        const arrName = (func.args[1] as VariableRef).name;
        const count = Math.floor(this.toNumber(args[2]));
        const startPos = args.length > 3 ? Math.floor(this.toNumber(args[3])) : 0; // Convert to 0-indexed
        for (let i = startPos; i < count; i++) {
          const idxExpr = { type: 'NumberLiteral', value: i } as any;
          const element = this.getArrayElement(arrName, [idxExpr]);
          if (this.toNumber(element) === this.toNumber(val)) {
            return i; // Return 0-indexed position
          }
        }
        return -1; // Not found
      }
      // Base conversion functions
      case 'OCT$': {
        const n = Math.floor(this.toNumber(args[0]));
        return n.toString(8).toUpperCase();
      }
      case 'HEX$': {
        const n = Math.floor(this.toNumber(args[0]));
        return n.toString(16).toUpperCase();
      }
      case 'BIN$': {
        const n = Math.floor(this.toNumber(args[0]));
        return n.toString(2);
      }
      // Statistical functions
      case 'PERCENTILE': {
        if (args.length >= 3 && typeof args[1] === 'number' && func.args[0].type === 'VariableRef') {
          // PERCENTILE(array, n, p) - percentile of n elements from array at position p (0-100)
          const arrName = (func.args[0] as VariableRef).name;
          const n = Math.floor(this.toNumber(args[1]));
          const p = this.toNumber(args[2]) / 100;
          const values: number[] = [];
          for (let i = 0; i < n; i++) {
            const idxExpr = { type: 'NumberLiteral', value: i } as any;
            values.push(this.toNumber(this.getArrayElement(arrName, [idxExpr])));
          }
          values.sort((a, b) => a - b);
          const index = Math.floor(p * (values.length - 1));
          return values[index];
        }
        // PERCENTILE(a1, a2, a3, ..., p)
        if (args.length >= 2) {
          const p = this.toNumber(args[args.length - 1]) / 100;
          const values = args.slice(0, -1).map(a => this.toNumber(a));
          values.sort((a, b) => a - b);
          const index = Math.floor(p * (values.length - 1));
          return values[index];
        }
        return 0;
      }
      // String functions
      case 'INSTRI': {
        const haystack = this.toString(args.length > 2 ? args[1] : args[0]);
        const needle = this.toString(args.length > 2 ? args[2] : args[1]);
        const start = args.length > 2 ? Math.floor(this.toNumber(args[0])) - 1 : 0;
        const idx = haystack.toLowerCase().indexOf(needle.toLowerCase(), start);
        return idx === -1 ? 0 : idx + 1;
      }
      case 'SPLIT$': {
        const str = this.toString(args[0]);
        const delimiter = args.length > 1 ? this.toString(args[1]) : ',';
        const parts = str.split(delimiter);
        // Return as a GW-BASIC-style array object
        return {
          dimensions: [parts.length],
          data: parts
        };
      }
      // Array functions
      case 'CONCAT': {
        if (func.args.length >= 2 && func.args[0].type === 'VariableRef' && func.args[1].type === 'VariableRef') {
          // CONCAT(arr1, arr2, n1, n2) - concatenate n1 elements from arr1 and n2 elements from arr2
          const arr1Name = (func.args[0] as VariableRef).name;
          const arr2Name = (func.args[1] as VariableRef).name;
          const n1 = args.length > 2 ? Math.floor(this.toNumber(args[2])) : this.getArrayLength(arr1Name);
          const n2 = args.length > 3 ? Math.floor(this.toNumber(args[3])) : this.getArrayLength(arr2Name);
          const result: unknown[] = [];
          for (let i = 0; i < n1; i++) {
            const idxExpr = { type: 'NumberLiteral', value: i } as any;
            result.push(this.getArrayElement(arr1Name, [idxExpr]));
          }
          for (let i = 0; i < n2; i++) {
            const idxExpr = { type: 'NumberLiteral', value: i } as any;
            result.push(this.getArrayElement(arr2Name, [idxExpr]));
          }
          // Return as a GW-BASIC-style array object
          return {
            dimensions: [result.length],
            data: result
          };
        }
        return {
          dimensions: [0],
          data: []
        };
      }
      case 'BSEARCH': {
        if (func.args.length < 3 || func.args[1].type !== 'VariableRef') {
          return -1;
        }
        const val = args[0];
        const arrName = (func.args[1] as VariableRef).name;
        const count = Math.floor(this.toNumber(args[2]));
        const values: number[] = [];
        for (let i = 0; i < count; i++) {
          const idxExpr = { type: 'NumberLiteral', value: i } as any;
          values.push(this.toNumber(this.getArrayElement(arrName, [idxExpr])));
        }
        // Binary search requires sorted array
        let left = 0;
        let right = values.length - 1;
        while (left <= right) {
          const mid = Math.floor((left + right) / 2);
          if (values[mid] === this.toNumber(val)) {
            return mid;
          } else if (values[mid] < this.toNumber(val)) {
            left = mid + 1;
          } else {
            right = mid - 1;
          }
        }
        return -1; // Not found
      }
      default: return 0;
    }
  }

  private getArrayLength(name: string): number {
    const arr = this.variables.get(name);
    if (!arr || !arr.dimensions) return 0;
    return arr.dimensions.reduce((a: number, b: number) => a * b, 1);
  }

  // Statement executors

  private async execPrint(stmt: PrintStatement): Promise<void> {
    let output = '';
    let tabPos = 0;

    for (const item of stmt.items) {
      if (typeof item === 'string') {
        if (item === ';') {
          // No space, continue on same line
        } else if (item === ',') {
          // Tab to next 8-column zone
          const currentLen = output.length;
          const nextZone = Math.ceil((currentLen + 1) / 8) * 8;
          output += ' '.repeat(nextZone - currentLen);
        }
      } else {
        const val = this.evalExpr(item);
        if (typeof val === 'number') {
          output += val;
        } else {
          output += this.toString(val);
        }
      }
    }

    if (!stmt.endsWithSeparator) {
      output += '\n';
    }

    this.output({ type: 'print', value: output });
  }

  private async execInput(stmt: InputStatement): Promise<void> {
    let prompt = stmt.prompt;
    if (!prompt) prompt = '? ';

    this.output({ type: 'input', value: prompt });

    const input = await this.inputCallback();
    const values = input.split(',').map(v => v.trim());

    for (let i = 0; i < stmt.variables.length; i++) {
      const varName = stmt.variables[i];
      const rawValue = values[i] || '';
      const isStringVar = varName.endsWith('$');

      if (isStringVar) {
        this.variables.set(varName, rawValue);
      } else {
        const num = parseFloat(rawValue);
        this.variables.set(varName, isNaN(num) ? 0 : num);
      }
    }
  }

  private execLet(stmt: LetStatement): void {
    const value = this.evalExpr(stmt.value);
    if (stmt.indices.length > 0) {
      if (!this.variables.has(stmt.name)) {
        throw new Error(`Variable ${stmt.name} not declared`);
      }
      const variable = this.variables.get(stmt.name);
      if (variable.dimensions) {
        this.setArrayElement(stmt.name, stmt.indices, value);
      } else {
        this.setStringChar(stmt.name, stmt.indices, value);
      }
    } else {
      this.variables.set(stmt.name, value);
    }
  }

  // Affecter un caractère à une position dans une chaîne
  private setStringChar(name: string, indexExprs: Expression[], value: unknown): void {
    const str = this.toString(this.variables.get(name) ?? '');
    const index = Math.floor(this.toNumber(this.evalExpr(indexExprs[0])));
    if (index < 1 || index > str.length) {
      throw new Error(`String index out of range: ${index} (valid: 1-${str.length})`);
    }
    const char = this.toString(value).charAt(0);
    const newStr = str.substring(0, index - 1) + char + str.substring(index);
    this.variables.set(name, newStr);
  }

  private async execIf(stmt: IfStatement): Promise<void> {
    const condition = this.evalExpr(stmt.condition);

    if (this.toBool(condition)) {
      for (const s of stmt.thenBranch) {
        if (!this.running) break;
        await this.executeStatement(s);
      }
    } else {
      for (const s of stmt.elseBranch) {
        if (!this.running) break;
        await this.executeStatement(s);
      }
    }
  }

  // Helper: find the pc of the first statement with the given line number
  private findPcByLine(targetLine: number): number {
    for (let i = 0; i < this.flatProgram.length; i++) {
      const stmt = this.flatProgram[i];
      if ((stmt as any).line === targetLine) {
        return i;
      }
    }
    return -1;
  }

  private execFor(stmt: ForStatement): void {
    let incrementVar = true;
    if (this.forStack.length === 0 ||
      this.forStack[this.forStack.length - 1].pc !== this.pc) {
      this.variables.set(stmt.variable, this.toNumber(this.evalExpr(stmt.start)));
      this.forStack.push({
        variable: stmt.variable,
        endValue: this.toNumber(this.evalExpr(stmt.end)),
        step: this.toNumber(this.evalExpr(stmt.step)),
        pc: this.pc,
      });
      incrementVar = false;
    }
    const { variable, endValue, step } = this.forStack[this.forStack.length - 1];
    let curValue = this.variables.get(variable) as number;
    if (incrementVar) {
      curValue += step;
      this.variables.set(variable, curValue);
    }
    if ((step > 0 && curValue > endValue) || (step < 0 && curValue < endValue)) {
      // Loop finished
      const nextPc = this.findNextPc(stmt.variable);
      if (nextPc !== -1) {
        this.pc = nextPc + 1;
      }
      this.forStack.pop();
      return;
    }
  }

  private execNext(stmt: NextStatement): void {
    if (this.forStack.length === 0) {
      throw new Error('NEXT without FOR');
    }
    const forInfo = this.forStack[this.forStack.length - 1];
    this.pc = forInfo.pc;

    // const varName = stmt.variable;

    // // Find matching FOR on stack
    // let forIdx = -1;
    // if (varName) {
    //   for (let i = this.forStack.length - 1; i >= 0; i--) {
    //     if (this.forStack[i].variable === varName) {
    //       forIdx = i;
    //       break;
    //     }
    //   }
    // } else {
    //   forIdx = this.forStack.length - 1;
    // }

    // if (forIdx === -1) {
    //   throw new Error('NEXT without FOR');
    // }

    // const forInfo = this.forStack[forIdx];
    // let currentVal = this.toNumber(this.variables.get(forInfo.variable)) + forInfo.step;
    // this.variables.set(forInfo.variable, currentVal);

    // if ((forInfo.step > 0 && currentVal <= forInfo.endValue) ||
    //   (forInfo.step < 0 && currentVal >= forInfo.endValue)) {
    //   // Loop continues - go back to statement after FOR
    //   this.pc = forInfo.pc;
    // } else {
    //   // Loop done - pop from stack, continue after NEXT
    //   this.forStack.splice(forIdx, 1);
    // }
  }

  private findNextPc(variable: string): number {
    for (let i = this.pc + 1; i < this.flatProgram.length; i++) {
      const s = this.flatProgram[i];
      if (s.type === 'Next') {
        const next = s as NextStatement;
        if (!next.variable || next.variable === variable) {
          return i;
        }
      }
    }
    return -1;
  }

  private execGoto(stmt: GotoStatement): void {
    const targetPc = this.findPcByLine(stmt.targetLine);
    if (targetPc === -1) {
      throw new Error(`Undefined line ${stmt.targetLine}`);
    }
    this.pc = targetPc;
  }

  private execGosub(stmt: GosubStatement): void {
    this.gosubStack.push({ pc: this.pc + 1 });
    const targetPc = this.findPcByLine(stmt.targetLine);
    if (targetPc === -1) {
      throw new Error(`Undefined line ${stmt.targetLine}`);
    }
    this.pc = targetPc;
  }

  private execReturn(_stmt: ReturnStatement): void {
    if (this.gosubStack.length === 0) {
      throw new Error('RETURN without GOSUB');
    }
    const info = this.gosubStack.pop()!;
    this.pc = info.pc;
  }

  private execWhile(stmt: WhileStatement): void {
    if (this.whileStack.length == 0 ||
      this.whileStack[this.whileStack.length - 1].pc !== this.pc) {
      this.whileStack.push({ pc: this.pc });
    }

    const condition = this.evalExpr(stmt.condition);
    if (!this.toBool(condition)) {
      // Skip to after WEND
      const wendPc = this.findWendPc();
      if (wendPc !== -1) {
        this.pc = wendPc + 1;
        this.whileStack.pop();
      }
    }
  }

  private execWend(_stmt: WendStatement): void {
    if (this.whileStack.length === 0) {
      throw new Error('WEND without WHILE');
    }
    const whileInfo = this.whileStack[this.whileStack.length - 1];

    // Re-evaluate the WHILE condition by going back to WHILE statement
    this.pc = whileInfo.pc;
  }

  private findWendPc(): number {
    let depth = 1;
    for (let i = this.pc + 1; i < this.flatProgram.length; i++) {
      const s = this.flatProgram[i];
      if (s.type === 'While') depth++;
      if (s.type === 'Wend') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  private async execSelect(stmt: SelectStatement): Promise<void> {
    const value = this.evalExpr(stmt.expression);
    let matched = false;

    for (const caseBlock of stmt.cases) {
      if (!matched && caseBlock.value !== null) {
        const caseValue = this.evalExpr(caseBlock.value);
        if (value === caseValue || this.toNumber(value) === this.toNumber(caseValue)) {
          matched = true;
        }
      }
      if (matched) {
        for (const s of caseBlock.statements) {
          if (!this.running) break;
          await this.executeStatement(s);
        }
      }
    }

    if (!matched && stmt.caseElse.length > 0) {
      for (const s of stmt.caseElse) {
        if (!this.running) break;
        await this.executeStatement(s);
      }
    }
  }

  private execDim(stmt: DimStatement): void {
    for (const dim of stmt.dimensions) {
      // In GW-BASIC, DIM A(5) creates A(0) to A(5), so size is bound + 1
      const bounds = dim.bounds.map(b => Math.floor(this.toNumber(this.evalExpr(b))));
      const totalSize = bounds.reduce((a, b) => a * b, 1);
      const isString = dim.name.endsWith('$');
      this.variables.set(dim.name, {
        dimensions: bounds,
        data: new Array(totalSize).fill(isString ? '' : 0),
      });
    }
  }

  private execRead(stmt: ReadStatement): void {
    for (const readVar of stmt.variables) {
      if (this.dataPointer >= this.dataValues.length) {
        throw new Error('Out of DATA');
      }
      const val = this.dataValues[this.dataPointer++];

      if (readVar.indices.length > 0) {
        // Array element assignment: READ A(I)
        this.setArrayElement(readVar.name, readVar.indices, val);
      } else {
        // Simple variable assignment: READ X
        const isStringVar = readVar.name.endsWith('$');
        if (isStringVar) {
          this.variables.set(readVar.name, String(val));
        } else {
          this.variables.set(readVar.name, typeof val === 'number' ? val : parseFloat(String(val)) || 0);
        }
      }
    }
  }

  private execSwap(stmt: SwapStatement): void {
    // Get value of var1
    let val1: unknown;
    if (stmt.var1.indices.length > 0) {
      val1 = this.getArrayElement(stmt.var1.name, stmt.var1.indices);
    } else {
      val1 = this.variables.get(stmt.var1.name) ?? 0;
    }

    // Get value of var2
    let val2: unknown;
    if (stmt.var2.indices.length > 0) {
      val2 = this.getArrayElement(stmt.var2.name, stmt.var2.indices);
    } else {
      val2 = this.variables.get(stmt.var2.name) ?? 0;
    }

    // Set var1 = old val2
    if (stmt.var1.indices.length > 0) {
      this.setArrayElement(stmt.var1.name, stmt.var1.indices, val2);
    } else {
      this.variables.set(stmt.var1.name, val2);
    }

    // Set var2 = old val1
    if (stmt.var2.indices.length > 0) {
      this.setArrayElement(stmt.var2.name, stmt.var2.indices, val1);
    } else {
      this.variables.set(stmt.var2.name, val1);
    }
  }

  private execRandomize(stmt: RandomizeStatement): void {
    if (stmt.seed) {
      const seed = this.toNumber(this.evalExpr(stmt.seed));
      // Simple seeded random
      this.lastRandom = (Math.sin(seed) * 10000) % 1;
      if (this.lastRandom < 0) this.lastRandom += 1;
    } else {
      this.lastRandom = Math.random();
    }
  }

  private execColor(stmt: ColorStatement): void {
    if (stmt.foreground) {
      this.foregroundColor = Math.floor(this.toNumber(this.evalExpr(stmt.foreground)));
    }
    if (stmt.background) {
      this.backgroundColor = Math.floor(this.toNumber(this.evalExpr(stmt.background)));
    }
    this.output({
      type: 'color',
      fg: this.foregroundColor,
      bg: this.backgroundColor,
    });
  }

  private execLocate(stmt: LocateStatement): void {
    if (stmt.row) {
      this.cursorRow = Math.floor(this.toNumber(this.evalExpr(stmt.row)));
    }
    if (stmt.col) {
      this.cursorCol = Math.floor(this.toNumber(this.evalExpr(stmt.col)));
    }
    this.output({
      type: 'locate',
      row: this.cursorRow,
      col: this.cursorCol,
    });
  }

  private execScreen(stmt: ScreenStatement): void {
    this.screenMode = Math.floor(this.toNumber(this.evalExpr(stmt.mode)));
    this.output({ type: 'screen', mode: this.screenMode });
  }

  private execPset(stmt: PsetStatement): void {
    const x = Math.floor(this.toNumber(this.evalExpr(stmt.x)));
    const y = Math.floor(this.toNumber(this.evalExpr(stmt.y)));
    const color = stmt.color ? Math.floor(this.toNumber(this.evalExpr(stmt.color))) : this.foregroundColor;
    this.output({
      type: 'graphics',
      graphicsCommand: { type: 'pset', x1: x, y1: y, color },
    });
  }

  private execLine(stmt: LineStatement): void {
    const x1 = Math.floor(this.toNumber(this.evalExpr(stmt.x1)));
    const y1 = Math.floor(this.toNumber(this.evalExpr(stmt.y1)));
    const x2 = Math.floor(this.toNumber(this.evalExpr(stmt.x2)));
    const y2 = Math.floor(this.toNumber(this.evalExpr(stmt.y2)));
    const color = stmt.color ? Math.floor(this.toNumber(this.evalExpr(stmt.color))) : this.foregroundColor;
    this.output({
      type: 'graphics',
      graphicsCommand: { type: 'line', x1, y1, x2, y2, color, style: stmt.style },
    });
  }

  private execCircle(stmt: CircleStatement): void {
    const x = Math.floor(this.toNumber(this.evalExpr(stmt.x)));
    const y = Math.floor(this.toNumber(this.evalExpr(stmt.y)));
    const radius = Math.floor(this.toNumber(this.evalExpr(stmt.radius)));
    const color = stmt.color ? Math.floor(this.toNumber(this.evalExpr(stmt.color))) : this.foregroundColor;
    const start = stmt.start ? this.toNumber(this.evalExpr(stmt.start)) : 0;
    const end = stmt.end ? this.toNumber(this.evalExpr(stmt.end)) : 2 * Math.PI;
    const aspect = stmt.aspect ? this.toNumber(this.evalExpr(stmt.aspect)) : 1;
    this.output({
      type: 'graphics',
      graphicsCommand: { type: 'circle', x1: x, y1: y, radius, color, style: `${start},${end},${aspect}` },
    });
  }

  private execDraw(stmt: DrawStatement): void {
    const commands = this.toString(this.evalExpr(stmt.command));
    this.output({
      type: 'graphics',
      graphicsCommand: { type: 'draw', commands },
    });
  }

  private execPaint(stmt: PaintStatement): void {
    const x = Math.floor(this.toNumber(this.evalExpr(stmt.x)));
    const y = Math.floor(this.toNumber(this.evalExpr(stmt.y)));
    const color = stmt.color ? Math.floor(this.toNumber(this.evalExpr(stmt.color))) : this.foregroundColor;
    const border = stmt.border ? Math.floor(this.toNumber(this.evalExpr(stmt.border))) : this.foregroundColor;
    this.output({
      type: 'graphics',
      graphicsCommand: { type: 'paint', x1: x, y1: y, color, borderColor: border },
    });
  }

  private execSound(stmt: SoundStatement): void {
    // BEEP for any sound in browser
    this.output({ type: 'beep' });
  }

  private execOnGoto(stmt: OnGotoStatement): void {
    const val = Math.floor(this.toNumber(this.evalExpr(stmt.expression)));
    if (val >= 1 && val <= stmt.lines.length) {
      const targetLine = stmt.lines[val - 1];
      this.execGoto({ type: 'Goto', targetLine } as GotoStatement);
    }
  }

  private async execOnGosub(stmt: OnGosubStatement): Promise<void> {
    const val = Math.floor(this.toNumber(this.evalExpr(stmt.expression)));
    if (val >= 1 && val <= stmt.lines.length) {
      const targetLine = stmt.lines[val - 1];
      this.execGosub({ type: 'Gosub', targetLine } as GosubStatement);
    }
  }

  private execMidAssign(stmt: MidAssignStatement): void {
    const currentStr = this.toString(this.getVariable({ type: 'VariableRef', name: stmt.variable, indices: stmt.indices } as any));
    const pos = Math.floor(this.toNumber(this.evalExpr(stmt.position))) - 1; // BASIC is 1-indexed
    const len = Math.floor(this.toNumber(this.evalExpr(stmt.length)));
    const replacement = this.toString(this.evalExpr(stmt.value));

    // Ensure pos is within bounds
    const start = Math.max(0, Math.min(pos, currentStr.length));
    const end = Math.min(currentStr.length, start + len);

    // Build the new string: before + replacement + after
    const before = currentStr.substring(0, start);
    const after = currentStr.substring(end);
    const newStr = before + replacement + after;

    if (stmt.indices.length > 0) {
      this.setArrayElement(stmt.variable, stmt.indices, newStr);
    } else {
      this.variables.set(stmt.variable, newStr);
    }
  }

  private execCall(stmt: CallStatement): void {
    const args = stmt.args.map(a => this.evalExpr(a));

    switch (stmt.subName) {
      case 'SORT': {
        // CALL SORT(arr, d, f) - sort elements between indices d and f (exclusive) in ascending order
        if (args.length < 3) {
          throw new Error('CALL SORT requires 3 arguments: array, start, end');
        }
        const arrName = (stmt.args[0] as VariableRef).name;
        const d = Math.floor(this.toNumber(args[1]));
        const f = Math.floor(this.toNumber(args[2]));
        if (!this.variables.has(arrName)) {
          throw new Error(`Array ${arrName} not declared`);
        }
        const arr = this.variables.get(arrName);
        if (!arr.dimensions) {
          throw new Error(`${arrName} is not an array`);
        }
        // Extract the subarray from d to f (exclusive)
        const subArray: number[] = [];
        for (let i = d; i < f; i++) {
          const idxExpr = { type: 'NumberLiteral', value: i } as any;
          subArray.push(this.toNumber(this.getArrayElement(arrName, [idxExpr])));
        }
        // Sort the subarray
        subArray.sort((a, b) => a - b);
        // Write back
        for (let i = d; i < f; i++) {
          const idxExpr = { type: 'NumberLiteral', value: i } as any;
          this.setArrayElement(arrName, [idxExpr], subArray[i - d]);
        }
        break;
      }
      case 'INVERT': {
        // CALL INVERT(arr, d, f) - invert elements between indices d and f (exclusive)
        if (args.length < 3) {
          throw new Error('CALL INVERT requires 3 arguments: array, start, end');
        }
        const arrName = (stmt.args[0] as VariableRef).name;
        const d = Math.floor(this.toNumber(args[1]));
        const f = Math.floor(this.toNumber(args[2]));
        if (!this.variables.has(arrName)) {
          throw new Error(`Array ${arrName} not declared`);
        }
        const arr = this.variables.get(arrName);
        if (!arr.dimensions) {
          throw new Error(`${arrName} is not an array`);
        }
        // Invert elements between d and f (exclusive)
        let left = d;
        let right = f - 1;
        while (left < right) {
          const leftExpr = { type: 'NumberLiteral', value: left } as any;
          const rightExpr = { type: 'NumberLiteral', value: right } as any;
          const temp = this.getArrayElement(arrName, [leftExpr]);
          this.setArrayElement(arrName, [leftExpr], this.getArrayElement(arrName, [rightExpr]));
          this.setArrayElement(arrName, [rightExpr], temp);
          left++;
          right--;
        }
        break;
      }
      default:
        throw new Error(`Unknown CALL subroutine: ${stmt.subName}`);
    }
  }

  private execDefFn(stmt: DefFnStatement): void {
    this.customFunctions.set(stmt.fnName, {
      paramName: stmt.paramName,
      expression: stmt.expression,
    });
  }

  private execOnError(stmt: OnErrorStatement): void {
    this.errorHandlerLine = stmt.targetLine;
  }

  private execResume(stmt: ResumeStatement): void {
    if (this.lastErrorLine === null) {
      throw new Error('RESUME without ON ERROR');
    }
    if (stmt.resumeType === 'NEXT') {
      // RESUME NEXT: continue with statement after the error
      this.pc = this.findPcByLine(this.lastErrorLine);
      if (this.pc === -1) {
        throw new Error(`Undefined error line ${this.lastErrorLine}`);
      }
      this.pc++; // skip past the error line
      // Skip to next line (after all statements on the error line)
      const currentLine = this.lastErrorLine;
      while (this.pc < this.flatProgram.length && (this.flatProgram[this.pc] as any).line === currentLine) {
        this.pc++;
      }
    } else {
      // RESUME: retry the line that caused the error
      this.pc = this.findPcByLine(this.lastErrorLine);
      if (this.pc === -1) {
        throw new Error(`Undefined error line ${this.lastErrorLine}`);
      }
    }
    // Keep error handler active
    this.lastErrorLine = null;
  }

  private execRenum(_stmt: RenumStatement): void {
    const startLine = _stmt.startLine || 10;
    const step = _stmt.step || 10;
    const newLineNumbers: number[] = [];
    let currentNewLine = startLine;

    // Create new line numbers
    for (let i = 0; i < this.lineNumbers.length; i++) {
      newLineNumbers.push(currentNewLine);
      currentNewLine += step;
    }

    // Rebuild program with new line numbers
    const newProgram = new Map<number, Statement[]>();
    const newSourceLines = new Map<number, string>();
    const newFlatProgram: Statement[] = [];

    for (let i = 0; i < this.lineNumbers.length; i++) {
      const oldLineNum = this.lineNumbers[i];
      const newLineNum = newLineNumbers[i];
      const stmts = this.program.get(oldLineNum);
      if (stmts) {
        newProgram.set(newLineNum, stmts);
        const src = this.sourceLines.get(oldLineNum);
        if (src) {
          newSourceLines.set(newLineNum, src);
        }
        for (const stmt of stmts) {
          (stmt as any).line = newLineNum;
          newFlatProgram.push(stmt);
        }
      }
    }

    this.program = newProgram;
    this.sourceLines = newSourceLines;
    this.flatProgram = newFlatProgram;
    this.lineNumbers = Array.from(this.program.keys()).sort((a, b) => a - b);
  }

  private output(out: InterpreterOutput): void {
    this.outputCallback(out);
  }

  // Execute a direct command (no line number)
  async executeDirect(source: string): Promise<void> {
    const upper = source.trim().toUpperCase();

    if (upper === 'RUN') {
      await this.run();
      return;
    }
    if (upper === 'LIST') {
      const listing = this.list();
      this.output({ type: 'print', value: listing + '\n' });
      return;
    }
    if (upper === 'NEW') {
      this.program.clear();
      this.lineNumbers = [];
      this.sourceLines.clear();
      this.reset();
      this.output({ type: 'print', value: '\n' });
      return;
    }
    if (upper === 'CLS') {
      this.output({ type: 'clear' });
      return;
    }
    if (upper === 'CONT') {
      await this.cont();
      return;
    }
    if (upper === 'SYSTEM') {
      this.output({ type: 'info', value: 'Cannot exit browser environment.\n' });
      return;
    }
    if (upper.startsWith('RENUM')) {
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const stmts = parser.parseProgram();
      for (const stmt of stmts) {
        if (stmt.type === 'Renum') {
          this.execRenum(stmt as any);
        }
      }
      return;
    }

    // Try to execute as a statement
    try {
      const lexer = new Lexer(source);
      let flatAst: Statement[];

      try {
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        flatAst = parser.parseProgram();
      } catch (e: unknown) {
        const err = e as Error;
        if (err.message.startsWith('Unterminated string') ||
          err.message.startsWith('Expected')) {
          throw err;
        }
        throw new Error(`Syntax error: ${err.message}`);
      }

      if (flatAst.length > 0 && (flatAst[0] as any).line !== undefined) {
        // It was a numbered line - add to program
        // Vérifier l'unicité des numéros de ligne
        const seenLineNumbers = new Set<number>();
        let currentLineNum: number | undefined = undefined;

        for (const stmt of flatAst) {
          const lineNum = (stmt as any).line;
          if (lineNum !== undefined) {
            if (lineNum !== currentLineNum) {
              if (seenLineNumbers.has(lineNum)) {
                throw new Error(`Duplicate line number ${lineNum}`);
              }
              // Vérifier aussi que le numéro n'existe pas déjà dans le programme chargé
              if (this.program.has(lineNum)) {
                throw new Error(`Duplicate line number ${lineNum}`);
              }
              seenLineNumbers.add(lineNum);
              currentLineNum = lineNum;
            }
          }
        }

        // Ajouter les nouvelles lignes dans program
        currentLineNum = undefined;
        let currentStmts: Statement[] = [];

        for (const stmt of flatAst) {
          const lineNum = (stmt as any).line;
          if (lineNum !== undefined) {
            if (lineNum !== currentLineNum) {
              if (currentLineNum !== undefined) {
                this.program.set(currentLineNum, currentStmts);
              }
              currentLineNum = lineNum;
              currentStmts = [stmt];
            } else {
              currentStmts.push(stmt);
            }
          }
        }
        if (currentLineNum !== undefined) {
          this.program.set(currentLineNum, currentStmts);
          const match = source.trim().match(/^\d+\s+(.*)$/);
          if (match) {
            this.sourceLines.set(currentLineNum, match[1]);
          }
        }

        // Reconstruire flatProgram
        this.flatProgram = [];
        for (const [, stmts] of this.program) {
          for (const stmt of stmts) {
            this.flatProgram.push(stmt);
          }
        }

        this.lineNumbers = Array.from(this.program.keys()).sort((a, b) => a - b);
        this.collectData();
      } else {
        // Direct statement
        const allTokens = lexer.tokenize();
        const p = new Parser(allTokens);
        const tempFlatAst = p.parseProgram();
        // Try parsing without line numbers as a single statement
        const tempLexer = new Lexer(source);
        const tempTokens = tempLexer.tokenize();
        const tempParser = new Parser(tempTokens);
        const stmts = tempParser.parseLineStatements();

        for (const stmt of stmts) {
          await this.executeStatement(stmt);
        }
      }
    } catch (e: unknown) {
      const err = e as Error;
      this.output({ type: 'error', value: `Error: ${err.message} at line ${this.currentLineNum}\n` });
    }
  }

  getSource(): string {
    return this.list();
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Retourne la position physique (1-indexée) d'une ligne GW-BASIC dans le source */
  getPhysicalLine(gwLineNum: number): number {
    return this.lineNumberMap.get(gwLineNum) ?? -1;
  }

  // === STEP MODE SUPPORT ===

  setStepMode(enable: boolean): void {
    this.stepMode = enable;
  }

  setStepCallback(callback: StepCallback): void {
    this.stepCallback = callback;
  }

  /** Resolves the current step pause, allowing one statement to execute */
  stepForward(): void {
    if (this.stepResolve) {
      const resolve = this.stepResolve;
      this.stepResolve = null;
      resolve();
    }
  }

  /** Called after each statement in step mode to pause execution */
  private async stepPause(): Promise<void> {
    if (this.stepMode && this.stepCallback) {
      this.stepCallback(this.currentLineNum);
      return new Promise<void>((resolve) => {
        this.stepResolve = resolve;
      });
    }
  }

  // === BREAKPOINT SUPPORT ===

  setBreakpoint(lineNum: number): void {
    this.breakpoints.add(lineNum);
  }

  removeBreakpoint(lineNum: number): void {
    this.breakpoints.delete(lineNum);
  }

  toggleBreakpoint(lineNum: number): void {
    if (this.breakpoints.has(lineNum)) {
      this.breakpoints.delete(lineNum);
    } else {
      this.breakpoints.add(lineNum);
    }
  }

  hasBreakpoint(lineNum: number): boolean {
    return this.breakpoints.has(lineNum);
  }

  clearBreakpoints(): void {
    this.breakpoints.clear();
  }

  setRunToBreakpoint(enable: boolean): void {
    this.runToBreakpoint = enable;
    if (enable) {
      this.skipNextBreakpointCheck = true;
    }
  }

  /** Check if current line has a breakpoint and pause if needed */
  private async checkBreakpoint(): Promise<void> {
    // Skip the first check after activating runToBreakpoint to avoid
    // immediately re-pausing on the same line we were already on
    if (this.skipNextBreakpointCheck) {
      this.skipNextBreakpointCheck = false;
      return;
    }
    if (this.runToBreakpoint && this.breakpoints.has(this.currentLineNum)) {
      this.runToBreakpoint = false;
      this.skipNextBreakpointCheck = false;
      this.stepMode = true; // Enable step mode to pause at breakpoint
      if (this.stepCallback) {
        this.stepCallback(this.currentLineNum);
        return new Promise<void>((resolve) => {
          this.stepResolve = resolve;
        });
      }
    }
  }
}
