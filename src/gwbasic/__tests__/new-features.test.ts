import { GWBasicInterpreter } from '../interpreter';

describe('New Features', () => {
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

  describe('Base conversion functions', () => {
    it('should evaluate OCT$ function', async () => {
      await interpreter.run(`
10 A$ = OCT$(255)
20 PRINT A$
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('377');
    });

    it('should evaluate HEX$ function', async () => {
      await interpreter.run(`
10 A$ = HEX$(255)
20 PRINT A$
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('FF');
    });

    it('should evaluate BIN$ function', async () => {
      await interpreter.run(`
10 A$ = BIN$(10)
20 PRINT A$
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('1010');
    });
  });

  describe('String functions', () => {
    it('should evaluate INSTRI function (case-insensitive)', async () => {
      await interpreter.run(`
10 A = INSTRI("Hello World", "WORLD")
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('7');
    });

    it('should evaluate SPLIT$ function', async () => {
      await interpreter.run(`
10 A$ = "a,b,c"
20 DIM arr(3)
30 arr = SPLIT$(A$)
40 PRINT arr(0)
50 PRINT arr(1)
60 PRINT arr(2)
70 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('a');
      expect(printOutput).toContain('b');
      expect(printOutput).toContain('c');
    });
  });

  describe('Array functions', () => {
    it('should evaluate PERCENTILE function', async () => {
      await interpreter.run(`
10 DIM A(6)
20 FOR I = 0 TO 5
30 READ A(I)
40 NEXT I
50 DATA 1,2,3,4,5,6
60 P = PERCENTILE(A, 6, 50)
70 PRINT P
80 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('3');
    });

    it('should evaluate CONCAT function', async () => {
      await interpreter.run(`
10 DIM A(4)
20 DIM B(4)
30 DIM C(8)
40 FOR I = 0 TO 3
50 A(I) = I
60 B(I) = I + 10
70 NEXT I
80 C = CONCAT(A, B)
90 PRINT C(0)
100 PRINT C(3)
110 PRINT C(4)
120 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('0');
      expect(printOutput).toContain('3');
      expect(printOutput).toContain('10');
    });

    it('should evaluate BSEARCH function', async () => {
      await interpreter.run(`
10 DIM A(10)
20 FOR I = 0 TO 9
30 A(I) = I * 2
40 NEXT I
50 P = BSEARCH(6, A, 10)
60 PRINT P
70 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('3');
    });
  });

  describe('DEF FN', () => {
    it('should define and use custom function', async () => {
      await interpreter.run(`
10 DEF FNSQUARE(X) = X * X
20 A = FNSQUARE(5)
30 PRINT A
40 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('25');
    });
  });

  describe('RENUM', () => {
    it('should renumber program lines', async () => {
      await interpreter.run(`
10 PRINT "A"
20 PRINT "B"
30 PRINT "C"
      `);
      
      // Use executeDirect for RENUM command
      await interpreter.executeDirect('RENUM 100, 20');
      const listing = interpreter.list();
      expect(listing).toContain('100 PRINT "A"');
      expect(listing).toContain('120 PRINT "B"');
      expect(listing).toContain('140 PRINT "C"');
    });
  });

});
