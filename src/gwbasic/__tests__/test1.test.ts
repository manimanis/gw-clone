import { describe, it, expect } from 'vitest';
import { GWBasicInterpreter } from '../interpreter';

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
    expect(variables.get('X')).toBe(3);
    expect(variables.get('Y')).toBe(2);
    expect(variables.get('M')).toBeCloseTo(Math.sqrt(3*3 + 2*2));
    expect(variables.get('A')).toBeCloseTo(Math.atan2(2, 3));
  });

  it('Dim avec une seule dimension', async() => {
    const code = `10 DIM A(10)
20 FOR I = 0 TO 9
30 A(I) = I * 2 + 1
40 NEXT I`;
    await interpreter.run(code);
    const variables = interpreter.getVariables();
    expect(variables.get('A')).toBeDefined();
    expect(variables.get('A')!.data).toEqual([1,3,5,7,9,11,13,15,17,19]);
  });

  it ('Chercher un élément dans un tableau', async () => {
    const code = `10 DIM A(10)
20 FOR I = 0 TO 9 : A(I) = (I MOD 5 + 1) * 5 : NEXT I
30 LET B = 25
40 LET P1 = FIND(B, A, 10)
50 LET P2 = FIND(39, A, 10)
60 LET P3 = FIND(B, A, 10, P1 + 1)
`;
    await interpreter.run(code);
    const variables = interpreter.getVariables();
    expect(variables.get('P1')).toBe(4);
    expect(variables.get('P2')).toBe(-1);
    expect(variables.get('P3')).toBe(9);
  });

  it('CALL INVERT - inverser les éléments d un tableau', async () => {
    const code = `10 DIM A(10)
20 FOR I = 0 TO 9 : A(I) = I + 1 : NEXT I
30 CALL INVERT(A, 0, 10)
`;
    await interpreter.run(code);
    const variables = interpreter.getVariables();
    expect(variables.get('A')!.data).toEqual([10,9,8,7,6,5,4,3,2,1]);
  });

  it('CALL INVERT - inverser une partie du tableau', async () => {
    const code = `10 DIM A(10)
20 FOR I = 0 TO 9 : A(I) = I : NEXT I
30 CALL INVERT(A, 2, 6)
`;
    await interpreter.run(code);
    const variables = interpreter.getVariables();
    expect(variables.get('A')!.data).toEqual([0,1,5,4,3,2,6,7,8,9]);
  });

  it('CALL SORT - trier une partie du tableau', async () => {
    const code = `10 DIM A(10)
20 A(0)=5 : A(1)=3 : A(2)=8 : A(3)=1 : A(4)=9 : A(5)=2 : A(6)=7 : A(7)=4 : A(8)=0 : A(9)=6
30 CALL SORT(A, 2, 7)
`;
    await interpreter.run(code);
    const variables = interpreter.getVariables();
    // Elements 2 to 6 (inclusive) are [8,1,9,2,7], after sort: [1,2,7,8,9]
    expect(variables.get('A')!.data).toEqual([5,3,1,2,7,8,9,4,0,6]);
  });

  it('CALL SORT - trier tout le tableau', async () => {
    const code = `10 DIM A(10)
20 DATA 5,3,8,1,9,2,7,4,0,6
30 FOR I = 0 TO 9 : READ A(I) : NEXT I
40 CALL SORT(A, 0, 10)
`;
    await interpreter.run(code);
    const variables = interpreter.getVariables();
    console.log(variables);
    expect(variables.get('A')!.data).toEqual([0,1,2,3,4,5,6,7,8,9]);
  });
});
