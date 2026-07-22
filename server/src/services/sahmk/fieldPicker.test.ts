import { asRecord } from './fieldPicker';

describe('asRecord', () => {
  it('يُعيد الكائن نفسه إذا كان كائنًا عاديًا فعليًا', () => {
    const obj = { a: 1, b: 'x' };
    expect(asRecord(obj)).toBe(obj);
  });

  it('يُعيد كائنًا فارغًا لو القيمة نص - يمنع تفكيك النص لحروف عبر {...قيمة}', () => {
    // مؤكَّد فعليًا: key_metrics لسهم 2222 وصل كنص "core" بدل كائن، وتفكك
    // صامتًا لـ {0:"c",1:"o",2:"r",3:"e"} قبل هذا الإصلاح.
    expect(asRecord('core')).toEqual({});
  });

  it('يُعيد كائنًا فارغًا لو القيمة undefined أو null', () => {
    expect(asRecord(undefined)).toEqual({});
    expect(asRecord(null)).toEqual({});
  });

  it('يُعيد كائنًا فارغًا لو القيمة رقم أو مصفوفة (وليس كائن مفاتيح-قيم)', () => {
    expect(asRecord(42)).toEqual({});
    expect(asRecord(['a', 'b'])).toEqual({});
  });
});
