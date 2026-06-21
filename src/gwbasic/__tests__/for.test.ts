import { describe, it, expect } from 'vitest';
import { GWBasicInterpreter } from '../interpreter';
import { Lexer } from '../lexer';
import { Parser } from '../parser';

describe('FOR...NEXT', () => {
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
    return outputs.filter(o => o.type === 'print').map(o => o.value).join('').trim();
  }

  it('should execute FOR loop', async () => {
    const code = `
10 FOR I = 1 TO 5
20 PRINT I;
30 NEXT I
40 END`;
    await interpreter.run(code);
    const printOutput = getOutput();
    expect(printOutput).toContain('1');
    expect(printOutput).toContain('2');
    expect(printOutput).toContain('3');
    expect(printOutput).toContain('4');
    expect(printOutput).toContain('5');
  });

  it('should handle FOR loop in one line', async () => {
    const code = `
10 FOR I = 1 TO 5: PRINT I;: NEXT I: END`;
    await interpreter.run(code);
    const printOutput = getOutput();
    expect(printOutput).toBe('12345');
  });

  it('should execute FOR loop with positive step', async () => {
    const code = `
10 FOR I = 1 TO 10 STEP 2
20 PRINT I;
30 NEXT I
40 END`;
    await interpreter.run(code);
    const printOutput = getOutput();
    expect(printOutput).toContain('1');
    expect(printOutput).toContain('3');
    expect(printOutput).toContain('5');
    expect(printOutput).toContain('7');
    expect(printOutput).toContain('9');
  });

  it('should execute FOR loop with negative step', async () => {
    const code = `
10 FOR I = 10 TO 1 STEP -2
20 PRINT I;
30 NEXT I
40 END`;
    await interpreter.run(code);
    const printOutput = getOutput();
    expect(printOutput).toContain('10');
    expect(printOutput).toContain('8');
    expect(printOutput).toContain('6');
    expect(printOutput).toContain('4');
    expect(printOutput).toContain('2');
  });

  it('should handle nested FOR loops', async () => {
    const code = `
10 FOR I = 1 TO 2
20   FOR J = 1 TO 2
30     PRINT I; J; ",";
40   NEXT J
50 NEXT I
60 END`;
    await interpreter.run(code);
    const printOutput = getOutput();
    expect(printOutput).toContain('11,');
    expect(printOutput).toContain('12,');
    expect(printOutput).toContain('21,');
    expect(printOutput).toContain('22,');
  });

  it('should handle nested FOR loops in one line', async () => {
    const code = `
10 FOR I = 1 TO 2: FOR J = 1 TO 2: PRINT I; J; ",": NEXT J: NEXT I: END`;
    await interpreter.run(code);
    const printOutput = getOutput();
    expect(printOutput).toContain('11,');
    expect(printOutput).toContain('12,');
    expect(printOutput).toContain('21,');
    expect(printOutput).toContain('22,');
  });

  it('should handle FOR loop with variable step', async () => {
    const code = `
10 LET ST = 3
20 FOR I = 1 TO 20 STEP ST
30 PRINT I;
40 NEXT I
50 END`;
    await interpreter.run(code);
    const printOutput = getOutput();
    expect(printOutput).toContain('1');
    expect(printOutput).toContain('4');
    expect(printOutput).toContain('7');
    expect(printOutput).toContain('10');
    expect(printOutput).toContain('13');
    expect(printOutput).toContain('16');
    expect(printOutput).toContain('19');
  });

  it('should handle FOR loop with variable start and end', async () => {
    const code = `
10 LET S = 12
20 LET E = 18
30 FOR I = S TO E
40 PRINT I;
50 NEXT I
60 END`;
    await interpreter.run(code);
    const printOutput = getOutput();
    expect(printOutput).toContain('12');
    expect(printOutput).toContain('13');
    expect(printOutput).toContain('14');
    expect(printOutput).toContain('15');
    expect(printOutput).toContain('16');
    expect(printOutput).toContain('17');
    expect(printOutput).toContain('18');
  });

  it('should handle FOR loop with variable start, end, and step', async () => {
    const code = `
10 LET S = 30
20 LET E = 15
30 LET ST = -7
40 FOR I = S TO E STEP ST
50 PRINT I;",";
60 NEXT I
70 END`;
    await interpreter.run(code);
    const printOutput = getOutput();
    expect(printOutput).toContain('30,');
    expect(printOutput).toContain('23,');
    expect(printOutput).toContain('16,');
  });

  it('should handle FOR loop with same variable start and end (positive step)', async () => {
    const code = `
10 FOR I = 5 TO 5
20 PRINT I
30 NEXT I
40 END`;
    await interpreter.run(code);
    const printOutput = getOutput();
    expect(printOutput).toBe('5');
  });

  it('should handle FOR loop with same variable start and end (negative step)', async () => {
    const code = `
10 FOR I = 15 TO 15 STEP -1
20 PRINT I
30 NEXT I
40 END`;
    await interpreter.run(code);
    const printOutput = getOutput();
    expect(printOutput).toBe('15');
  });

}); 
