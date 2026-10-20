import { parseDurationToSeconds } from './duration';

describe('parseDurationToSeconds', () => {
  it.each([
    ['900', 900],
    ['30s', 30],
    ['15m', 900],
    ['1h', 3600],
    ['7d', 604800],
  ])('%s → %d', (input, expected) => {
    expect(parseDurationToSeconds(input)).toBe(expected);
  });

  it('rechaza formatos inválidos', () => {
    expect(() => parseDurationToSeconds('15 minutes')).toThrow();
  });
});
