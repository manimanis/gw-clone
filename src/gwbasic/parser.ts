// GW-BASIC Parser

import { TokenType } from './types';
import type {
  Token, ASTNode,
  Expression, NumberLiteral, StringLiteral, VariableRef, BinaryOp, UnaryOp, FunctionCall,
  Statement, PrintStatement, InputStatement, LetStatement, IfStatement,
  ForStatement, NextStatement, GotoStatement, GosubStatement, ReturnStatement,
  WhileStatement, WendStatement, SelectStatement, DimStatement, ReadStatement,
  ReadVariable,
  DataStatement, RestoreStatement, RemStatement, ClsStatement, EndStatement,
  StopStatement, SwapStatement, RandomizeStatement, ColorStatement, LocateStatement,
  ScreenStatement, PsetStatement, LineStatement, CircleStatement, DrawStatement,
  PaintStatement, BeepStatement, SoundStatement, PokeStatement,
  OnGotoStatement, OnGosubStatement, MultiStatement, CaseBlock,
  DefFnStatement, OnErrorStatement, ResumeStatement, RenumStatement,
} from './types';

export class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parseProgram(): Statement[] {
    const program: Statement[] = [];

    while (this.pos < this.tokens.length) {
      if (this.current().type === TokenType.Eof) break;
      if (this.current().type === TokenType.Eol) {
        this.advance();
        continue;
      }

      // Try to read a line number
      if (this.current().type === TokenType.Number) {
        const lineNum = Math.floor(parseFloat(this.current().value));
        const lineNumToken = this.current();
        this.advance();

        // Skip whitespace/eol after line number
        while (this.current().type === TokenType.Eol || this.current().type === TokenType.Colon) {
          this.advance();
          if (this.current().type === TokenType.Eof) break;
        }

        const stmts = this.parseLineStatements();
        for (const stmt of stmts) {
          (stmt as any).line = lineNum;
          // Use the statement's own first token column if available, otherwise fall back to line number column
          const stmtCol = (stmt as any).col !== undefined ? (stmt as any).col : lineNumToken.col;
          (stmt as any).col = stmtCol;
          program.push(stmt);
        }
      } else {
        // Direct statement (no line number) - parse it
        const stmts = this.parseLineStatements();
        for (const stmt of stmts) {
          program.push(stmt);
        }
      }
    }

    return program;
  }

  parseLineStatements(): Statement[] {
    const statements: Statement[] = [];

    while (this.pos < this.tokens.length) {
      if (this.current().type === TokenType.Eof || this.current().type === TokenType.Eol) break;

      const stmt = this.parseStatement();
      if (stmt) {
        statements.push(stmt);
      }

      // Colon separates statements on same line
      if (this.current().type === TokenType.Colon) {
        this.advance();
        continue;
      }

      // If we hit Eol or Eof, stop
      if (this.current().type === TokenType.Eol || this.current().type === TokenType.Eof) break;
    }

    return statements;
  }

  private parseStatement(): Statement | null {
    const token = this.current();
    const startCol = token.col;

    let stmt: Statement | null;
    switch (token.type) {
      case TokenType.PRINT: stmt = this.parsePrint(); break;
      case TokenType.INPUT: stmt = this.parseInput(); break;
      case TokenType.LET: stmt = this.parseLet(); break;
      case TokenType.IF: stmt = this.parseIf(); break;
      case TokenType.FOR: stmt = this.parseFor(); break;
      case TokenType.NEXT: stmt = this.parseNext(); break;
      case TokenType.GOTO: stmt = this.parseGoto(); break;
      case TokenType.GOSUB: stmt = this.parseGosub(); break;
      case TokenType.RETURN: stmt = this.parseReturn(); break;
      case TokenType.WHILE: stmt = this.parseWhile(); break;
      case TokenType.WEND: stmt = this.parseWend(); break;
      case TokenType.SELECT: stmt = this.parseSelect(); break;
      case TokenType.DIM: stmt = this.parseDim(); break;
      case TokenType.READ: stmt = this.parseRead(); break;
      case TokenType.DATA: stmt = this.parseData(); break;
      case TokenType.RESTORE: stmt = this.parseRestore(); break;
      case TokenType.REM: stmt = this.parseRem(); break;
      case TokenType.CLS: stmt = this.parseCls(); break;
      case TokenType.END: stmt = this.parseEnd(); break;
      case TokenType.STOP: stmt = this.parseStop(); break;
      case TokenType.SWAP: stmt = this.parseSwap(); break;
      case TokenType.RANDOMIZE: stmt = this.parseRandomize(); break;
      case TokenType.COLOR: stmt = this.parseColor(); break;
      case TokenType.LOCATE: stmt = this.parseLocate(); break;
      case TokenType.SCREEN: stmt = this.parseScreen(); break;
      case TokenType.PSET: stmt = this.parsePset(); break;
      case TokenType.PRESET: stmt = this.parsePreset(); break;
      case TokenType.LINE: stmt = this.parseLine(); break;
      case TokenType.CIRCLE: stmt = this.parseCircle(); break;
      case TokenType.DRAW: stmt = this.parseDraw(); break;
      case TokenType.PAINT: stmt = this.parsePaint(); break;
      case TokenType.BEEP: stmt = this.parseBeep(); break;
      case TokenType.SOUND: stmt = this.parseSound(); break;
      case TokenType.POKE: stmt = this.parsePoke(); break;
      case TokenType.ON: stmt = this.parseOn(); break;
      case TokenType.MID_DOLLAR: stmt = this.parseMidAssign(); break;

      case TokenType.CALL: stmt = this.parseCall(); break;
      case TokenType.DEF: stmt = this.parseDefFn(); break;
      case TokenType.ERROR: stmt = this.parseOn(); break;
      case TokenType.RESUME: stmt = this.parseResume(); break;
      case TokenType.RENUM: stmt = this.parseRenum(); break;

      // Implicit LET: identifier followed by = or (
      case TokenType.Identifier:
        if (this.lookAhead().type === TokenType.Eq ||
            (this.lookAhead().type === TokenType.LParen && this.isAssignment())) {
          stmt = this.parseImplicitLet();
        } else {
          // Unknown statement - skip to end of line
          this.skipToEol();
          return null;
        }
        break;

      default:
        this.skipToEol();
        return null;
    }

    if (stmt) {
      (stmt as any).col = startCol;
    }
    return stmt;
  }

  private isAssignment(): boolean {
    // Look for pattern: IDENT ( expr ) =
    let depth = 0;
    let i = this.pos;
    while (i < this.tokens.length) {
      if (this.tokens[i].type === TokenType.LParen) depth++;
      if (this.tokens[i].type === TokenType.RParen) depth--;
      if (depth === 0 && this.tokens[i].type === TokenType.Eq) return true;
      // Break if we've returned to depth 0 and hit a token that can't be part of
      // an assignment target (not LParen/RParen and past the identifier + open paren)
      if (depth === 0 && i > this.pos + 1 &&
          this.tokens[i].type !== TokenType.LParen &&
          this.tokens[i].type !== TokenType.RParen) break;
      if (this.tokens[i].type === TokenType.Eol || this.tokens[i].type === TokenType.Eof) break;
      i++;
    }
    return false;
  }

  // Expression parsing with precedence climbing
  parseExpression(): Expression {
    return this.parseOr();
  }

  private parseOr(): Expression {
    let left = this.parseAnd();
    while (this.current().type === TokenType.OR) {
      this.advance();
      const right = this.parseAnd();
      left = { type: 'BinaryOp', op: 'OR', left, right } as BinaryOp;
    }
    return left;
  }

  private parseAnd(): Expression {
    let left = this.parseNot();
    while (this.current().type === TokenType.AND) {
      this.advance();
      const right = this.parseNot();
      left = { type: 'BinaryOp', op: 'AND', left, right } as BinaryOp;
    }
    return left;
  }

  private parseNot(): Expression {
    if (this.current().type === TokenType.NOT) {
      this.advance();
      const operand = this.parseNot();
      return { type: 'UnaryOp', op: 'NOT', operand } as UnaryOp;
    }
    return this.parseComparison();
  }

  private parseComparison(): Expression {
    let left = this.parseAddition();
    const compOps = [TokenType.Eq, TokenType.Ne, TokenType.Lt, TokenType.Gt, TokenType.Le, TokenType.Ge] as readonly number[];
    while ((compOps as readonly number[]).includes(this.current().type as number)) {
      const op = this.current().value;
      this.advance();
      const right = this.parseAddition();
      left = { type: 'BinaryOp', op, left, right } as BinaryOp;
    }
    return left;
  }

  private parseAddition(): Expression {
    let left = this.parseMultiplication();
    while (this.current().type === TokenType.Plus || this.current().type === TokenType.Minus) {
      const op = this.current().value;
      this.advance();
      const right = this.parseMultiplication();
      left = { type: 'BinaryOp', op, left, right } as BinaryOp;
    }
    return left;
  }

  private parseMultiplication(): Expression {
    let left = this.parsePower();
    while (this.current().type === TokenType.Star || this.current().type === TokenType.Slash ||
           this.current().type === TokenType.BackSlash || this.current().type === TokenType.MOD) {
      const op = this.current().value;
      this.advance();
      const right = this.parsePower();
      left = { type: 'BinaryOp', op, left, right } as BinaryOp;
    }
    return left;
  }

  private parsePower(): Expression {
    let base = this.parseUnary();
    if (this.current().type === TokenType.Caret) {
      this.advance();
      const exp = this.parsePower(); // Right-associative
      base = { type: 'BinaryOp', op: '^', left: base, right: exp } as BinaryOp;
    }
    return base;
  }

  private parseUnary(): Expression {
    if (this.current().type === TokenType.Minus) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryOp', op: '-', operand } as UnaryOp;
    }
    if (this.current().type === TokenType.Plus) {
      this.advance();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    const token = this.current();

    // Number
    if (token.type === TokenType.Number) {
      this.advance();
      return { type: 'NumberLiteral', value: parseFloat(token.value) } as NumberLiteral;
    }

    // String
    if (token.type === TokenType.String) {
      this.advance();
      return { type: 'StringLiteral', value: token.value } as StringLiteral;
    }

    // Parenthesized expression
    if (token.type === TokenType.LParen) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RParen);
      return expr;
    }

    // Built-in functions
    const funcTypes: TokenType[] = [
      TokenType.CHR_DOLLAR, TokenType.STR_DOLLAR, TokenType.VAL, TokenType.ASC_FUNC,
      TokenType.LEN_FUNC, TokenType.LEFT_DOLLAR, TokenType.RIGHT_DOLLAR, TokenType.MID_DOLLAR,
      TokenType.TAB_FUNC, TokenType.SPC_FUNC, TokenType.STRING_DOLLAR, TokenType.SPACE_DOLLAR,
      TokenType.INSTR_FUNC, TokenType.UCASE_DOLLAR, TokenType.LCASE_DOLLAR,
      TokenType.ABS_FUNC, TokenType.INT_FUNC, TokenType.RND_FUNC, TokenType.SQR_FUNC,
      TokenType.SIN_FUNC, TokenType.COS_FUNC, TokenType.TAN_FUNC, TokenType.ATN_FUNC,
      TokenType.LOG_FUNC, TokenType.EXP_FUNC, TokenType.SGN_FUNC, TokenType.FIX_FUNC,
      TokenType.PEEK_FUNC, TokenType.INKEY,
      // Date functions
      TokenType.MKDATE_FUNC, TokenType.YEAR_FUNC, TokenType.MONTH_FUNC, TokenType.DAY_FUNC,
      TokenType.DAYW_FUNC, TokenType.HOUR_FUNC, TokenType.MINUTE_FUNC, TokenType.SECONDS_FUNC,
      TokenType.DATESTR_DOLLAR, TokenType.TODATE_FUNC,
      // non standard functions
      TokenType.ATAN2_FUNC, TokenType.HYPO_FUNC,
      // Statistical functions
      TokenType.SUM_FUNC, TokenType.AVG_FUNC, TokenType.SUMPROD_FUNC, TokenType.AVGP_FUNC,
      TokenType.MIN_FUNC, TokenType.MAX_FUNC, TokenType.VARIP_FUNC, TokenType.STDP_FUNC, TokenType.MEDIAN_FUNC,
      TokenType.PERCENTILE_FUNC,
      // Array functions
      TokenType.FIND_FUNC, TokenType.CONCAT_FUNC, TokenType.BSEARCH_FUNC,
      // Base conversion functions
      TokenType.OCT_DOLLAR, TokenType.HEX_DOLLAR, TokenType.BIN_DOLLAR,
      // String functions
      TokenType.INSTRI_FUNC, TokenType.SPLIT_DOLLAR,
    ];

    if (funcTypes.includes(token.type)) {
      const name = token.value;
      this.advance();
      // INKEY$ takes no arguments
      if (token.type === TokenType.INKEY) {
        return { type: 'FunctionCall', name, args: [] } as FunctionCall;
      }
      // TAB/SPC are special
      if (token.type === TokenType.TAB_FUNC || token.type === TokenType.SPC_FUNC) {
        this.expect(TokenType.LParen);
        const arg = this.parseExpression();
        this.expect(TokenType.RParen);
        return { type: 'FunctionCall', name, args: [arg] } as FunctionCall;
      }
      // RND can be called with or without args
      if (token.type === TokenType.RND_FUNC) {
        if (this.current().type === TokenType.LParen) {
          this.advance();
          const arg = this.parseExpression();
          this.expect(TokenType.RParen);
          return { type: 'FunctionCall', name, args: [arg] } as FunctionCall;
        }
        return { type: 'FunctionCall', name, args: [] } as FunctionCall;
      }
      const args = this.parseFunctionArgs();
      return { type: 'FunctionCall', name, args } as FunctionCall;
    }

    // Variable (possibly array)
    if (token.type === TokenType.Identifier) {
      const name = token.value;
      this.advance();

      // Check for array access
      if (this.current().type === TokenType.LParen) {
        this.advance();
        const indices: Expression[] = [this.parseExpression()];
        while (this.current().type === TokenType.Comma) {
          this.advance();
          indices.push(this.parseExpression());
        }
        this.expect(TokenType.RParen);
        return { type: 'VariableRef', name, indices } as VariableRef;
      }

      return { type: 'VariableRef', name, indices: [] } as VariableRef;
    }

    // Fallback - return 0
    this.advance();
    return { type: 'NumberLiteral', value: 0 } as NumberLiteral;
  }

  private parseFunctionArgs(): Expression[] {
    const args: Expression[] = [];

    if (this.current().type !== TokenType.LParen) {
      return args; // No parentheses = no args
    }

    this.advance(); // skip (

    if (this.current().type !== TokenType.RParen) {
      args.push(this.parseExpression());
      while (this.current().type === TokenType.Comma) {
        this.advance();
        args.push(this.parseExpression());
      }
    }

    this.expect(TokenType.RParen);
    return args;
  }

  // Statement parsers

  private parsePrint(): Statement {
    this.advance(); // skip PRINT/?

    const items: (Expression | string)[] = [];
    let endsWithSeparator = false;

    while (this.current().type !== TokenType.Eol && this.current().type !== TokenType.Eof &&
           this.current().type !== TokenType.Colon) {
      if (this.current().type === TokenType.Semicolon) {
        items.push(';');
        this.advance();
        endsWithSeparator = true;
      } else if (this.current().type === TokenType.Comma) {
        items.push(',');
        this.advance();
        endsWithSeparator = true;
      } else {
        items.push(this.parseExpression());
        endsWithSeparator = false;
      }
    }

    return { type: 'Print', items, endsWithSeparator } as PrintStatement;
  }

  private parseInput(): Statement {
    this.advance(); // skip INPUT

    let prompt = '';

    // Check for prompt string
    if (this.current().type === TokenType.String) {
      prompt = this.current().value;
      this.advance();
      if (this.current().type === TokenType.Semicolon) {
        this.advance();
      } else if (this.current().type === TokenType.Comma) {
        this.advance();
        prompt += '?';
      }
    }

    const variables: string[] = [];
    variables.push(this.current().value);
    this.advance();

    while (this.current().type === TokenType.Comma) {
      this.advance();
      variables.push(this.current().value);
      this.advance();
    }

    return { type: 'Input', prompt, variables } as InputStatement;
  }

  private parseLet(): Statement {
    this.advance(); // skip LET
    return this.parseAssignment();
  }

  private parseImplicitLet(): Statement {
    return this.parseAssignment();
  }

  private parseAssignment(): Statement {
    const name = this.current().value;
    this.advance();

    let indices: Expression[] = [];
    if (this.current().type === TokenType.LParen) {
      this.advance();
      indices.push(this.parseExpression());
      while (this.current().type === TokenType.Comma) {
        this.advance();
        indices.push(this.parseExpression());
      }
      this.expect(TokenType.RParen);
    }

    this.expect(TokenType.Eq);
    const value = this.parseExpression();

    return { type: 'Let', name, indices, value } as LetStatement;
  }

  private parseIf(): Statement {
    this.advance(); // skip IF

    const condition = this.parseExpression();
    this.expect(TokenType.THEN);

    // THEN can be followed by a line number (implicit GOTO) or statements
    if (this.current().type === TokenType.Number &&
        (this.lookAhead().type === TokenType.Eol || this.lookAhead().type === TokenType.Eof ||
         this.lookAhead().type === TokenType.Colon || this.lookAhead().type === TokenType.ELSE)) {
      const lineNum = Math.floor(parseFloat(this.current().value));
      this.advance();
      return {
        type: 'If',
        condition,
        thenBranch: [{ type: 'Goto', targetLine: lineNum } as GotoStatement],
        elseBranch: [],
      } as IfStatement;
    }

    const thenBranch = this.parseIfBranch();
    let elseBranch: Statement[] = [];

    if (this.current().type === TokenType.ELSE) {
      this.advance();
      // ELSE can also be a line number
      if (this.current().type === TokenType.Number &&
          (this.lookAhead().type === TokenType.Eol || this.lookAhead().type === TokenType.Eof ||
           this.lookAhead().type === TokenType.Colon)) {
        const lineNum = Math.floor(parseFloat(this.current().value));
        this.advance();
        elseBranch = [{ type: 'Goto', targetLine: lineNum } as GotoStatement];
      } else {
        elseBranch = this.parseIfBranch();
      }
    } else if (this.current().type === TokenType.ELSEIF) {
      elseBranch = [this.parseElseIf()];
    }

    return { type: 'If', condition, thenBranch, elseBranch } as IfStatement;
  }

  private parseElseIf(): Statement {
    this.advance(); // skip ELSEIF
    const condition = this.parseExpression();
    this.expect(TokenType.THEN);
    const thenBranch = this.parseIfBranch();
    let elseBranch: Statement[] = [];

    if (this.current().type === TokenType.ELSE) {
      this.advance();
      elseBranch = this.parseIfBranch();
    } else if (this.current().type === TokenType.ELSEIF) {
      elseBranch = [this.parseElseIf()];
    }

    return { type: 'If', condition, thenBranch, elseBranch } as IfStatement;
  }

  private parseIfBranch(): Statement[] {
    const stmts: Statement[] = [];

    // In GW-BASIC, all statements after THEN (separated by :) belong to the THEN branch
    // The branch ends at EOL, EOF, ELSE, or ELSEIF — but NOT at colon
    while (this.current().type !== TokenType.Eol && this.current().type !== TokenType.Eof &&
           this.current().type !== TokenType.ELSE && this.current().type !== TokenType.ELSEIF) {
      // Skip colon separators within the branch
      if (this.current().type === TokenType.Colon) {
        this.advance();
        continue;
      }
      const stmt = this.parseStatement();
      if (stmt) stmts.push(stmt);
      else break;
    }

    return stmts;
  }

  private parseFor(): Statement {
    this.advance(); // skip FOR

    const variable = this.current().value;
    this.advance();

    this.expect(TokenType.Eq);
    const start = this.parseExpression();
    this.expect(TokenType.TO);
    const end = this.parseExpression();

    let step: Expression = { type: 'NumberLiteral', value: 1 } as NumberLiteral;
    if (this.current().type === TokenType.STEP) {
      this.advance();
      step = this.parseExpression();
    }

    return { type: 'For', variable, start, end, step } as ForStatement;
  }

  private parseNext(): Statement {
    this.advance(); // skip NEXT
    let variable = '';
    if (this.current().type === TokenType.Identifier) {
      variable = this.current().value;
      this.advance();
    }
    return { type: 'Next', variable } as NextStatement;
  }

  private parseGoto(): Statement {
    this.advance(); // skip GOTO
    const targetLine = Math.floor(parseFloat(this.current().value));
    this.advance();
    return { type: 'Goto', targetLine } as GotoStatement;
  }

  private parseGosub(): Statement {
    this.advance(); // skip GOSUB
    const targetLine = Math.floor(parseFloat(this.current().value));
    this.advance();
    return { type: 'Gosub', targetLine } as GosubStatement;
  }

  private parseReturn(): Statement {
    this.advance(); // skip RETURN
    return { type: 'Return' } as ReturnStatement;
  }

  private parseWhile(): Statement {
    this.advance(); // skip WHILE
    const condition = this.parseExpression();
    return { type: 'While', condition } as WhileStatement;
  }

  private parseWend(): Statement {
    this.advance(); // skip WEND
    return { type: 'Wend' } as WendStatement;
  }

  private parseSelect(): Statement {
    this.advance(); // skip SELECT
    this.expect(TokenType.CASE);
    const expression = this.parseExpression();

    const cases: CaseBlock[] = [];
    let caseElse: Statement[] = [];

    while (this.current().type !== TokenType.Eof && this.current().type !== TokenType.END_SELECT) {
      if (this.current().type === TokenType.CASE) {
        this.advance();
        if (this.current().type === TokenType.ELSE) {
          this.advance();
          caseElse = this.parseCaseStatements();
        } else {
          const value = this.parseExpression();
          const statements = this.parseCaseStatements();
          cases.push({ value, statements });
        }
      } else {
        this.advance();
      }
    }

    if (this.current().type === TokenType.END_SELECT) {
      this.advance();
    }

    return { type: 'Select', expression, cases, caseElse } as SelectStatement;
  }

  private parseCaseStatements(): Statement[] {
    const stmts: Statement[] = [];

    while (this.current().type !== TokenType.Eol && this.current().type !== TokenType.Eof &&
           this.current().type !== TokenType.CASE && this.current().type !== TokenType.END_SELECT) {
      const stmt = this.parseStatement();
      if (stmt) stmts.push(stmt);
      else break;
    }

    // Skip trailing Eol
    if (this.current().type === TokenType.Eol) {
      this.advance();
    }

    return stmts;
  }

  private parseDim(): Statement {
    this.advance(); // skip DIM

    const dimensions: { name: string; bounds: Expression[] }[] = [];

    do {
      const name = this.current().value;
      this.advance();
      this.expect(TokenType.LParen);
      const bounds: Expression[] = [this.parseExpression()];
      while (this.current().type === TokenType.Comma) {
        this.advance();
        bounds.push(this.parseExpression());
      }
      this.expect(TokenType.RParen);
      dimensions.push({ name, bounds });
    } while (this.current().type === TokenType.Comma && (this.advance(), true));

    return { type: 'Dim', dimensions } as DimStatement;
  }

  private parseRead(): Statement {
    this.advance(); // skip READ
    const variables: ReadVariable[] = [];

    // READ can handle both simple variables and array elements like A(I)
    const name = this.current().value;
    this.advance();
    let indices: Expression[] = [];
    if (this.current().type === TokenType.LParen) {
      this.advance();
      indices.push(this.parseExpression());
      while (this.current().type === TokenType.Comma) {
        this.advance();
        indices.push(this.parseExpression());
      }
      this.expect(TokenType.RParen);
    }
    variables.push({ name, indices });

    while (this.current().type === TokenType.Comma) {
      this.advance();
      const nextName = this.current().value;
      this.advance();
      let nextIndices: Expression[] = [];
      if (this.current().type === TokenType.LParen) {
        this.advance();
        nextIndices.push(this.parseExpression());
        while (this.current().type === TokenType.Comma) {
          this.advance();
          nextIndices.push(this.parseExpression());
        }
        this.expect(TokenType.RParen);
      }
      variables.push({ name: nextName, indices: nextIndices });
    }

    return { type: 'Read', variables } as ReadStatement;
  }

  private parseData(): Statement {
    this.advance(); // skip DATA
    const values: (number | string)[] = [];

    while (this.current().type !== TokenType.Eol && this.current().type !== TokenType.Eof &&
           this.current().type !== TokenType.Colon) {
      if (this.current().type === TokenType.Number) {
        values.push(parseFloat(this.current().value));
        this.advance();
      } else if (this.current().type === TokenType.String) {
        values.push(this.current().value);
        this.advance();
      } else if (this.current().type === TokenType.Minus) {
        // Negative number in DATA
        this.advance();
        if (this.current().type === TokenType.Number) {
          values.push(-parseFloat(this.current().value));
          this.advance();
        }
      } else {
        // Handle unquoted strings in DATA
        let val = this.current().value;
        this.advance();
        while (this.current().type !== TokenType.Comma && this.current().type !== TokenType.Eol &&
               this.current().type !== TokenType.Eof && this.current().type !== TokenType.Colon) {
          val += this.current().value;
          this.advance();
        }
        values.push(val.trim());
      }

      if (this.current().type === TokenType.Comma) {
        this.advance();
      }
    }

    return { type: 'Data', values } as DataStatement;
  }

  private parseRestore(): Statement {
    this.advance();
    return { type: 'Restore' } as RestoreStatement;
  }

  private parseRem(): Statement {
    this.advance(); // skip REM
    let text = '';
    while (this.current().type !== TokenType.Eol && this.current().type !== TokenType.Eof) {
      text += this.current().value;
      this.advance();
    }
    return { type: 'Rem', text } as RemStatement;
  }

  private parseCls(): Statement {
    this.advance();
    return { type: 'Cls' } as ClsStatement;
  }

  private parseEnd(): Statement {
    this.advance();
    return { type: 'End' } as EndStatement;
  }

  private parseStop(): Statement {
    this.advance();
    return { type: 'Stop' } as StopStatement;
  }

  private parseSwap(): Statement {
    this.advance(); // skip SWAP
    const var1 = this.parseVariableRef();
    this.expect(TokenType.Comma);
    const var2 = this.parseVariableRef();
    return {
      type: 'Swap',
      var1: { name: var1.name, indices: var1.indices },
      var2: { name: var2.name, indices: var2.indices },
    } as SwapStatement;
  }

  private parseVariableRef(): VariableRef {
    const name = this.current().value;
    this.advance();
    const indices: Expression[] = [];
    if (this.current().type === TokenType.LParen) {
      this.advance();
      indices.push(this.parseExpression());
      while (this.current().type === TokenType.Comma) {
        this.advance();
        indices.push(this.parseExpression());
      }
      this.expect(TokenType.RParen);
    }
    return { type: 'VariableRef', name, indices } as VariableRef;
  }

  private parseRandomize(): Statement {
    this.advance();
    let seed: Expression | undefined;
    if (this.current().type !== TokenType.Eol && this.current().type !== TokenType.Eof &&
        this.current().type !== TokenType.Colon) {
      seed = this.parseExpression();
    }
    return { type: 'Randomize', seed } as RandomizeStatement;
  }

  private parseColor(): Statement {
    this.advance();
    let foreground: Expression | undefined;
    let background: Expression | undefined;

    if (this.current().type !== TokenType.Eol && this.current().type !== TokenType.Eof &&
        this.current().type !== TokenType.Colon) {
      foreground = this.parseExpression();
      if (this.current().type === TokenType.Comma) {
        this.advance();
        background = this.parseExpression();
      }
    }

    return { type: 'Color', foreground, background } as ColorStatement;
  }

  private parseLocate(): Statement {
    this.advance();
    let row: Expression | undefined;
    let col: Expression | undefined;

    if (this.current().type !== TokenType.Eol && this.current().type !== TokenType.Eof &&
        this.current().type !== TokenType.Colon) {
      row = this.parseExpression();
      if (this.current().type === TokenType.Comma) {
        this.advance();
        if (this.current().type !== TokenType.Eol && this.current().type !== TokenType.Eof &&
            this.current().type !== TokenType.Colon && this.current().type !== TokenType.Comma) {
          col = this.parseExpression();
        }
      }
    }

    return { type: 'Locate', row, col } as LocateStatement;
  }

  private parseScreen(): Statement {
    this.advance();
    const mode = this.parseExpression();
    return { type: 'Screen', mode } as ScreenStatement;
  }

  private parsePset(): Statement {
    this.advance();
    this.expect(TokenType.LParen);
    const x = this.parseExpression();
    this.expect(TokenType.Comma);
    const y = this.parseExpression();
    this.expect(TokenType.RParen);
    let color: Expression | undefined;
    if (this.current().type === TokenType.Comma) {
      this.advance();
      color = this.parseExpression();
    }
    return { type: 'Pset', x, y, color } as PsetStatement;
  }

  private parsePreset(): Statement {
    this.advance();
    this.expect(TokenType.LParen);
    const x = this.parseExpression();
    this.expect(TokenType.Comma);
    const y = this.parseExpression();
    this.expect(TokenType.RParen);
    return { type: 'Pset', x, y } as PsetStatement; // PRESET = PSET with bg color
  }

  private parseLine(): Statement {
    this.advance(); // skip LINE

    // LINE -(x2,y2) format
    if (this.current().type === TokenType.Minus) {
      this.advance();
      this.expect(TokenType.LParen);
      const x2 = this.parseExpression();
      this.expect(TokenType.Comma);
      const y2 = this.parseExpression();
      this.expect(TokenType.RParen);
      let color: Expression | undefined;
      let style: string | undefined;
      if (this.current().type === TokenType.Comma) {
        this.advance();
        if (this.current().type !== TokenType.Eol && this.current().type !== TokenType.Eof &&
            this.current().type !== TokenType.Colon) {
          color = this.parseExpression();
        }
        if (this.current().type === TokenType.Comma) {
          this.advance();
          // Check for B or BF
          if (this.current().type === TokenType.Identifier) {
            style = this.current().value;
            this.advance();
          }
        }
      }
      return { type: 'Line', x1: { type: 'NumberLiteral', value: 0 } as NumberLiteral, y1: { type: 'NumberLiteral', value: 0 } as NumberLiteral, x2, y2, color, style } as LineStatement;
    }

    // LINE (x1,y1)-(x2,y2) format
    this.expect(TokenType.LParen);
    const x1 = this.parseExpression();
    this.expect(TokenType.Comma);
    const y1 = this.parseExpression();
    this.expect(TokenType.RParen);
    this.expect(TokenType.Minus);
    this.expect(TokenType.LParen);
    const x2 = this.parseExpression();
    this.expect(TokenType.Comma);
    const y2 = this.parseExpression();
    this.expect(TokenType.RParen);

    let color: Expression | undefined;
    let style: string | undefined;
    if (this.current().type === TokenType.Comma) {
      this.advance();
      if (this.current().type !== TokenType.Eol && this.current().type !== TokenType.Eof &&
          this.current().type !== TokenType.Colon) {
        color = this.parseExpression();
      }
      if (this.current().type === TokenType.Comma) {
        this.advance();
        if (this.current().type === TokenType.Identifier &&
            (this.current().value === 'B' || this.current().value === 'BF')) {
          style = this.current().value;
          this.advance();
        }
      }
    }

    return { type: 'Line', x1, y1, x2, y2, color, style } as LineStatement;
  }

  private parseCircle(): Statement {
    this.advance();
    this.expect(TokenType.LParen);
    const x = this.parseExpression();
    this.expect(TokenType.Comma);
    const y = this.parseExpression();
    this.expect(TokenType.RParen);
    this.expect(TokenType.Comma);
    const radius = this.parseExpression();

    let color: Expression | undefined;
    let start: Expression | undefined;
    let end: Expression | undefined;
    let aspect: Expression | undefined;

    if (this.current().type === TokenType.Comma) {
      this.advance();
      if (this.current().type !== TokenType.Comma && this.current().type !== TokenType.Eol &&
          this.current().type !== TokenType.Eof && this.current().type !== TokenType.Colon) {
        color = this.parseExpression();
      }
    }
    if (this.current().type === TokenType.Comma) {
      this.advance();
      if (this.current().type !== TokenType.Comma && this.current().type !== TokenType.Eol &&
          this.current().type !== TokenType.Eof && this.current().type !== TokenType.Colon) {
        start = this.parseExpression();
      }
    }
    if (this.current().type === TokenType.Comma) {
      this.advance();
      if (this.current().type !== TokenType.Comma && this.current().type !== TokenType.Eol &&
          this.current().type !== TokenType.Eof && this.current().type !== TokenType.Colon) {
        end = this.parseExpression();
      }
    }
    if (this.current().type === TokenType.Comma) {
      this.advance();
      if (this.current().type !== TokenType.Eol && this.current().type !== TokenType.Eof &&
          this.current().type !== TokenType.Colon) {
        aspect = this.parseExpression();
      }
    }

    return { type: 'Circle', x, y, radius, color, start, end, aspect } as CircleStatement;
  }

  private parseDraw(): Statement {
    this.advance();
    const command = this.parseExpression();
    return { type: 'Draw', command } as DrawStatement;
  }

  private parsePaint(): Statement {
    this.advance();
    this.expect(TokenType.LParen);
    const x = this.parseExpression();
    this.expect(TokenType.Comma);
    const y = this.parseExpression();
    this.expect(TokenType.RParen);

    let color: Expression | undefined;
    let border: Expression | undefined;

    if (this.current().type === TokenType.Comma) {
      this.advance();
      if (this.current().type !== TokenType.Comma && this.current().type !== TokenType.Eol &&
          this.current().type !== TokenType.Eof) {
        color = this.parseExpression();
      }
    }
    if (this.current().type === TokenType.Comma) {
      this.advance();
      if (this.current().type !== TokenType.Eol && this.current().type !== TokenType.Eof) {
        border = this.parseExpression();
      }
    }

    return { type: 'Paint', x, y, color, border } as PaintStatement;
  }

  private parseBeep(): Statement {
    this.advance();
    return { type: 'Beep' } as BeepStatement;
  }

  private parseSound(): Statement {
    this.advance();
    const frequency = this.parseExpression();
    this.expect(TokenType.Comma);
    const duration = this.parseExpression();
    return { type: 'Sound', frequency, duration } as SoundStatement;
  }

  private parsePoke(): Statement {
    this.advance();
    const address = this.parseExpression();
    this.expect(TokenType.Comma);
    const value = this.parseExpression();
    return { type: 'Poke', address, value } as PokeStatement;
  }

  private parseOn(): Statement {
    this.advance(); // skip ON

    // Check for ON ERROR GOTO/GOSUB
    if (this.current().type === TokenType.ERROR) {
      this.advance(); // skip ERROR
      if (this.current().type === TokenType.GOTO) {
        this.advance(); // skip GOTO
        const targetLine = Math.floor(parseFloat(this.current().value));
        this.advance();
        return { type: 'OnError', targetLine, kind: 'GOTO' } as OnErrorStatement;
      }
      if (this.current().type === TokenType.GOSUB) {
        this.advance(); // skip GOSUB
        const targetLine = Math.floor(parseFloat(this.current().value));
        this.advance();
        return { type: 'OnError', targetLine, kind: 'GOSUB' } as OnErrorStatement;
      }
      this.skipToEol();
      return { type: 'End' } as EndStatement;
    }

    const expression = this.parseExpression();

    if (this.current().type === TokenType.GOTO) {
      this.advance();
      const lines: number[] = [];
      lines.push(Math.floor(parseFloat(this.current().value)));
      this.advance();
      while (this.current().type === TokenType.Comma) {
        this.advance();
        lines.push(Math.floor(parseFloat(this.current().value)));
        this.advance();
      }
      return { type: 'OnGoto', expression, lines } as OnGotoStatement;
    }

    if (this.current().type === TokenType.GOSUB) {
      this.advance();
      const lines: number[] = [];
      lines.push(Math.floor(parseFloat(this.current().value)));
      this.advance();
      while (this.current().type === TokenType.Comma) {
        this.advance();
        lines.push(Math.floor(parseFloat(this.current().value)));
        this.advance();
      }
      return { type: 'OnGosub', expression, lines } as OnGosubStatement;
    }

    // ERROR RESUME etc - skip
    this.skipToEol();
    return { type: 'End' } as EndStatement;
  }

  private parseMidAssign(): Statement {
    this.advance(); // skip MID$
    this.expect(TokenType.LParen);

    // Parse the variable name (first arg)
    const varName = this.current().value;
    this.advance();

    let indices: Expression[] = [];
    if (this.current().type === TokenType.LParen) {
      this.advance();
      indices.push(this.parseExpression());
      while (this.current().type === TokenType.Comma) {
        this.advance();
        indices.push(this.parseExpression());
      }
      this.expect(TokenType.RParen);
    }

    this.expect(TokenType.Comma);
    const position = this.parseExpression();
    this.expect(TokenType.Comma);
    const length = this.parseExpression();
    this.expect(TokenType.RParen);

    this.expect(TokenType.Eq);
    const value = this.parseExpression();

    return {
      type: 'MidAssign',
      variable: varName,
      indices,
      position,
      length,
      value,
    } as any;
  }

  private parseCall(): Statement {
    this.advance(); // skip CALL

    // Read the subroutine name (SORT, INVERT, etc.)
    const subName = this.current().value;
    this.advance();

    // Parse argument list: (args)
    const args: Expression[] = [];
    if (this.current().type === TokenType.LParen) {
      this.advance(); // skip (
      if (this.current().type !== TokenType.RParen) {
        args.push(this.parseExpression());
        while (this.current().type === TokenType.Comma) {
          this.advance();
          args.push(this.parseExpression());
        }
      }
      this.expect(TokenType.RParen);
    }

    return { type: 'Call', subName, args } as any;
  }

  private parseDefFn(): Statement {
    this.advance(); // skip DEF
    this.expect(TokenType.FN);
    const fnName = this.current().value;
    this.advance();
    this.expect(TokenType.LParen);
    const paramName = this.current().value;
    this.advance();
    this.expect(TokenType.RParen);
    this.expect(TokenType.Eq);
    const expression = this.parseExpression();
    return { type: 'DefFn', fnName, paramName, expression } as DefFnStatement;
  }

  private parseResume(): Statement {
    this.advance(); // skip RESUME
    // Check for RESUME NEXT
    if (this.current().type === TokenType.NEXT) {
      this.advance();
      return { type: 'Resume', resumeType: 'NEXT' } as ResumeStatement;
    }
    return { type: 'Resume', resumeType: 'RESUME' } as ResumeStatement;
  }

  private parseRenum(): Statement {
    this.advance(); // skip RENUM
    let startLine: number | undefined;
    let step: number | undefined;
    if (this.current().type === TokenType.Number) {
      startLine = Math.floor(parseFloat(this.current().value));
      this.advance();
      if (this.current().type === TokenType.Comma) {
        this.advance();
        step = Math.floor(parseFloat(this.current().value));
        this.advance();
      }
    }
    return { type: 'Renum', startLine, step } as RenumStatement;
  }

  // Utility methods

  private current(): Token {
    return this.tokens[this.pos] || { type: TokenType.Eof, value: '', line: 0, col: 0 };
  }

  private lookAhead(): Token {
    return this.tokens[this.pos + 1] || { type: TokenType.Eof, value: '', line: 0, col: 0 };
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private expect(type: TokenType): Token {
    if (this.current().type === type) {
      return this.advance();
    }
    // Soft error - skip
    return this.current();
  }

  private skipToEol(): void {
    while (this.pos < this.tokens.length &&
           this.current().type !== TokenType.Eol &&
           this.current().type !== TokenType.Eof) {
      this.pos++;
    }
  }
}
