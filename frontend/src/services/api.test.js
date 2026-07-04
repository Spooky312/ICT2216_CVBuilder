import { vi, describe, it, expect, beforeEach } from 'vitest';

const getMock = vi.fn(() => Promise.resolve({ data: {} }));

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: getMock,
      post: vi.fn(() => Promise.resolve({ data: {} })),
      put: vi.fn(() => Promise.resolve({ data: {} })),
      delete: vi.fn(() => Promise.resolve({ data: {} })),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }),
  },
}));

// Imported after the mock is registered.
const { adminGetAuditLog } = await import('./api');

describe('adminGetAuditLog query building', () => {
  beforeEach(() => getMock.mockClear());

  it('includes paging and non-empty filters, skips empty values', async () => {
    await adminGetAuditLog(2, 50, {
      event: 'login',
      user_id: '',
      ip: null,
      missing: undefined,
    });
    const url = getMock.mock.calls[0][0];
    expect(url).toContain('page=2');
    expect(url).toContain('per_page=50');
    expect(url).toContain('event=login');
    expect(url).not.toContain('user_id=');
    expect(url).not.toContain('ip=');
    expect(url).not.toContain('missing=');
  });

  it('uses defaults when no arguments are given', async () => {
    await adminGetAuditLog();
    const url = getMock.mock.calls[0][0];
    expect(url).toContain('page=1');
    expect(url).toContain('per_page=100');
  });
});
