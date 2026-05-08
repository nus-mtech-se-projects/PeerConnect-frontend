import {
  PROFILE_UPDATED_EVENT,
  emitProfileUpdated,
  extractAvatarUrl,
  subscribeProfileUpdated,
} from "../profileSync";

describe("profileSync", () => {
  it.each([
    [{ avatarUrl: " https://cdn/avatar.png " }, "https://cdn/avatar.png"],
    [{ avatar: null }, ""],
    [{ profile: { avatar: { url: " https://cdn/profile.png " } } }, "https://cdn/profile.png"],
    [{ user: { avatar: { src: " https://cdn/user.png " } } }, "https://cdn/user.png"],
    [{ image: 123 }, "123"],
    [{ nothing: true }, null],
    [null, null],
  ])("extracts avatar URL from supported shapes", (entity, expected) => {
    expect(extractAvatarUrl(entity)).toBe(expected);
  });

  it("emits and subscribes to profile update events", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeProfileUpdated(handler);

    emitProfileUpdated({ avatarUrl: "avatar.png", profileName: "Alice" });

    expect(handler).toHaveBeenCalledWith({ avatarUrl: "avatar.png", profileName: "Alice" });

    unsubscribe();
    emitProfileUpdated({ avatarUrl: "next.png" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("uses an empty detail object when event detail is missing", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeProfileUpdated(handler);

    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT));

    expect(handler).toHaveBeenCalledWith({});
    unsubscribe();
  });
});
