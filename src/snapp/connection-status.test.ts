import { describe, expect, it } from 'vitest';

import { summarizeSnappConnection } from './connection-status';

describe('SnappShop connection summary', () => {
  it('reports active branches as a successful connection', () => {
    const result = summarizeSnappConnection({
      status: true,
      data: [{ id: '1', status: ' ACTIVE ' }, { id: '2', status: 'INACTIVE' }],
    });

    expect(result.severity).toBe('success');
    expect(result.branchCount).toBe(2);
    expect(result.activeBranches).toBe(1);
  });

  it('separates valid credentials from branch activation', () => {
    const result = summarizeSnappConnection({ status: true, data: [] });

    expect(result.registered).toBe(true);
    expect(result.severity).toBe('warning');
    expect(result.activeBranches).toBe(0);
  });
});
