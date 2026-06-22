# GW-BASIC Interpreter (gw-clone)

A GW-BASIC interpreter written in TypeScript, designed to run in web browsers. This project implements a subset of the GW-BASIC language with support for variables, arrays, control flow, graphics, and custom extensions.

## Features

- **Variables**: Numeric and string variables with implicit declaration
- **Arrays**: Single and multi-dimensional arrays with `DIM`
- **Control Flow**: `IF/THEN/ELSE`, `FOR/NEXT`, `WHILE/WEND`, `SELECT/CASE`
- **Input/Output**: `PRINT`, `INPUT`, `READ/DATA/RESTORE`
- **Graphics**: `LINE`, `CIRCLE`, `PSET/PRESET`, `DRAW`, `PAINT`, `SCREEN`, `COLOR`
- **Sound**: `BEEP`, `SOUND`
- **Subroutines**: `GOSUB/RETURN`, `ON GOTO/GOSUB`
- **String Functions**: `LEFT$`, `RIGHT$`, `MID$`, `CHR$`, `ASC`, `STR$`, `VAL`, `LEN`, `INSTR`, `STRING$`, `SPACE$`, `UCASE$`, `LCASE$`
- **Math Functions**: `ABS`, `INT`, `FIX`, `SQR`, `SIN`, `COS`, `TAN`, `ATN`, `LOG`, `EXP`, `SGN`, `RND`
- **Date Functions**: `MKDATE`, `YEAR`, `MONTH`, `DAY`, `DAYW`, `HOUR`, `MINUTE`, `SECONDS`, `DATESTR$`, `TODATE`
- **Statistical Functions**: `SUM`, `AVG`, `SUMPROD`, `AVGP`, `MIN`, `MAX`, `VARIP`, `STDP`, `MEDIAN`
- **Array Functions**: `FIND` — search for an element in an array
- **CALL Subroutines**: `CALL SORT(arr, d, f)` — sort array elements, `CALL INVERT(arr, d, f)` — invert array elements
- **Custom Extensions**: `ATAN2`, `HYPO`, `$ch(ind)` string character access

## Usage

```typescript
import { GWBasicInterpreter } from './gwbasic/interpreter';

const outputs: any[] = [];
const interpreter = new GWBasicInterpreter(
  (output) => outputs.push(output),
  async () => 'user input'
);

const code = `
10 CLS
20 PRINT "Hello, World!"
30 FOR I = 1 TO 10
40 PRINT I;
50 NEXT I
`;

await interpreter.run(code);
```

## Example Programs

### Sort an array
```basic
10 DIM A(10)
20 DATA 5,3,8,1,9,2,7,4,0,6
30 FOR I = 0 TO 9 : READ A(I) : NEXT I
40 CALL SORT(A, 0, 10)
```

### Invert array elements
```basic
10 DIM A(10)
20 FOR I = 0 TO 9 : A(I) = I + 1 : NEXT I
30 CALL INVERT(A, 0, 10)
```

### Search in an array
```basic
10 DIM A(10)
20 FOR I = 0 TO 9 : A(I) = (I MOD 5 + 1) * 5 : NEXT I
30 LET P = FIND(25, A, 10)
40 PRINT P
```

## Project Structure

```
src/gwbasic/
├── lexer.ts          # Tokenizer
├── parser.ts         # AST parser
├── interpreter.ts    # Runtime interpreter
├── types.ts          # Type definitions
└── __tests__/        # Test files
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npx vitest run

# Run tests in watch mode
npx vitest
```

## License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.