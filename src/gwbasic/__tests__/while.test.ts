import { describe, it, expect } from 'vitest';  
import { GWBasicInterpreter } from '../interpreter'; 
import { Lexer } from '../lexer'; 
import { Parser } from '../parser'; 
  
describe('WHILE...WEND', () => {
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

  it('exécute un WHILE simple qui itère 3 fois', async () => {
    const code = `
10 I = 1
20 WHILE I <= 3
30   PRINT I
40   I = I + 1
50 WEND
60 PRINT "DONE"
    `;

    await interpreter.run(code);
    const output = getOutput();

    expect(output).toBe('1\n2\n3\nDONE');
  });

  it('n\'exécute PAS le corps si la condition est fausse dès le début', async () => {
    const code = `
10 I = 10
20 WHILE I <= 3
30   PRINT I
40   I = I + 1
50 WEND
60 PRINT "END"
    `;

    await interpreter.run(code);
    const output = getOutput();

    expect(output).toBe('END');
  });

  it('exécute un WHILE sur une seule ligne avec séparateur :', async () => {
    const code = '10 I = 1 : WHILE I <= 3 : PRINT I : I = I + 1 : WEND : PRINT "DONE"';

    await interpreter.run(code);
    const output = getOutput();

    expect(output).toBe('1\n2\n3\nDONE');
  });

  it('exécute des WHILE imbriqués', async () => {
    const code = `
10 I = 1
20 WHILE I <= 5
30   J = 1
40   WHILE J <= 5
50     PRINT I * J
60     J = J + 1
70   WEND
80   I = I + 1
90 WEND
    `;

    await interpreter.run(code);
    const output = getOutput();

    // 1*1=1, 1*2=2, 1*3=3, 1*4=4, 1*5=5, 2*1=2, 2*2=4, 2*3=6, 2*4=8, 2*5=10, 3*1=3, 3*2=6, 3*3=9, 3*4=12, 3*5=15, 4*1=4, 4*2=8, 4*3=12, 4*4=16, 4*5=20, 5*1=5, 5*2=10, 5*3=15, 5*4=20, 5*5=25
    expect(output).toEqual('1\n2\n3\n4\n5\n2\n4\n6\n8\n10\n3\n6\n9\n12\n15\n4\n8\n12\n16\n20\n5\n10\n15\n20\n25');
  });

  // NOTE: EXIT WHILE n'est pas encore supporté car l'implémentation actuelle
  // de ExitWhileStatement met running = false ce qui arrête tout le programme
  // au lieu de juste la boucle WHILE.
  
  it('WHILE avec condition utilisant une variable string', async () => {
    const code = `
10 A$ = "OUI"
20 WHILE A$ = "OUI"
30   PRINT "BOUCLE"
40   A$ = "NON"
50 WEND
60 PRINT "FIN"
    `;
    await interpreter.run(code);
    const output = getOutput();

    expect(output).toEqual('BOUCLE\nFIN');
  });

  it('WHILE avec PRINT et point-virgule (pas de saut de ligne)', async () => {
    const code = '10 I = 1 : WHILE I <= 10 : PRINT I; : I = I + 1 : WEND';
    await interpreter.run(code);
    const output = getOutput();

    // Avec PRINT I; les valeurs sont concaténées sur la même ligne
    expect(output).toBe('12345678910');
  });
}); 
