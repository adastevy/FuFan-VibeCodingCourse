import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock heavy modules before importing the module under test
vi.mock('wechat-ilink-client', () => ({
  WeChatClient: vi.fn(),
  MessageType: { USER: 'USER' },
}));
vi.mock('../env.js', () => ({ readEnvFile: vi.fn().mockReturnValue({ WECHAT_ENABLED: 'false' }) }));
vi.mock('../config.js', () => ({ DATA_DIR: '/tmp/wechat-test' }));
vi.mock('../log.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../modules/daily-news/db.js', () => ({
  markAllFailedForDate: vi.fn(),
  insertItems: vi.fn(),
  markFailed: vi.fn(),
  getPendingRepush: vi.fn(),
}));
vi.mock('../db/connection.js', () => ({ getDb: vi.fn().mockReturnValue({}) }));
vi.mock('./channel-registry.js', () => ({ registerChannelAdapter: vi.fn() }));

import { deliverText } from './wechat.js';
import { markAllFailedForDate } from '../modules/daily-news/db.js';

const mockMarkAllFailed = vi.mocked(markAllFailedForDate);

describe('deliverText (FR-009 retry + backoff)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMarkAllFailed.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns msgId on first successful attempt', async () => {
    const sendText = vi.fn().mockResolvedValue('msg-001');
    const onFail = vi.fn();
    const result = await deliverText({ sendText } as any, 'GROUP1', 'hello', 'wechat:GROUP1', onFail);
    expect(result).toBe('msg-001');
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(onFail).not.toHaveBeenCalled();
  });

  it('retries and succeeds on third attempt', async () => {
    let calls = 0;
    const sendText = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error(`fail ${calls}`);
      return 'msg-ok';
    });
    const onFail = vi.fn();

    const promise = deliverText({ sendText } as any, 'G', 'text', 'wechat:G', onFail);
    // Drain the first failure then advance 1 s backoff
    await vi.advanceTimersByTimeAsync(1000);
    // Drain second failure then advance 3 s backoff
    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(result).toBe('msg-ok');
    expect(sendText).toHaveBeenCalledTimes(3);
    expect(onFail).not.toHaveBeenCalled();
  });

  it('calls onFinalFailure and returns undefined when all 3 attempts fail', async () => {
    const sendText = vi.fn().mockRejectedValue(new Error('permanent'));
    const onFail = vi.fn();

    const promise = deliverText({ sendText } as any, 'G', 'text', 'wechat:G', onFail);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBeUndefined();
    expect(sendText).toHaveBeenCalledTimes(3);
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it('does not call onFinalFailure on partial failure (2 fails, 1 success)', async () => {
    let calls = 0;
    const sendText = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error('transient');
      return 'msg-recovered';
    });
    const onFail = vi.fn();

    const promise = deliverText({ sendText } as any, 'G', 'text', 'wechat:G', onFail);
    await vi.runAllTimersAsync();
    await promise;

    expect(onFail).not.toHaveBeenCalled();
  });
});
