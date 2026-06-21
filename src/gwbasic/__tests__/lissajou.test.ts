import { describe, it, expect } from 'vitest';
import { GWBasicInterpreter } from '../interpreter';

describe('Lissajou Program', () => {
  let outputs: any[];
  let interpreter: GWBasicInterpreter;

  beforeEach(() => {
    outputs = [];
    interpreter = new GWBasicInterpreter(
      (output) => outputs.push(output),
      async () => 'test'
    );
  });

  function getOutput() {
    return outputs.filter(o => o.type === 'print').map(o => o.value).join('');
  }

  it('executes the Lissajou program and produces output', async () => {
    const code = `10 REM text Lissajou       K Moerman 2026
20 PRINT "Lissajou on a text screen": CPI = 3.1415927#
30 FX% = 3: FY% = 5: REM hor. AND vert. frequencies
40 P$ = "*": A$ = ".": REM symbols TO use plot AND axes
50 XA% = 37: YA% = 10: REM hor. AND vert ampl. in char
60 PH = CPI / 4: REM phase shift y vs x
70 IF FX% > FY% THEN NK% = FX% ELSE NK% = FY%
80 FOR Y% = -YA% TO YA%
90 IF Y% <> 0 THEN GOTO 120
100 L$ = STRING$(2 * XA%, A$)
110 GOTO 130
120 L$ = STRING$(XA%, " ") + A$ + STRING$(XA% - 1, " ")
130 FOR K% = 0 TO NK% - 1
140 R = Y% / YA%: GOSUB 260
150 T = 1 / FY% * (AR + K% * 2 * CPI - PH)
160 GOSUB 310
170 MID$(L$, X%, 1) = P$
180 T = 1 / FY% * (-AR + (1 - 2 * K%) * CPI - PH)
190 GOSUB 310
200 MID$(L$, X%, 1) = P$
210 NEXT K%
220 PRINT L$
230 NEXT Y%
240 END
250 REM Inverse sine of R --> AR
260 IF ABS(R) < 1 THEN AR = ATN(R / SQR(1 - (R * R)))
270 IF R = 1 THEN AR = CPI / 2
280 IF R = -1 THEN AR = -CPI / 2
290 RETURN
300 REM calculate char position X% out of T
310 X% = INT(XA% * (1 + .96 * COS(FX% * T)) + .5)
320 RETURN`;

    await interpreter.run(code);
    const output = getOutput();
    // console.log(JSON.stringify(output));
    expect(output).toBe(`Lissajou on a text screen
    *      *                         .    *         *                  *  
 *   *    *        *            *    .     *       *        *       *  *  
 * *         *        *     *        . *              *        *  *    *  
* *            *         *          *.                   *       *    *   
 *                *   *     *    *   .                     *   *  *  *    
 *                  *         *      .                       *      *     
 *                *   *     *    *   .                     *   *  *  *    
* *             *       * *        * .                    *     **   *    
 * *          *         * *          *                  *       **    *   
 * *        *         *     *        . *              *        *   *   *  
.*..*......*........*.........*...........*.........*........*......*..*..
 *   *   *        *              *   .      *     *         *        * *  
  *    **       *                  * .        * *         *          * *  
   *   **     *                      *        * *       *             * * 
   *  *  *   *                       . *    *     *   *                *  
    *      *                         .    *         *                  *  
   *  *  *   *                       . *    *     *   *                *  
  *    *       *                    *.         *         *            * * 
 *    *  *        *              *   .      *     *        *         * *  
 *  *       *        *       *       .  *            *        *    *   *  
 *                  *         *      .                       *      *     
`);
  });
});