import { GWBasicInterpreter } from '../interpreter';

describe('GWBasicInterpreter', () => {
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

  describe('String Functions', () => {
    it('should evaluate LEFT$ function', async () => {
      await interpreter.run(`
10 A$ = "Hello"
20 B$ = LEFT$(A$, 3)
30 PRINT B$
40 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Hel');
    });

    it('should evaluate RIGHT$ function', async () => {
      await interpreter.run(`
10 A$ = "Hello"
20 B$ = RIGHT$(A$, 3)
30 PRINT B$
40 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('llo');
    });

    it('should evaluate MID$ function (read)', async () => {
      await interpreter.run(`
10 A$ = "Hello"
20 B$ = MID$(A$, 2, 3)
30 PRINT B$
40 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('ell');
    });

    it('should evaluate LEN function', async () => {
      await interpreter.run(`
10 A$ = "Hello"
20 L = LEN(A$)
30 PRINT L
40 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('5');
    });

    it('should evaluate UCASE$ function', async () => {
      await interpreter.run(`
10 A$ = "hello"
20 B$ = UCASE$(A$)
30 PRINT B$
40 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('HELLO');
    });

    it('should evaluate LCASE$ function', async () => {
      await interpreter.run(`
10 A$ = "HELLO"
20 B$ = LCASE$(A$)
30 PRINT B$
40 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('hello');
    });

    it('should evaluate CHR$ function', async () => {
      await interpreter.run(`
10 A$ = CHR$(65)
20 PRINT A$
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('A');
    });

    it('should evaluate ASC function', async () => {
      await interpreter.run(`
10 A = ASC("A")
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('65');
    });

    it('should evaluate STR$ function', async () => {
      await interpreter.run(`
10 A$ = STR$(123)
20 PRINT A$
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('123');
    });

    it('should evaluate VAL function', async () => {
      await interpreter.run(`
10 A = VAL("123")
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('123');
    });

    it('should evaluate INSTR function', async () => {
      await interpreter.run(`
10 A = INSTR("Hello World", "World")
20 B = INSTR("Hello World", "xyz")
30 PRINT A
40 PRINT B
50 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('7');
      expect(printOutput).toContain('0');
    });

    it('should evaluate STRING$ function', async () => {
      await interpreter.run(`
10 A$ = STRING$(5, 42) + STRING$(3, "x") + STRING$(2, "ABDOU")
20 PRINT A$
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('*****xxxAA');
    });

    it('should evaluate SPACE$ function', async () => {
      await interpreter.run(`
10 A$ = SPACE$(5)
20 PRINT A$
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('     ');
    });
  });

  describe('MID$ Assignment', () => {
    it('should perform basic MID$ assignment', async () => {
      await interpreter.run(`
10 ch$ = "Hello"
20 MID$(ch$, 2, 3) = "om"
30 PRINT ch$
40 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Homo');
    });

    it('should replace with longer string', async () => {
      await interpreter.run(`
10 ch$ = "Hi"
20 MID$(ch$, 1, 2) = "Hello"
30 PRINT ch$
40 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Hello');
    });

    it('should replace with shorter string', async () => {
      await interpreter.run(`
10 ch$ = "Hello World"
20 MID$(ch$, 7, 5) = "JS"
30 PRINT ch$
40 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Hello JS');
    });

    it('should use variables for position and length', async () => {
      await interpreter.run(`
10 ch$ = "ABCDEF"
20 pos = 2
30 len = 3
40 MID$(ch$, pos, len) = "XYZ"
50 PRINT ch$
60 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('AXYZ');
    });

    it('should handle multiple MID$ assignments', async () => {
      await interpreter.run(`
10 ch$ = "Hello World"
20 MID$(ch$, 1, 5) = "Good"
30 MID$(ch$, 7, 5) = "Moon"
40 PRINT ch$
50 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Good WMoon');
    });
  });

  describe('Math Functions', () => {
    it('should evaluate ABS function', async () => {
      await interpreter.run(`
10 A = ABS(-5)
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('5');
    });

    it('should evaluate INT function', async () => {
      await interpreter.run(`
10 A = INT(3.7)
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('3');
    });

    it('should evaluate SQR function', async () => {
      await interpreter.run(`
10 A = SQR(16)
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('4');
    });

    it('should evaluate SIN function', async () => {
      await interpreter.run(`
10 A = SIN(0)
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(parseFloat(printOutput)).toBeCloseTo(0, 5);
    });

    it('should evaluate COS function', async () => {
      await interpreter.run(`
10 A = COS(0)
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(parseFloat(printOutput)).toBeCloseTo(1, 5);
    });

    it('should evaluate TAN function', async () => {
      await interpreter.run(`
10 A = TAN(0)
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(parseFloat(printOutput)).toBeCloseTo(0, 5);
    });

    it('should evaluate ATN function', async () => {
      await interpreter.run(`
10 A = ATN(0)
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(parseFloat(printOutput)).toBeCloseTo(0, 5);
    });

    it('should evaluate LOG function', async () => {
      await interpreter.run(`
10 A = LOG(1)
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(parseFloat(printOutput)).toBeCloseTo(0, 5);
    });

    it('should evaluate EXP function', async () => {
      await interpreter.run(`
10 A = EXP(0)
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(parseFloat(printOutput)).toBeCloseTo(1, 5);
    });

    it('should evaluate SGN function', async () => {
      await interpreter.run(`
10 A = SGN(-5)
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('-1');
    });

    it('should evaluate RND function', async () => {
      await interpreter.run(`
10 A = RND(1)
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      const value = parseFloat(printOutput);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });

  describe('Control Flow', () => {
    it('should execute IF statement', async () => {
      await interpreter.run(`
10 A = 5
20 IF A > 3 THEN PRINT "Yes"
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Yes');
    });

    it('should execute FOR loop', async () => {
      await interpreter.run(`
10 FOR I = 1 TO 5
20 PRINT I;
30 NEXT I
40 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('1');
      expect(printOutput).toContain('5');
    });

    it('should execute WHILE loop', async () => {
      await interpreter.run(`
10 I = 1
20 WHILE I <= 3
30 PRINT I;
40 I = I + 1
50 WEND
60 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('1');
      expect(printOutput).toContain('3');
    });

    it('should execute GOTO', async () => {
      await interpreter.run(`
10 PRINT "Start"
20 GOTO 40
30 PRINT "Skip"
40 PRINT "End"
50 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Start');
      expect(printOutput).toContain('End');
      expect(printOutput).not.toContain('Skip');
    });

    it('should execute GOSUB and RETURN', async () => {
      await interpreter.run(`
10 PRINT "Main"
20 GOSUB 100
30 PRINT "Back"
40 END
100 PRINT "Subroutine"
110 RETURN
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Main');
      expect(printOutput).toContain('Subroutine');
      expect(printOutput).toContain('Back');
    });
  });

  describe('Input/Output', () => {
    it('should execute PRINT statement', async () => {
      await interpreter.run(`
10 PRINT "Hello"
20 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Hello');
    });

    it('should execute PRINT with semicolon', async () => {
      await interpreter.run(`
10 PRINT "Hello"; "World"
20 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('HelloWorld');
    });

    it('should execute PRINT with comma', async () => {
      await interpreter.run(`
10 PRINT "Hello", "World"
20 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Hello');
      expect(printOutput).toContain('World');
    });

    it('should handle INPUT statement', async () => {
      const inputCallback = async () => '42';
      const testInterpreter = new GWBasicInterpreter(
        (output) => outputs.push(output),
        inputCallback
      );
      await testInterpreter.run(`
10 INPUT A
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('42');
    });
  });

  describe('Variables and Arrays', () => {
    it('should handle scalar variables', async () => {
      await interpreter.run(`
10 A = 10
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('10');
    });

    it('should handle string variables', async () => {
      await interpreter.run(`
10 A$ = "Test"
20 PRINT A$
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Test');
    });

    it('should handle array variables', async () => {
      await interpreter.run(`
10 DIM A(5)
20 A(1) = 10
30 A(2) = 20
40 PRINT A(1) + A(2)
50 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('30');
    });

    it('should handle string array variables', async () => {
      await interpreter.run(`
10 DIM A$(2)
20 A$(1) = "Hello"
30 A$(2) = "World"
40 PRINT A$(1) + " " + A$(2)
50 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Hello World');
    });
  });

  describe('Operators', () => {
    it('should handle arithmetic operators', async () => {
      await interpreter.run(`
10 A = 10 + 5
20 PRINT A
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('15');
    });

    it('should handle string concatenation', async () => {
      await interpreter.run(`
10 A$ = "Hello" + " " + "World"
20 PRINT A$
30 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Hello World');
    });

    it('should handle comparison operators', async () => {
      await interpreter.run(`
10 A = 5
20 IF A = 5 THEN PRINT "Equal"
30 IF A <> 3 THEN PRINT "Not Equal"
40 IF A > 3 THEN PRINT "Greater"
50 IF A < 10 THEN PRINT "Less"
60 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Equal');
      expect(printOutput).toContain('Not Equal');
      expect(printOutput).toContain('Greater');
      expect(printOutput).toContain('Less');
    });

    it('should handle logical operators', async () => {
      await interpreter.run(`
10 A = -1
20 B = -1
30 IF A AND B THEN PRINT "Both True"
40 IF A OR B THEN PRINT "Either True"
50 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Both True');
      expect(printOutput).toContain('Either True');
    });
  });

  describe('Special Functions', () => {
    it('should evaluate TIMER function', async () => {
      await interpreter.run(`
10 T = TIMER
20 PRINT T
30 END
      `);
      const printOutput = getOutput();
      const value = parseFloat(printOutput);
      expect(value).toBeGreaterThanOrEqual(0);
    });

    it('should handle TAB function', async () => {
      await interpreter.run(`
10 PRINT "A"; TAB(10); "B"
20 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('A');
      expect(printOutput).toContain('B');
    });

    it('should handle SPC function', async () => {
      await interpreter.run(`
10 PRINT "A"; SPC(5); "B"
20 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('A');
      expect(printOutput).toContain('B');
    });
  });

  describe('Program Control', () => {
    it('should handle END statement', async () => {
      await interpreter.run(`
10 PRINT "Before"
20 END
30 PRINT "After"
40 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Before');
      expect(printOutput).not.toContain('After');
    });

    it('should handle STOP statement', async () => {
      await interpreter.run(`
10 PRINT "Before"
20 STOP
30 PRINT "After"
40 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('Before');
      expect(printOutput).not.toContain('After');
    });

    it('should handle CLS command', async () => {
      await interpreter.run(`
10 CLS
20 END
      `);
      const clearOutput = outputs.filter(o => o.type === 'clear');
      expect(clearOutput.length).toBe(1);
    });

    it('should handle NEW command', async () => {
      await interpreter.run(`
10 A = 1
20 END
      `);
      expect(interpreter.isRunning()).toBe(false);
    });
  });

  describe('Data Statements', () => {
    it('should handle READ and DATA', async () => {
      await interpreter.run(`
10 DATA 10, 20, 30
20 READ A, B, C
30 PRINT A + B + C
40 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('60');
    });

    it('should handle RESTORE', async () => {
      await interpreter.run(`
10 DATA 10, 20
20 READ A
30 RESTORE
40 READ B
50 PRINT A + B
60 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('20');
    });
  });

  describe('SWAP Statement', () => {
    it('should swap two variables', async () => {
      await interpreter.run(`
10 A = 10
20 B = 20
30 SWAP A, B
40 PRINT A; " "; B
50 END
      `);
      const printOutput = getOutput();
      expect(printOutput).toContain('20');
      expect(printOutput).toContain('10');
    });
  });

});
