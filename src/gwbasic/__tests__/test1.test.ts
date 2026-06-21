import { describe, it, expect } from 'vitest';
import { GWBasicInterpreter } from '../interpreter';
import { Lexer } from '../lexer';
import { Parser } from '../parser';

describe('Mes tests - Test1', () => {
  let outputs: any[] = [];
    let interpreter: GWBasicInterpreter = new GWBasicInterpreter(
      (output) => outputs.push(output),
      async () => 'test'
    );

    beforeEach(() => {
      outputs = [];
      interpreter = new GWBasicInterpreter(
        (output) => outputs.push(output),
        async () => 'test'
      );
    });

  it('Test1', async () => {
    const code = `10 CLS
20 PRINT "Hello"
20 PRINT "There"`;
    await expect(interpreter.run(code)).rejects.toThrow("Error: Duplicate line number 20 at line 3");
  });

  it('Test2', async () => {
    const code = `10 LET A = 5"
20 LET B = 6
30 LET C = A + B
40 PRINT A, B, C`;
    await expect(interpreter.run(code)).rejects.toThrow('Error: Unterminated string at line 10');
  });

  it('Fonction non standard $ch(ind)', async () => {
    const code = `10 LET ch1$ = "AHMED" : ch2$ = "ABDOU"
20 ch1$(4) = "A"
30 FOR I = 97 TO 96 + LEN(ch2$) : ch2$(I - 96) = chr$(I) : NEXT I
40 ch3$ = ch1$(1) + ch1$(3) + ch1$(5)`;
    await interpreter.run(code);
    const variables = interpreter.getVariables();

    expect(variables.get('CH1$')).toBe('AHMAD');
    expect(variables.get('CH2$')).toBe('abcde');
    expect(variables.get('CH3$')).toBe('AMD');
  });

  it('Fonctions ATAN2 et HYPO', async () => {
    const code = `10 LET x = 3 : y = 2
20 m = HYPO(x, y) : a = ATAN2(x, y)`;
        await interpreter.run(code);
        const variables = interpreter.getVariables();
        console.log(variables);
        expect(variables.get('X')).toBe(3);
        expect(variables.get('Y')).toBe(2);
    
  });
});
