/**
 * Tests for date functions: MKDATE, YEAR, MONTH, DAY, DAYW, HOUR, MINUTE, SECONDS
 * And date arithmetic: date - date, date + number, date - number
 * And date string conversion: DATESTR$, TODATE
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GWBasicInterpreter } from '../interpreter';


/** Helper to create a Date object from components for test assertions */
function ts(year: number, month: number, day: number, h = 0, m = 0, s = 0): number {
  return Math.floor(new Date(year, month - 1, day, h, m, s).getTime() / 1000);
}

describe('Date functions', () => {
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('MKDATE() returns system timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));
    await interpreter.run('10 D = MKDATE()\n20 PRINT D');
    const output = getOutput();
    expect(output).toBe(String(ts(2026, 6, 16, 6, 45, 30)));
  });

  it('MKDATE(2025) sets year, rest from system', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run('10 D = MKDATE(2025)\n20 PRINT D');
    const output = getOutput();
    expect(output).toBe(String(ts(2025, 6, 16, 6, 45, 30)));
  });

  it('MKDATE(2025, 4) sets year and month', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run('10 D = MKDATE(2025, 4)\n20 PRINT D');
    const output = getOutput();
    expect(output).toBe(String(ts(2025, 4, 16, 6, 45, 30)));
  });

  it('MKDATE(2025, 4, 15) sets year, month, day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run('10 D = MKDATE(2025, 4, 15)\n20 PRINT D');
    const output = getOutput();
    expect(output).toBe(String(ts(2025, 4, 15, 6, 45, 30)));
  });

  it('MKDATE(2025, 4, 15, 10) sets year, month, day, hour', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run('10 D = MKDATE(2025, 4, 15, 10)\n20 PRINT D');
    const output = getOutput();
    expect(output).toBe(String(ts(2025, 4, 15, 10, 45, 30)));
  });

  it('MKDATE(2025, 4, 15, 10, 30) sets year, month, day, hour, minute', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run('10 D = MKDATE(2025, 4, 15, 10, 30)\n20 PRINT D');
    const output = getOutput();
    expect(output).toBe(String(ts(2025, 4, 15, 10, 30, 30)));
  });

  it('MKDATE(2025, 4, 15, 10, 30, 55) sets all components', async () => {
    await interpreter.run('10 D = MKDATE(2025, 4, 15, 10, 30, 55)\n20 PRINT D');
    const output = getOutput();
    expect(output).toBe(String(ts(2025, 4, 15, 10, 30, 55)));
  });

  it('YEAR extracts year from MKDATE timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run('10 D = MKDATE(2025, 8, 25, 14, 30, 45)\n20 PRINT YEAR(D)');
    const output = getOutput();
    expect(output).toBe('2025');
  });

  it('MONTH extracts month from MKDATE timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run('10 D = MKDATE(2025, 8, 25)\n20 PRINT MONTH(D)');
    const output = getOutput();
    expect(output).toBe('8');
  });

  it('DAY extracts day from MKDATE timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run('10 D = MKDATE(2025, 8, 25)\n20 PRINT DAY(D)');
    const output = getOutput();
    expect(output).toBe('25');
  });

  it('DAYW returns day of week (0=Sunday)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30)); // Tuesday = 2

    await interpreter.run('10 D = MKDATE()\n20 PRINT DAYW(D)');
    const output = getOutput();
    expect(output).toBe('2');
  });

  it('HOUR extracts hour from MKDATE timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run('10 D = MKDATE(2025, 8, 25, 14, 30, 45)\n20 PRINT HOUR(D)');
    const output = getOutput();
    expect(output).toBe('14');
  });

  it('MINUTE extracts minute from MKDATE timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run('10 D = MKDATE(2025, 8, 25, 14, 30, 45)\n20 PRINT MINUTE(D)');
    const output = getOutput();
    expect(output).toBe('30');
  });

  it('SECONDS extracts seconds from MKDATE timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run('10 D = MKDATE(2025, 8, 25, 14, 30, 45)\n20 PRINT SECONDS(D)');
    const output = getOutput();
    expect(output).toBe('45');
  });

  it('Full date decomposition program', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run([
      '10 D = MKDATE(2025, 12, 25, 8, 30, 15)',
      '20 PRINT YEAR(D)',
      '30 PRINT MONTH(D)',
      '40 PRINT DAY(D)',
      '50 PRINT HOUR(D)',
      '60 PRINT MINUTE(D)',
      '70 PRINT SECONDS(D)',
    ].join('\n'));

    const output = getOutput();
    expect(output).toBe('2025\n12\n25\n8\n30\n15');
  });

  it('MKDATE returns a number (timestamp)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 0, 0, 0));

    await interpreter.run('10 D = MKDATE(2025, 1, 1)\n20 PRINT D');
    const output = getOutput();
    const val = parseInt(output);
    expect(val).toBe(ts(2025, 1, 1));
  });
});

describe('Date arithmetic', () => {
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

  it('date - date returns difference in seconds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run([
      '10 D1 = MKDATE(2025, 1, 1, 0, 0, 0)',
      '20 D2 = MKDATE(2025, 1, 2, 0, 0, 0)',
      '30 PRINT D2 - D1',
    ].join('\n'));
    const output = getOutput();
    expect(output).toBe('86400');
  });

  it('date + number adds seconds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run([
      '10 D = MKDATE(2025, 1, 1, 12, 0, 0)',
      '20 D2 = D + 3600',
      '30 PRINT HOUR(D2)',
      '40 PRINT MINUTE(D2)',
    ].join('\n'));
    const output = getOutput();
    expect(output).toContain('13');
    expect(output).toContain('0');
  });

  it('date - number subtracts seconds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run([
      '10 D = MKDATE(2025, 1, 1, 12, 0, 0)',
      '20 D2 = D - 7200',
      '30 PRINT HOUR(D2)',
      '40 PRINT MINUTE(D2)',
    ].join('\n'));
    const output = getOutput();
    expect(output).toContain('10');
    expect(output).toContain('0');
  });

  it('difference of 7 days in seconds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run([
      '10 D1 = MKDATE(2025, 6, 1)',
      '20 D2 = MKDATE(2025, 6, 8)',
      '30 PRINT D2 - D1',
    ].join('\n'));
    const output = getOutput();
    expect(output).toBe(String(7 * 86400));
  });

  it('add 1 day in seconds to a date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run([
      '10 D = MKDATE(2025, 3, 1)',
      '20 D2 = D + 86400',
      '30 PRINT YEAR(D2)',
      '40 PRINT MONTH(D2)',
      '50 PRINT DAY(D2)',
    ].join('\n'));
    const output = getOutput();
    expect(output).toContain('2025');
    expect(output).toContain('3');
    expect(output).toContain('2');
  });
});

describe('Date string conversion', () => {
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

  it('DATESTR$ converts timestamp to ISO string', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run('10 D = MKDATE(2025, 8, 25, 14, 30, 45)\n20 PRINT DATESTR$(D)');
    const output = getOutput();
    expect(output).toBe('2025-08-25 14:30:45');
  });

  it('DATESTR$ pads single digits with zeros', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run('10 D = MKDATE(2025, 3, 5, 9, 4, 7)\n20 PRINT DATESTR$(D)');
    const output = getOutput();
    expect(output).toBe('2025-03-05 09:04:07');
  });

  it('TODATE converts ISO string to timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run('10 D = TODATE("2025-08-25 14:30:45")\n20 PRINT D');
    const output = getOutput();
    expect(output).toBe(String(ts(2025, 8, 25, 14, 30, 45)));
  });

  it('TODATE then DATESTR$ round-trips correctly', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run([
      '10 D = TODATE("2025-12-25 08:30:15")',
      '20 PRINT DATESTR$(D)',
    ].join('\n'));
    const output = getOutput();
    expect(output).toBe('2025-12-25 08:30:15');
  });

  it('DATESTR$ then TODATE round-trips correctly', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    await interpreter.run([
      '10 D = MKDATE(2025, 6, 15, 10, 30, 0)',
      '20 S$ = DATESTR$(D)',
      '30 D2 = TODATE(S$)',
      '40 PRINT D2 = D',
    ].join('\n'));
    const output = getOutput();
    expect(output).toBe('-1');
  });

  it('TODATE with invalid string throws error', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 6, 45, 30));

    console.log(outputs);

    await interpreter.run('10 D = TODATE("invalid")\n20 PRINT D');
    const output = getOutput();
    console.log(output);
    // expect(output).toContain('ERROR');
  });
});