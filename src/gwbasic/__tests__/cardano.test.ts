import { describe, it, expect } from 'vitest';
import { GWBasicInterpreter } from '../interpreter';

const code = `10 CLS
20 PRINT "Resolution d'une equation cubique : ax^3 + bx^2 + cx + d = 0"
30 INPUT "Donner a, b, c, d"; A, B, C, D

40 IF A = 0 THEN PRINT "Ce n'est pas une equation du 3e degre": END

50 ' Reduction : x = y - b/(3a)
60 P = (3*A*C - B^2) / (3*A^2)
70 Q = (2*B^3 - 9*A*B*C + 27*A^2*D) / (27*A^3)

80 PRINT "Equation reduite : y^3 + p*y + q = 0"
90 PRINT "p = "; P; "   q = "; Q

100 ' Discriminant
110 DELTA = (Q/2)^2 + (P/3)^3
120 PRINT "Delta = "; DELTA

130 IF DELTA >= 0 THEN GOTO 200 ELSE GOTO 300

200 ' ===== CAS DELTA >= 0 =====
210 U = SGN(-Q/2 + SQR(DELTA)) * ABS(-Q/2 + SQR(DELTA))^(1/3)
220 V = SGN(-Q/2 - SQR(DELTA)) * ABS(-Q/2 - SQR(DELTA))^(1/3)

230 Y = U + V
240 X = Y - B / (3*A)

250 PRINT "Une racine reelle : ";
260 PRINT X

270 END

300 ' ===== CAS DELTA < 0 : 3 RACINES REELLES =====
310 PI = 3.14159265

320 R = 2 * SQR(-P/3)
330 T = -Q / (2 * SQR((-P/3)^3))

340 ' Calcul ACOS(T) (approximation)
350 AC = ATN(-T / SQR(1 - T*T)) + PI/2

360 Y1 = R * COS(AC / 3)
370 Y2 = R * COS((AC + 2*PI) / 3)
380 Y3 = R * COS((AC + 4*PI) / 3)

390 X1 = Y1 - B / (3*A)
400 X2 = Y2 - B / (3*A)
410 X3 = Y3 - B / (3*A)

420 PRINT "Trois racines reelles :"
430 PRINT "x1 = "; X1
440 PRINT "x2 = "; X2
450 PRINT "x3 = "; X3

460 END`;

describe('Méthode de Cardano - équation de 3e degré', () => {
  let outputs: any[];
  let interpreter: GWBasicInterpreter;
  let inputs: Function = () => '';

  beforeEach(() => {
    outputs = [];
    interpreter = new GWBasicInterpreter(
      (output) => outputs.push(output),
      async () => inputs()
    );
  });

  it('Une seule solution', async () => {
    inputs = () => '1,2,3,4';
    await interpreter.run(code);
    const variables = interpreter.getVariables();
    expect(variables.get('A')).toBe(1);
    expect(variables.get('B')).toBe(2);
    expect(variables.get('C')).toBe(3);
    expect(variables.get('D')).toBe(4);
    expect(variables.get('P')).toBeCloseTo(1.667, 3);
    expect(variables.get('Q')).toBeCloseTo(2.593, 3);
    expect(variables.get('DELTA')).toBeCloseTo(1.852, 3);
    expect(variables.get('U')).toBeCloseTo(0.401, 3);
    expect(variables.get('V')).toBeCloseTo(-1.385, 3);
    expect(variables.get('Y')).toBeCloseTo(-0.984, 3);
    expect(variables.get('X')).toBeCloseTo(-1.651, 3);
  });

  it('Trois solutions', async () => {
    inputs = () => '1,0,-6,4';
    await interpreter.run(code);
    const variables = interpreter.getVariables();
    expect(variables.get('A')).toBe(1);
    expect(variables.get('B')).toBe(0);
    expect(variables.get('C')).toBe(-6);
    expect(variables.get('D')).toBe(4);
    expect(variables.get('P')).toBe(-6);
    expect(variables.get('Q')).toBe(4);
    expect(variables.get('DELTA')).toBe(-4);
    expect(variables.get('X1')).toBeCloseTo(2.000, 3);
    expect(variables.get('X2')).toBeCloseTo(-2.732, 3);
    expect(variables.get('X3')).toBeCloseTo(0.732, 3);
  });

});