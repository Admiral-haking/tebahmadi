import { describe, expect, it } from 'vitest';

import { calculateSettlementNet, validateJournalLines } from './financialService';

describe('accounting journal rules', () => {
  it('requires balanced debit and credit lines', () => {
    expect(validateJournalLines([
      { accountCode: '1101', debit: 1000 },
      { accountCode: '4101', credit: 1000 },
    ])).toEqual({ debit: 1000, credit: 1000 });
    expect(() => validateJournalLines([{ accountCode: '1101', debit: 1000 }])).toThrow(
      'journal_requires_two_lines',
    );
  });

  it('calculates settlement net after fees and deductions', () => {
    expect(calculateSettlementNet(100000, 5000, 2000, 1000)).toBe(92000);
    expect(() => calculateSettlementNet(1000, 1001)).toThrow('invalid_settlement_net');
  });
});
