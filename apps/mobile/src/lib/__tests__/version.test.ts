import { compareVersions, isBelowMinimum } from '../version';

describe('versões', () => {
  it('compara numericamente', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBe(1);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.9.9', '1.0.0')).toBe(-1);
  });
  it('versão mínima', () => {
    expect(isBelowMinimum('1.0.0', '1.1.0')).toBe(true);
    expect(isBelowMinimum('1.1.0', '1.1.0')).toBe(false);
    expect(isBelowMinimum(null, '9.9.9')).toBe(false);
  });
});
