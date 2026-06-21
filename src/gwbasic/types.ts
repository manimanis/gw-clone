// GW-BASIC Interpreter Type Definitions

export const TokenType = {
  // Literals
  Number: 0,
  String: 1,
  // Identifiers
  Identifier: 2,
  // Keywords
  PRINT: 3, INPUT: 4, LET: 5, IF: 6, THEN: 7, ELSE: 8, ELSEIF: 9, END_IF: 10,
  FOR: 11, TO: 12, STEP: 13, NEXT: 14, GOTO: 15, GOSUB: 16, RETURN: 17,
  WHILE: 18, WEND: 19, SELECT: 20, CASE: 21, END_SELECT: 22,
  DIM: 23, REM: 24, DATA: 25, READ: 26, RESTORE: 27,
  CLS: 28, END: 29, STOP: 30, SYSTEM: 31, NEW: 32, LIST: 33, RUN: 34, CONT: 35,
  AND: 36, OR: 37, NOT: 38, XOR: 39, MOD: 40,
  LINE: 41, CIRCLE: 42, PSET: 43, PRESET: 44, DRAW: 45, PAINT: 46, SCREEN: 47, COLOR: 48, LOCATE: 49,
  BEEP: 50, SOUND: 51, PLAY: 52,
  DEF: 53, FN: 54, SUB: 55, FUNCTION: 56, CALL: 57,
  OPEN: 58, CLOSE: 59, WRITE: 60, GET: 61, PUT: 62,
  ON: 63, ERROR: 64, RESUME: 65,
  SWAP: 66, RANDOMIZE: 67, TIMER: 68,
  INKEY: 69, CHR_DOLLAR: 70, STR_DOLLAR: 71, VAL: 72, ASC_FUNC: 73,
  LEN_FUNC: 74, LEFT_DOLLAR: 75, RIGHT_DOLLAR: 76, MID_DOLLAR: 77,
  TAB_FUNC: 78, SPC_FUNC: 79, STRING_DOLLAR: 80, SPACE_DOLLAR: 81,
  INSTR_FUNC: 82, UCASE_DOLLAR: 83, LCASE_DOLLAR: 84,
  ABS_FUNC: 85, INT_FUNC: 86, RND_FUNC: 87, SQR_FUNC: 88,
  SIN_FUNC: 89, COS_FUNC: 90, TAN_FUNC: 91, ATN_FUNC: 92,
  LOG_FUNC: 93, EXP_FUNC: 94, SGN_FUNC: 95, FIX_FUNC: 96,
  PEEK_FUNC: 97, POKE: 98,
  // Date functions
  MKDATE_FUNC: 118, YEAR_FUNC: 119, MONTH_FUNC: 120, DAY_FUNC: 121,
  DAYW_FUNC: 122, HOUR_FUNC: 123, MINUTE_FUNC: 124, SECONDS_FUNC: 125,
  DATESTR_DOLLAR: 126, TODATE_FUNC: 127,
  // Operators
  Plus: 99, Minus: 100, Star: 101, Slash: 102, BackSlash: 103, Caret: 104,
  Eq: 105, Ne: 106, Lt: 107, Gt: 108, Le: 109, Ge: 110,
  // Punctuation
  LParen: 111, RParen: 112, Comma: 113, Semicolon: 114, Colon: 115,
  // Special
  Eol: 116, Eof: 117,
} as const;

export type TokenType = typeof TokenType[keyof typeof TokenType];

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

export interface LineInfo {
  lineNumber: number;
  text: string;
  tokens: Token[];
}

export interface ASTNode {
  type: string;
  [key: string]: unknown;
}

// Expression nodes
export interface NumberLiteral extends ASTNode {
  type: 'NumberLiteral';
  value: number;
}

export interface StringLiteral extends ASTNode {
  type: 'StringLiteral';
  value: string;
}

export interface VariableRef extends ASTNode {
  type: 'VariableRef';
  name: string;
  indices: Expression[];
}

export interface BinaryOp extends ASTNode {
  type: 'BinaryOp';
  op: string;
  left: Expression;
  right: Expression;
}

export interface UnaryOp extends ASTNode {
  type: 'UnaryOp';
  op: string;
  operand: Expression;
}

export interface FunctionCall extends ASTNode {
  type: 'FunctionCall';
  name: string;
  args: Expression[];
}

export type Expression = NumberLiteral | StringLiteral | VariableRef | BinaryOp | UnaryOp | FunctionCall;

// Statement nodes
export interface PrintStatement extends ASTNode {
  type: 'Print';
  items: (Expression | string)[];  // string = ";" or ","
  endsWithSeparator: boolean;
}

export interface InputStatement extends ASTNode {
  type: 'Input';
  prompt: string;
  variables: string[];
}

export interface LetStatement extends ASTNode {
  type: 'Let';
  name: string;
  indices: Expression[];
  value: Expression;
}

export interface IfStatement extends ASTNode {
  type: 'If';
  condition: Expression;
  thenBranch: Statement[];
  elseBranch: Statement[];
  thenLine?: number;
  elseLine?: number;
}

export interface ForStatement extends ASTNode {
  type: 'For';
  variable: string;
  start: Expression;
  end: Expression;
  step: Expression;
}

export interface NextStatement extends ASTNode {
  type: 'Next';
  variable: string;
}

export interface GotoStatement extends ASTNode {
  type: 'Goto';
  targetLine: number;
}

export interface GosubStatement extends ASTNode {
  type: 'Gosub';
  targetLine: number;
}

export interface ReturnStatement extends ASTNode {
  type: 'Return';
}

export interface WhileStatement extends ASTNode {
  type: 'While';
  condition: Expression;
}

export interface WendStatement extends ASTNode {
  type: 'Wend';
}

export interface SelectStatement extends ASTNode {
  type: 'Select';
  expression: Expression;
  cases: CaseBlock[];
  caseElse: Statement[];
}

export interface CaseBlock {
  value: Expression | null; // null for CASE ELSE
  statements: Statement[];
}

export interface DimStatement extends ASTNode {
  type: 'Dim';
  dimensions: { name: string; bounds: Expression[] }[];
}

export interface ReadStatement extends ASTNode {
  type: 'Read';
  variables: string[];
}

export interface DataStatement extends ASTNode {
  type: 'Data';
  values: (number | string)[];
}

export interface RestoreStatement extends ASTNode {
  type: 'Restore';
}

export interface RemStatement extends ASTNode {
  type: 'Rem';
  text: string;
}

export interface ClsStatement extends ASTNode {
  type: 'Cls';
}

export interface EndStatement extends ASTNode {
  type: 'End';
}

export interface StopStatement extends ASTNode {
  type: 'Stop';
}

export interface SwapStatement extends ASTNode {
  type: 'Swap';
  var1: { name: string; indices: Expression[] };
  var2: { name: string; indices: Expression[] };
}

export interface RandomizeStatement extends ASTNode {
  type: 'Randomize';
  seed?: Expression;
}

export interface ColorStatement extends ASTNode {
  type: 'Color';
  foreground?: Expression;
  background?: Expression;
}

export interface LocateStatement extends ASTNode {
  type: 'Locate';
  row?: Expression;
  col?: Expression;
}

export interface ScreenStatement extends ASTNode {
  type: 'Screen';
  mode: Expression;
}

export interface PsetStatement extends ASTNode {
  type: 'Pset';
  x: Expression;
  y: Expression;
  color?: Expression;
}

export interface LineStatement extends ASTNode {
  type: 'Line';
  x1: Expression;
  y1: Expression;
  x2: Expression;
  y2: Expression;
  color?: Expression;
  style?: string; // 'B' for box, 'BF' for filled box
}

export interface CircleStatement extends ASTNode {
  type: 'Circle';
  x: Expression;
  y: Expression;
  radius: Expression;
  color?: Expression;
  start?: Expression;
  end?: Expression;
  aspect?: Expression;
}

export interface DrawStatement extends ASTNode {
  type: 'Draw';
  command: Expression;
}

export interface PaintStatement extends ASTNode {
  type: 'Paint';
  x: Expression;
  y: Expression;
  color?: Expression;
  border?: Expression;
}

export interface BeepStatement extends ASTNode {
  type: 'Beep';
}

export interface SoundStatement extends ASTNode {
  type: 'Sound';
  frequency: Expression;
  duration: Expression;
}

export interface PokeStatement extends ASTNode {
  type: 'Poke';
  address: Expression;
  value: Expression;
}

export interface OnGotoStatement extends ASTNode {
  type: 'OnGoto';
  expression: Expression;
  lines: number[];
}

export interface OnGosubStatement extends ASTNode {
  type: 'OnGosub';
  expression: Expression;
  lines: number[];
}

export interface MidAssignStatement extends ASTNode {
  type: 'MidAssign';
  variable: string;
  indices: Expression[];
  position: Expression;
  length: Expression;
  value: Expression;
}

export interface MultiStatement extends ASTNode {
  type: 'Multi';
  statements: Statement[];
}

export type Statement =
  | PrintStatement
  | InputStatement
  | LetStatement
  | IfStatement
  | ForStatement
  | NextStatement
  | GotoStatement
  | GosubStatement
  | ReturnStatement
  | WhileStatement
  | WendStatement
  | SelectStatement
  | DimStatement
  | ReadStatement
  | DataStatement
  | RestoreStatement
  | RemStatement
  | ClsStatement
  | EndStatement
  | StopStatement
  | SwapStatement
  | RandomizeStatement
  | ColorStatement
  | LocateStatement
  | ScreenStatement
  | PsetStatement
  | LineStatement
  | CircleStatement
  | DrawStatement
  | PaintStatement
  | BeepStatement
  | SoundStatement
  | PokeStatement
  | OnGotoStatement
  | OnGosubStatement
  | MidAssignStatement
  | MultiStatement;

// Interpreter state
export interface ForLoopInfo {
  variable: string;
  endValue: number;
  step: number;
  lineIndex: number;
}

export interface GosubInfo {
  lineIndex: number;
}

export interface WhileInfo {
  lineIndex: number;
}

export interface InterpreterState {
  variables: Map<string, unknown>;
  arrays: Map<string, { dimensions: number[]; data: unknown[] }>;
  program: Map<number, Statement[]>;
  lineNumbers: number[];
  dataPointer: number;
  dataValues: (number | string)[];
  forStack: ForLoopInfo[];
  gosubStack: GosubInfo[];
  whileStack: WhileInfo[];
  selectStack: { value: unknown; matched: boolean }[];
  running: boolean;
  stopped: boolean;
  currentLineIndex: number;
  screenMode: number;
  foregroundColor: number;
  backgroundColor: number;
  cursorRow: number;
  cursorCol: number;
  lastRandom: number;
}

export interface InterpreterOutput {
  type: 'print' | 'input' | 'error' | 'clear' | 'color' | 'locate' | 'screen' | 'graphics' | 'beep' | 'info';
  value?: string;
  row?: number;
  col?: number;
  fg?: number;
  bg?: number;
  mode?: number;
  graphicsCommand?: GraphicsCommand;
}

export interface GraphicsCommand {
  type: 'pset' | 'line' | 'circle' | 'draw' | 'paint' | 'cls';
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  radius?: number;
  color?: number;
  style?: string;
  commands?: string;
  borderColor?: number;
}
