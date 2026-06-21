// GW-BASIC Interpreter / Executor

import type {
  Expression, NumberLiteral, StringLiteral, VariableRef, BinaryOp, UnaryOp, FunctionCall,
  Statement, PrintStatement, InputStatement, LetStatement, IfStatement,
  ForStatement, NextStatement, GotoStatement, GosubStatement, ReturnStatement,
  WhileStatement, WendStatement, SelectStatement, DimStatement, ReadStatement,
  DataStatement, RestoreStatement, RemStatement, ClsStatement, EndStatement,
  StopStatement, SwapStatement, RandomizeStatement, ColorStatement, LocateStatement,
  ScreenStatement, PsetStatement, LineStatement, CircleStatement, DrawStatement,
  PaintStatement, BeepStatement, SoundStatement, PokeStatement,
  OnGotoStatement, OnGosubStatement, MidAssignStatement,
  InterpreterOutput, GraphicsCommand, ASTNode,
} from './types';
import { Lexer } from './lexer';
import { Parser } from './parser';

export type OutputCallback = (output: InterpreterOutput) => void;
export type InputCallback = () => Promise<string>;

export class GWBasicInterpreter {
  private variables: Map<string, unknown> = new Map();
  private arrays: Map<string, { dimensions: number[]; data: unknown[] }> = new Map();
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

  private outputCallback: OutputCallback;
  private inputCallback: InputCallback;

  constructor(outputCallback: OutputCallback, inputCallback: InputCallback) {
    this.outputCallback = outputCallback;
    this.inputCallback = inputCallback;
    this.lastRandom = Math.random();
  }

  // Load a program from source text
  loadProgram(source: string): void {
    this.sourceLines.clear();
    const lines = source.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*(\d+)\s+(.*)$/);
      if (match) {
        this.sourceLines.set(parseInt(match[1]), match[2]);
      }
    }

    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const flatAst = parser.parseProgram();
    this.flatProgram = flatAst;
    // Convert flat array back to Map<number, Statement[]> for internal use
    this.program = new Map();
    for (const stmt of flatAst) {
      const lineNum = (stmt as any).line;
      if (lineNum !== undefined) {
        const existing = this.program.get(lineNum) || [];
        existing.push(stmt);
        this.program.set(lineNum, existing);
      }
    }
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
      }
    }

    this.collectData();
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
    if (source) {
      this.loadProgram(source);
    }

    this.reset();
    this.running = true;
    this.stopped = false;
    this.pc = 0;

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
    this.arrays.clear();
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

  private getVariable(ref: VariableRef): unknown {
    if (ref.indices.length > 0) {
      return this.getArrayElement(ref.name, ref.indices);
    }
    return this.variables.get(ref.name) ?? 0;
  }

  private getArrayElement(name: string, indexExprs: Expression[]): unknown {
    const arr = this.arrays.get(name);
    if (!arr) return 0;

    const indices = indexExprs.map(e => Math.floor(this.toNumber(this.evalExpr(e))));
    let flatIndex = 0;
    let multiplier = 1;
    for (let i = arr.dimensions.length - 1; i >= 0; i--) {
      flatIndex += indices[i] * multiplier;
      multiplier *= arr.dimensions[i];
    }

    if (flatIndex < 0 || flatIndex >= arr.data.length) return 0;
    return arr.data[flatIndex];
  }

  private setArrayElement(name: string, indexExprs: Expression[], value: unknown): void {
    let arr = this.arrays.get(name);
    if (!arr) {
      // Auto-dimension with size 11 (0-10) per dimension
      const dims = indexExprs.map(() => 11);
      const totalSize = dims.reduce((a, b) => a * b, 1);
      arr = { dimensions: dims, data: new Array(totalSize).fill(0) };
      this.arrays.set(name, arr);
    }

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

    switch (func.name) {
      case 'ABS': return Math.abs(this.toNumber(args[0]));
      case 'INT': return Math.floor(this.toNumber(args[0]));
      case 'FIX': return Math.trunc(this.toNumber(args[0]));
      case 'SQR': return Math.sqrt(this.toNumber(args[0]));
      case 'SIN': return Math.sin(this.toNumber(args[0]));
      case 'COS': return Math.cos(this.toNumber(args[0]));
      case 'TAN': return Math.tan(this.toNumber(args[0]));
      case 'ATN': return Math.atan(this.toNumber(args[0]));
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
      default: return 0;
    }
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
      this.setArrayElement(stmt.name, stmt.indices, value);
    } else {
      this.variables.set(stmt.name, value);
    }
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
      const bounds = dim.bounds.map(b => Math.floor(this.toNumber(this.evalExpr(b))) + 1); // +1 for 0-based
      const totalSize = bounds.reduce((a, b) => a * b, 1);
      const isString = dim.name.endsWith('$');
      this.arrays.set(dim.name, {
        dimensions: bounds,
        data: new Array(totalSize).fill(isString ? '' : 0),
      });
    }
  }

  private execRead(stmt: ReadStatement): void {
    for (const varName of stmt.variables) {
      if (this.dataPointer >= this.dataValues.length) {
        throw new Error('Out of DATA');
      }
      const val = this.dataValues[this.dataPointer++];
      const isStringVar = varName.endsWith('$');

      if (isStringVar) {
        this.variables.set(varName, String(val));
      } else {
        this.variables.set(varName, typeof val === 'number' ? val : parseFloat(String(val)) || 0);
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

    // Try to execute as a statement
    try {
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const flatAst = parser.parseProgram();

      if (flatAst.length > 0 && (flatAst[0] as any).line !== undefined) {
        // It was a numbered line - add to program
        for (const stmt of flatAst) {
          const lineNum = (stmt as any).line;
          if (lineNum !== undefined) {
            const existing = this.program.get(lineNum) || [];
            existing.push(stmt);
            this.program.set(lineNum, existing);
            const match = source.trim().match(/^\d+\s+(.*)$/);
            if (match) {
              this.sourceLines.set(lineNum, match[1]);
            }
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
}