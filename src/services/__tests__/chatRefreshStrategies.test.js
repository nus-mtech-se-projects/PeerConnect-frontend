import {
  createNoopRefreshStrategy,
  createPollingRefreshStrategy,
  resolveChatRefreshStrategy,
} from "../chatRefreshStrategies";

describe("chatRefreshStrategies", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polling strategy invokes refresh on an interval and stops on cleanup", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const strategy = createPollingRefreshStrategy(1000);

    const stop = strategy.start(refresh);
    expect(strategy.mode).toBe("polling");

    vi.advanceTimersByTime(2500);
    expect(refresh).toHaveBeenCalledTimes(2);

    stop();
    vi.advanceTimersByTime(1000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("polling strategy returns a noop stop when callback is invalid", () => {
    vi.useFakeTimers();
    const stop = createPollingRefreshStrategy().start(null);

    expect(() => stop()).not.toThrow();
  });

  it("manual strategy never schedules refresh work", () => {
    const strategy = createNoopRefreshStrategy();
    const stop = strategy.start();

    expect(strategy.mode).toBe("manual");
    expect(() => stop()).not.toThrow();
  });

  it("resolves strategy names to polling or manual implementations", () => {
    expect(resolveChatRefreshStrategy("manual").mode).toBe("manual");
    expect(resolveChatRefreshStrategy("polling").mode).toBe("polling");
    expect(resolveChatRefreshStrategy("unknown").mode).toBe("polling");
  });
});
