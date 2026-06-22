import { GWBasicInterpreter } from '../interpreter';

describe('Statistical Functions', () => {
  let outputs: any[] = [];
  let interpreter: GWBasicInterpreter;

  beforeEach(() => {
    outputs = [];
    interpreter = new GWBasicInterpreter(
      (output) => outputs.push(output),
      async () => 'test'
    );
  });

  it('SUM with variadic arguments', async () => {
    const code = `10 PRINT SUM(1, 2, 3, 4, 5)`;
    await interpreter.run(code);
    expect(outputs[0].value).toBe('15\n');
  });

  it('SUM with array and n', async () => {
    const code = `10 DIM A(5)
20 FOR I = 0 TO 4
30 A(I) = (I + 1) * 2
40 NEXT I
50 PRINT SUM(A, 5)`;
    await interpreter.run(code);
    expect(outputs[0].value).toBe('30\n');
  });

  it('AVG with variadic arguments', async () => {
    const code = `10 PRINT AVG(10, 20, 30, 40, 50)`;
    await interpreter.run(code);
    expect(outputs[0].value).toBe('30\n');
  });

  it('AVG with array and n', async () => {
    const code = `10 DIM A(4)
20 FOR I = 0 TO 3
30 A(I) = (i + 1) * 10
40 NEXT I
50 PRINT AVG(A, 4)`;
    await interpreter.run(code);
    console.log(interpreter.getVariables());
    expect(outputs[0].value).toBe('25\n');
  });

  it('SUMPROD with variadic arguments', async () => {
    const code = `10 PRINT SUMPROD(1, 2, 3, 4, 5, 6)`;
    await interpreter.run(code);
    expect(outputs[0].value).toBe('44\n'); // 1*2 + 3*4 + 5*6 = 2 + 12 + 30 = 44
  });

  it('SUMPROD with arrays and n', async () => {
    const code = `10 DIM A(3), B(3)
20 FOR I = 0 TO 2
30 A(I) = I + 1
40 B(I) = (I + 1) * 2
50 NEXT I
60 PRINT SUMPROD(A, B, 3)`;
    await interpreter.run(code);
    expect(outputs[0].value).toBe('28\n'); // 1*2 + 2*4 + 3*6 = 2 + 8 + 18 = 28
  });

  it('AVGP with variadic arguments', async () => {
    const code = `10 PRINT AVGP(10, 2, 20, 3, 30, 4)`;
    await interpreter.run(code);
    expect(outputs[0].value).toBe('6.666666666666667\n'); // (10+20+30)/(2+3+4) = 60/9 = 6.667
  });

  it('AVGP with arrays and n', async () => {
    const code = `10 DIM A(4), B(4)
20 FOR I = 0 TO 3
30 A(I) = (I + 5) * 10
40 B(I) = I + 4
50 NEXT I
60 PRINT AVGP(A, B, 4)`;
    await interpreter.run(code);
    expect(outputs[0].value).toBe('11.818181818181818\n'); // (50+60+70+80)/(4+5+6+7) = 260/22 = 11.818...
  });

  it('MIN with variadic arguments', async () => {
    const code = `10 PRINT MIN(5, 2, 8, 1, 9)`;
    await interpreter.run(code);
    expect(outputs[0].value).toBe('1\n');
  });

  it('MIN with array and n', async () => {
    const code = `10 DIM A(4)
20 FOR I = 0 TO 3
30 A(I) = 10 - I
40 NEXT I
50 PRINT MIN(A, 4)`;
    await interpreter.run(code);
    expect(outputs[0].value).toBe('7\n'); // min of 10, 9, 8, 7
  });

  it('MAX with variadic arguments', async () => {
    const code = `10 PRINT MAX(5, 2, 8, 1, 9)`;
    await interpreter.run(code);
    expect(outputs[0].value).toBe('9\n');
  });

  it('MAX with array and n', async () => {
    const code = `10 DIM A(4)
20 FOR I = 0 TO 3
30 A(I) = I * 3
40 NEXT I
50 PRINT MAX(A, 4)`;
    await interpreter.run(code);
    expect(outputs[0].value).toBe('9\n'); // max of 0, 3, 6, 9
  });

  it('VARIP with variadic arguments', async () => {
    const code = `10 PRINT VARIP(2, 4, 4, 4, 5, 5, 7, 9)`;
    await interpreter.run(code);
    const result = parseFloat(outputs[0].value);
    expect(result).toBeCloseTo(4.571428571428571, 5); // Sample variance of the dataset
  });

  it('VARIP with array and n', async () => {
    const code = `10 DIM A(5)
20 FOR I = 0 TO 4
30 A(I) = I * 2
40 NEXT I
50 PRINT VARIP(A, 5)`;
    await interpreter.run(code);
    const result = parseFloat(outputs[0].value);
    expect(result).toBeCloseTo(10, 5); // Variance of 0, 2, 4, 6, 8
  });

  it('STDP with variadic arguments', async () => {
    const code = `10 PRINT STDP(2, 4, 4, 4, 5, 5, 7, 9)`;
    await interpreter.run(code);
    const result = parseFloat(outputs[0].value);
    expect(result).toBeCloseTo(2.138, 2); // Sample standard deviation
  });

  it('STDP with array and n', async () => {
    const code = `10 DIM A(5)
20 FOR I = 0 TO 4
30 A(I) = I * 2
40 NEXT I
50 PRINT STDP(A, 5)`;
    await interpreter.run(code);
    const result = parseFloat(outputs[0].value);
    expect(result).toBeCloseTo(3.16227766, 5); // Std dev of 0, 2, 4, 6, 8
  });

  it('MEDIAN with variadic arguments (odd count)', async () => {
    const code = `10 PRINT MEDIAN(1, 3, 5, 7, 9)`;
    await interpreter.run(code);
    expect(outputs[0].value).toBe('5\n');
  });

  it('MEDIAN with variadic arguments (even count)', async () => {
    const code = `10 PRINT MEDIAN(1, 2, 3, 4)`;
    await interpreter.run(code);
    expect(outputs[0].value).toBe('2.5\n');
  });

  it('MEDIAN with array and n', async () => {
    const code = `10 DIM A(5)
20 FOR I = 0 TO 4
30 A(I) = 10 - I
40 NEXT I
50 PRINT MEDIAN(A, 5)`;
    await interpreter.run(code);
    expect(outputs[0].value).toBe('8\n'); // Median of 10, 9, 8, 7, 6
  });
});