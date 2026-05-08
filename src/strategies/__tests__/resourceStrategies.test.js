import {
  ExternalResourceStrategy,
  NUSResourceStrategy,
  ResourceContext,
  createResourceStrategy,
} from "../resourceStrategies";

function makeToken(payload) {
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

describe("resourceStrategies", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("returns NUS resource content", () => {
    const strategy = new NUSResourceStrategy();

    expect(strategy.getUserLabel()).toBe("NUS Community");
    expect(strategy.getUserDescription()).toMatch(/NUS students and staff/i);
    expect(strategy.getSections()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "counselling",
          resources: expect.arrayContaining([
            expect.objectContaining({ name: expect.stringContaining("University Counselling") }),
          ]),
        }),
      ])
    );
  });

  it("returns external Singapore resource content", () => {
    const strategy = new ExternalResourceStrategy();

    expect(strategy.getUserLabel()).toBe("Singapore Community");
    expect(strategy.getUserDescription()).toMatch(/everyone in Singapore/i);
    expect(strategy.getSections()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "helplines",
          resources: expect.arrayContaining([
            expect.objectContaining({ phone: "1767" }),
          ]),
        }),
      ])
    );
  });

  it("ResourceContext delegates to the active strategy and can switch", () => {
    const context = new ResourceContext(new ExternalResourceStrategy());

    expect(context.getUserLabel()).toBe("Singapore Community");
    context.setStrategy(new NUSResourceStrategy());
    expect(context.getUserLabel()).toBe("NUS Community");
    expect(context.getSections()[0].id).toBe("counselling");
  });

  it("creates NUS strategy for staff and student token domains", () => {
    localStorage.setItem("accessToken", makeToken({ email: "staff@nus.edu.sg" }));
    expect(createResourceStrategy()).toBeInstanceOf(NUSResourceStrategy);

    localStorage.setItem("accessToken", makeToken({ sub: "student@u.nus.edu" }));
    expect(createResourceStrategy()).toBeInstanceOf(NUSResourceStrategy);
  });

  it("falls back to external strategy for missing, non-NUS, and malformed tokens", () => {
    expect(createResourceStrategy()).toBeInstanceOf(ExternalResourceStrategy);

    localStorage.setItem("accessToken", makeToken({ email: "person@example.com" }));
    expect(createResourceStrategy()).toBeInstanceOf(ExternalResourceStrategy);

    localStorage.setItem("accessToken", "not-a-token");
    expect(createResourceStrategy()).toBeInstanceOf(ExternalResourceStrategy);
  });
});
