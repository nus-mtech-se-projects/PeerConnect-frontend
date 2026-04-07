export function createPollingRefreshStrategy(intervalMs = 8000) {
  return {
    mode: "polling",
    start(onRefresh) {
      if (typeof onRefresh !== "function") return () => {};
      const id = window.setInterval(() => {
        onRefresh();
      }, intervalMs);
      return () => window.clearInterval(id);
    },
  };
}

export function createNoopRefreshStrategy() {
  return {
    mode: "manual",
    start() {
      return () => {};
    },
  };
}

export function resolveChatRefreshStrategy(strategyName = "polling") {
  if (strategyName === "manual") return createNoopRefreshStrategy();
  return createPollingRefreshStrategy();
}
