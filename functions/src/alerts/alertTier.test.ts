import { determineAlertTier } from './alertTier';

describe('determineAlertTier', () => {
  it('يُعيد null لما دون 70', () => {
    expect(determineAlertTier(69)).toBeNull();
    expect(determineAlertTier(0)).toBeNull();
  });

  it('يصنّف النطاقات الثلاثة بشكل صحيح', () => {
    expect(determineAlertTier(70)).toBe('70-79');
    expect(determineAlertTier(79)).toBe('70-79');
    expect(determineAlertTier(80)).toBe('80-89');
    expect(determineAlertTier(89)).toBe('80-89');
    expect(determineAlertTier(90)).toBe('90-100');
    expect(determineAlertTier(100)).toBe('90-100');
  });
});
