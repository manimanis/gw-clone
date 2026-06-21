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
    const code = `   10 REM Brent's Method for root finding   K Moerman 2026
   20 REM adapted from wikipedia pseudocode:
   30 REM https://en.wikipedia.org/wiki/Brent%27s_method#Algorithm
   40 GOTO 100
   50 REM ***********  PARAMETERS  ***********
   60 REM Equation will be f(x)=0
   70 f=EXP(-x)-SIN(x)
   80 RETURN
   90 REM Lower and upper limits of x interval
  100 a = 0.0: b = 3.0
  110 REM Maximum error
  120 e = 1E-5
  130 REM ***********  MAIN CODE  ***********
  140 PRINT "Brent's Method for root finding"
  150 PRINT "-------------------------------"
  160 x=a: GOSUB 70: fa=f
  170 x=b: GOSUB 70: fb=f
  180 IF fa*fb>=0 THEN GOTO 690: REM error, root is not bracketed
  190 IF ABS(fa)>ABS(fb) THEN GOTO 220
  200 tp=a: a=b: b=tp: REM swap a and b
  210 tp=fa: fa=fb: fb=tp: REM swap fa and fb
  220 c=a: fm=-1: REM fm=true
  230 x=c: GOSUB 70: fc=f
  240 fs=fb: tl=2*e: k=1: d=c
  250 REM ***** start main loop  *****
  260 IF fs=0 OR ABS(b-a)<=tl THEN GOTO 620: REM root found, terminate loop
  270 IF fa<>fc AND fb<>fc THEN GOTO 310
  280 s=b-fb*(b-a)/(fb-fa): REM secant method
  290 m$ = "secant method"
  300 GOTO 350
  310 s=a*fb*fc/((fa-fb)*(fa-fc)): REM inverse quadratic interpolation method
  320 s=s+b*fa*fc/((fb-fa)*(fb-fc))
  330 s=s+c*fa*fb/((fc-fa)*(fc-fb))
  340 m$ = "inverse quadratic method"
  350 su=(3*a+b)/4: sl=b: REM limits for value s
  360 IF su>sl THEN GOTO 390
  370 tp=sl: sl=su: su=tp: REM swap values
  380 REM if one flag is True bisection method has to be used:
  390 f1=s<sl OR s>su
  400 f2=(fm=-1) AND (ABS(s-b)>=ABS(b-c)/2)
  410 f3=(fm=0) AND (ABS(s-b)>=ABS(c-d)/2)
  420 f4=(fm=-1) AND (ABS(b-c)<e)
  430 f5=(fm=0) AND (ABS(c-d)<e)
  440 IF f1 OR f2 OR f3 OR f4 OR f5 THEN GOTO 460
  450 fm=0: GOTO 480
  460 s=(a+b)/2: fm=-1: REM bisection method
  470 m$ = "bisection method"
  480 x=s: GOSUB 70: fs=f
  490 d=c: c=b: fc=fb
  500 IF fa*fs<0 THEN GOTO 520
  510 a=s: fa=fs: GOTO 530: REM fa,fs same sign
  520 b=s: fb=fs: REM fa,fs different sign
  530 IF ABS(fa)>=ABS(fb) THEN GOTO 560
  540 tp=a: a=b: b=tp
  550 tp=fa: fa=fb: fb=tp
  560 tl=2*e: IF ABS(s)>1 THEN tl=tl*ABS(s)
  570 PRINT "root x=",s;"  ";m$
  580 k=k+1
  590 GOTO 260
  600 REM *** end of main loop ***
  610 REM root finding has finished
  620 PRINT "Root found in ";k-1;" steps"
  630 PRINT "x= ";s
  640 x=s: GOSUB 70: resid=f
  650 PRINT "Residual value:"
  660 PRINT "f(";s;") = ";resid
  670 END
  680 REM error message
  690 PRINT "Root is not bracketed, f(a) and f(b) have same sign"
  700 END`;

    await interpreter.run(code);
    const output = getOutput();
    expect(output).toBe(`Brent's Method for root finding
-------------------------------
root x= 2.748931962822145  secant method
root x= 1.3744659814110725  bisection method
root x= 0.6872329907055362  bisection method
root x= 0.5659457742759418  inverse quadratic method
root x= 0.5894591923865306  secant method
root x= 0.58854103321549  secant method
root x= 0.5885327439214227  inverse quadratic method
Root found in 7 steps
x= 0.5885327439214227
Residual value:
f(0.5885327439214227) = 8.382183835919932e-11
`);
  });
});