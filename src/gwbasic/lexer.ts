// GW-BASIC Lexer / Tokenizer

import { TokenType } from './types';
import type { Token } from './types';

const KEYWORDS: Record<string, TokenType> = {
  'PRINT': TokenType.PRINT,
  '?': TokenType.PRINT,
  'INPUT': TokenType.INPUT,
  'LET': TokenType.LET,
  'IF': TokenType.IF,
  'THEN': TokenType.THEN,
  'ELSE': TokenType.ELSE,
  'ELSEIF': TokenType.ELSEIF,
  'END': TokenType.END,
  'ENDIF': TokenType.END_IF,
  'FOR': TokenType.FOR,
  'TO': TokenType.TO,
  'STEP': TokenType.STEP,
  'NEXT': TokenType.NEXT,
  'GOTO': TokenType.GOTO,
  'GO': TokenType.GOTO,
  'GOSUB': TokenType.GOSUB,
  'RETURN': TokenType.RETURN,
  'WHILE': TokenType.WHILE,
  'WEND': TokenType.WEND,
  'SELECT': TokenType.SELECT,
  'CASE': TokenType.CASE,
  'DIM': TokenType.DIM,
  'REM': TokenType.REM,
  "'": TokenType.REM,
  'DATA': TokenType.DATA,
  'READ': TokenType.READ,
  'RESTORE': TokenType.RESTORE,
  'CLS': TokenType.CLS,
  'STOP': TokenType.STOP,
  'SYSTEM': TokenType.SYSTEM,
  'NEW': TokenType.NEW,
  'LIST': TokenType.LIST,
  'RUN': TokenType.RUN,
  'CONT': TokenType.CONT,
  'AND': TokenType.AND,
  'OR': TokenType.OR,
  'NOT': TokenType.NOT,
  'XOR': TokenType.XOR,
  'MOD': TokenType.MOD,
  'LINE': TokenType.LINE,
  'CIRCLE': TokenType.CIRCLE,
  'PSET': TokenType.PSET,
  'PRESET': TokenType.PRESET,
  'DRAW': TokenType.DRAW,
  'PAINT': TokenType.PAINT,
  'SCREEN': TokenType.SCREEN,
  'COLOR': TokenType.COLOR,
  'LOCATE': TokenType.LOCATE,
  'BEEP': TokenType.BEEP,
  'SOUND': TokenType.SOUND,
  'PLAY': TokenType.PLAY,
  'DEF': TokenType.DEF,
  'FN': TokenType.FN,
  'SUB': TokenType.SUB,
  'FUNCTION': TokenType.FUNCTION,
  'CALL': TokenType.CALL,
  'OPEN': TokenType.OPEN,
  'CLOSE': TokenType.CLOSE,
  'WRITE': TokenType.WRITE,
  'GET': TokenType.GET,
  'PUT': TokenType.PUT,
  'ON': TokenType.ON,
  'ERROR': TokenType.ERROR,
  'RESUME': TokenType.RESUME,
  'RENUM': TokenType.RENUM,
  'SWAP': TokenType.SWAP,
  'RANDOMIZE': TokenType.RANDOMIZE,
  'TIMER': TokenType.TIMER,
  'INKEY$': TokenType.INKEY,
  'CHR$': TokenType.CHR_DOLLAR,
  'STR$': TokenType.STR_DOLLAR,
  'VAL': TokenType.VAL,
  'ASC': TokenType.ASC_FUNC,
  'LEN': TokenType.LEN_FUNC,
  'LEFT$': TokenType.LEFT_DOLLAR,
  'RIGHT$': TokenType.RIGHT_DOLLAR,
  'MID$': TokenType.MID_DOLLAR,
  'TAB': TokenType.TAB_FUNC,
  'SPC': TokenType.SPC_FUNC,
  'STRING$': TokenType.STRING_DOLLAR,
  'SPACE$': TokenType.SPACE_DOLLAR,
  'INSTR': TokenType.INSTR_FUNC,
  'UCASE$': TokenType.UCASE_DOLLAR,
  'LCASE$': TokenType.LCASE_DOLLAR,
  'ABS': TokenType.ABS_FUNC,
  'INT': TokenType.INT_FUNC,
  'RND': TokenType.RND_FUNC,
  'SQR': TokenType.SQR_FUNC,
  'SIN': TokenType.SIN_FUNC,
  'COS': TokenType.COS_FUNC,
  'TAN': TokenType.TAN_FUNC,
  'ATN': TokenType.ATN_FUNC,
  'LOG': TokenType.LOG_FUNC,
  'EXP': TokenType.EXP_FUNC,
  'SGN': TokenType.SGN_FUNC,
  'FIX': TokenType.FIX_FUNC,
  'PEEK': TokenType.PEEK_FUNC,
  'POKE': TokenType.POKE,
  // Date functions
  'MKDATE': TokenType.MKDATE_FUNC,
  'YEAR': TokenType.YEAR_FUNC,
  'MONTH': TokenType.MONTH_FUNC,
  'DAY': TokenType.DAY_FUNC,
  'DAYW': TokenType.DAYW_FUNC,
  'HOUR': TokenType.HOUR_FUNC,
  'MINUTE': TokenType.MINUTE_FUNC,
  'SECONDS': TokenType.SECONDS_FUNC,
  'DATESTR$': TokenType.DATESTR_DOLLAR,
  'TODATE': TokenType.TODATE_FUNC,
  // Non standard
  'ATAN2': TokenType.ATAN2_FUNC,
  'HYPO': TokenType.HYPO_FUNC,
  // Statistical functions
  'SUM': TokenType.SUM_FUNC,
  'AVG': TokenType.AVG_FUNC,
  'SUMPROD': TokenType.SUMPROD_FUNC,
  'AVGP': TokenType.AVGP_FUNC,
  'MIN': TokenType.MIN_FUNC,
  'MAX': TokenType.MAX_FUNC,
  'VARIP': TokenType.VARIP_FUNC,
  'STDP': TokenType.STDP_FUNC,
  'MEDIAN': TokenType.MEDIAN_FUNC,
  'PERCENTILE': TokenType.PERCENTILE_FUNC,
  // Array functions
  'FIND': TokenType.FIND_FUNC,
  'CONCAT': TokenType.CONCAT_FUNC,
  'BSEARCH': TokenType.BSEARCH_FUNC,
  // Base conversion functions
  'OCT$': TokenType.OCT_DOLLAR,
  'HEX$': TokenType.HEX_DOLLAR,
  'BIN$': TokenType.BIN_DOLLAR,
  // String functions
  'INSTRI': TokenType.INSTRI_FUNC,
  'SPLIT$': TokenType.SPLIT_DOLLAR,
};

export class Lexer {
  private source: string;
  private pos: number;
  private line: number;
  private col: number;

  constructor(source: string) {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const ch = this.source[this.pos];

      // Handle newlines
      if (ch === '\n') {
        tokens.push({ type: TokenType.Eol, value: '\n', line: this.line, col: this.col });
        this.pos++;
        this.line++;
        this.col = 1;
        continue;
      }
      if (ch === '\r') {
        this.pos++;
        if (this.pos < this.source.length && this.source[this.pos] === '\n') {
          this.pos++;
        }
        tokens.push({ type: TokenType.Eol, value: '\n', line: this.line, col: this.col });
        this.line++;
        this.col = 1;
        continue;
      }

      // Number
      if (this.isDigit(ch) || (ch === '.' && this.peek() && this.isDigit(this.peek()!))) {
        tokens.push(this.readNumber());
        continue;
      }

      // String literal
      if (ch === '"') {
        tokens.push(this.readString());
        continue;
      }

      // Identifier or keyword
      if (this.isAlpha(ch)) {
        const token = this.readIdentifier();
        // Special handling for GO TO / GO SUB
        if (token.type === TokenType.GOTO && this.peekWord() === 'TO') {
          // consume "TO"
          const start = this.pos;
          while (this.pos < this.source.length && this.isAlpha(this.source[this.pos])) this.pos++;
          token.value = 'GOTO';
        } else if (token.type === TokenType.GOTO && this.peekWord() === 'SUB') {
          // consume "SUB"
          while (this.pos < this.source.length && this.isAlpha(this.source[this.pos])) this.pos++;
          token.type = TokenType.GOSUB;
          token.value = 'GOSUB';
        }
        // Handle END IF -> END_IF, END SELECT -> END_SELECT
        if (token.type === TokenType.END) {
          const nextWord = this.peekWord();
          if (nextWord === 'IF') {
            while (this.pos < this.source.length && this.isAlpha(this.source[this.pos])) this.pos++;
            token.type = TokenType.END_IF;
            token.value = 'END IF';
          } else if (nextWord === 'SELECT') {
            while (this.pos < this.source.length && this.isAlpha(this.source[this.pos])) this.pos++;
            token.type = TokenType.END_SELECT;
            token.value = 'END SELECT';
          }
        }
        tokens.push(token);
        continue;
      }

      // Apostrophe ' as REM synonym
      if (ch === "'") {
        tokens.push({ type: TokenType.REM, value: "'", line: this.line, col: this.col });
        this.pos++;
        this.col++;
        continue;
      }

      // Operators and punctuation
      const op = this.readOperator();
      if (op) {
        tokens.push(op);
        continue;
      }

      // Unknown character - skip
      this.pos++;
      this.col++;
    }

    tokens.push({ type: TokenType.Eof, value: '', line: this.line, col: this.col });
    return tokens;
  }

  private peekWord(): string | null {
    let i = this.pos;
    // Skip whitespace
    while (i < this.source.length && (this.source[i] === ' ' || this.source[i] === '\t')) i++;
    if (i >= this.source.length) return null;
    if (!this.isAlpha(this.source[i])) return null;
    let word = '';
    while (i < this.source.length && this.isAlpha(this.source[i])) {
      word += this.source[i].toUpperCase();
      i++;
    }
    return word;
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length && (this.source[this.pos] === ' ' || this.source[this.pos] === '\t')) {
      this.pos++;
      this.col++;
    }
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isAlpha(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  private isAlnum(ch: string): boolean {
    return this.isDigit(ch) || this.isAlpha(ch);
  }

  private peek(): string | null {
    return this.pos + 1 < this.source.length ? this.source[this.pos + 1] : null;
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startCol = this.col;
    let value = '';

    // Integer part
    while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
      value += this.source[this.pos];
      this.pos++;
      this.col++;
    }

    // Decimal part
    if (this.pos < this.source.length && this.source[this.pos] === '.') {
      value += '.';
      this.pos++;
      this.col++;
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
        value += this.source[this.pos];
        this.pos++;
        this.col++;
      }
    }

    // Scientific notation
    if (this.pos < this.source.length && (this.source[this.pos] === 'E' || this.source[this.pos] === 'e' || this.source[this.pos] === 'D' || this.source[this.pos] === 'd')) {
      value += this.source[this.pos];
      this.pos++;
      this.col++;
      if (this.pos < this.source.length && (this.source[this.pos] === '+' || this.source[this.pos] === '-')) {
        value += this.source[this.pos];
        this.pos++;
        this.col++;
      }
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
        value += this.source[this.pos];
        this.pos++;
        this.col++;
      }
    }

    return { type: TokenType.Number, value, line: startLine, col: startCol };
  }

  private readString(): Token {
    const startLine = this.line;
    const startCol = this.col;
    this.pos++; // skip opening quote
    this.col++;
    let value = '';

    while (this.pos < this.source.length && this.source[this.pos] !== '"') {
      if (this.source[this.pos] === '\n' || this.source[this.pos] === '\r') {
        // Unterminated string - do NOT consume the newline; leave it for normal Eol processing
        throw new Error(`Unterminated string at line ${startLine}`);
      }
      value += this.source[this.pos];
      this.pos++;
      this.col++;
    }

    if (this.pos < this.source.length && this.source[this.pos] === '"') {
      this.pos++; // skip closing quote
      this.col++;
    }

    return { type: TokenType.String, value, line: startLine, col: startCol };
  }

  private readIdentifier(): Token {
    const startLine = this.line;
    const startCol = this.col;
    let value = '';

    while (this.pos < this.source.length && this.isAlnum(this.source[this.pos])) {
      value += this.source[this.pos];
      this.pos++;
      this.col++;
    }

    // Check for $ or % or ! or # suffix
    if (this.pos < this.source.length) {
      const suffix = this.source[this.pos];
      if (suffix === '$' || suffix === '%' || suffix === '!' || suffix === '#') {
        value += suffix;
        this.pos++;
        this.col++;
      }
    }

    const upper = value.toUpperCase();
    const keywordType = KEYWORDS[upper];

    if (keywordType !== undefined) {
      return { type: keywordType, value: upper, line: startLine, col: startCol };
    }

    return { type: TokenType.Identifier, value: upper, line: startLine, col: startCol };
  }

  private readOperator(): Token | null {
    const startLine = this.line;
    const startCol = this.col;
    const ch = this.source[this.pos];
    const next = this.peek();

    switch (ch) {
      case '+':
        this.pos++; this.col++;
        return { type: TokenType.Plus, value: '+', line: startLine, col: startCol };
      case '-':
        this.pos++; this.col++;
        return { type: TokenType.Minus, value: '-', line: startLine, col: startCol };
      case '*':
        this.pos++; this.col++;
        return { type: TokenType.Star, value: '*', line: startLine, col: startCol };
      case '/':
        this.pos++; this.col++;
        return { type: TokenType.Slash, value: '/', line: startLine, col: startCol };
      case '\\':
        this.pos++; this.col++;
        return { type: TokenType.BackSlash, value: '\\', line: startLine, col: startCol };
      case '^':
        this.pos++; this.col++;
        return { type: TokenType.Caret, value: '^', line: startLine, col: startCol };
      case '=':
        this.pos++; this.col++;
        return { type: TokenType.Eq, value: '=', line: startLine, col: startCol };
      case '<':
        this.pos++; this.col++;
        if (next === '>') { this.pos++; this.col++; return { type: TokenType.Ne, value: '<>', line: startLine, col: startCol }; }
        if (next === '=') { this.pos++; this.col++; return { type: TokenType.Le, value: '<=', line: startLine, col: startCol }; }
        return { type: TokenType.Lt, value: '<', line: startLine, col: startCol };
      case '>':
        this.pos++; this.col++;
        if (next === '=') { this.pos++; this.col++; return { type: TokenType.Ge, value: '>=', line: startLine, col: startCol }; }
        return { type: TokenType.Gt, value: '>', line: startLine, col: startCol };
      case '(':
        this.pos++; this.col++;
        return { type: TokenType.LParen, value: '(', line: startLine, col: startCol };
      case ')':
        this.pos++; this.col++;
        return { type: TokenType.RParen, value: ')', line: startLine, col: startCol };
      case ',':
        this.pos++; this.col++;
        return { type: TokenType.Comma, value: ',', line: startLine, col: startCol };
      case ';':
        this.pos++; this.col++;
        return { type: TokenType.Semicolon, value: ';', line: startLine, col: startCol };
      case ':':
        this.pos++; this.col++;
        return { type: TokenType.Colon, value: ':', line: startLine, col: startCol };
      default:
        return null;
    }
  }
}