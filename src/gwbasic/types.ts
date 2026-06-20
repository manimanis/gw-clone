// GW-BASIC Interpreter Type Definitions

export enum TokenType {
  // Literals
  Number,
  String,
  // Identifiers
  Identifier,
  // Keywords
  PRINT, INPUT, LET, IF, THEN, ELSE, ELSEIF, END_IF,
  FOR, TO, STEP, NEXT, GOTO, GOSUB, RETURN,
  WHILE, WEND, SELECT, CASE, END_SELECT,
  DIM, REM, DATA, READ, RESTORE,
  CLS, END, STOP, SYSTEM, NEW, LIST, RUN, CONT,
  AND, OR, NOT, XOR, MOD,
  LINE, CIRCLE, PSET, PRESET, DRAW, PAINT, SCREEN, COLOR, LOCATE,
  BEEP, SOUND, PLAY,
  DEF, FN, SUB, FUNCTION, CALL,
  OPEN, CLOSE, WRITE, GET, PUT,
  ON, ERROR, RESUME,
  SWAP, RANDOMIZE, TIMER,
  INKEY, CHR_DOLLAR, STR_DOLLAR, VAL, ASC_FUNC,
  LEN_FUNC, LEFT_DOLLAR, RIGHT_DOLLAR, MID_DOLLAR,
  TAB_FUNC, SPC_FUNC, STRING_DOLLAR, SPACE_DOLLAR,
  INSTR_FUNC, UCASE_DOLLAR, LCASE_DOLLAR,
  ABS_FUNC, INT_FUNC, RND_FUNC, SQR_FUNC,
  SIN_FUNC, COS_FUNC, TAN_FUNC, ATN_FUNC,
  LOG_FUNC, EXP_FUNC, SGN_FUNC, FIX_FUNC,
  PEEK_FUNC, POKE,
  // Operators
  Plus, Minus, Star, Slash, BackSlash, Caret,
  Eq, Ne, Lt, Gt, Le, Ge,
  // Punctuation
  LParen, RParen, Comma, Semicolon, Colon,
  // Special
  Eol, Eof,
}

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
  line: number;
}

export interface GosubStatement extends ASTNode {
  type: 'Gosub';
  line: number;
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
