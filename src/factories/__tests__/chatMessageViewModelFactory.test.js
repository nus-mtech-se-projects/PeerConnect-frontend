import { createChatMessageViewModel } from "../chatMessageViewModelFactory";

describe("chatMessageViewModelFactory", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-05-08T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps a full message into the chat view model", () => {
    vi.useFakeTimers();
    const vm = createChatMessageViewModel({
      id: "m1",
      senderName: "Alice",
      senderEmail: "alice@u.nus.edu",
      content: "Hello",
      sentAt: "2026-05-08T09:15:00Z",
      attachment: {
        id: "a1",
        fileName: "diagram.png",
        contentType: "image/png",
        fileSize: 123,
        downloadUrl: "/download",
        image: true,
      },
    }, "ALICE@u.nus.edu");

    expect(vm).toEqual({
      id: "m1",
      senderName: "Alice",
      senderEmail: "alice@u.nus.edu",
      content: "Hello",
      sentAtLabel: expect.stringMatching(/\d{2}\/\d{2}\/2026 \d{2}:\d{2}/),
      sentAt: "2026-05-08T09:15:00Z",
      isMine: true,
      attachment: {
        id: "a1",
        fileName: "diagram.png",
        contentType: "image/png",
        fileSize: 123,
        downloadUrl: "/download",
        isImage: true,
      },
    });
  });

  it("uses fallback values for sparse messages", () => {
    vi.useFakeTimers();
    const vm = createChatMessageViewModel({}, "");

    expect(vm.id).toMatch(/^tmp-/);
    expect(vm.senderName).toBe("Group member");
    expect(vm.content).toBe("");
    expect(vm.attachment).toBeNull();
    expect(vm.sentAtLabel).toBe("");
    expect(vm.isMine).toBe(false);
  });

  it("falls back to sender email and preserves invalid timestamp labels", () => {
    const vm = createChatMessageViewModel({
      senderEmail: "bob@u.nus.edu",
      sentAt: "not-a-date",
    }, "viewer@u.nus.edu");

    expect(vm.senderName).toBe("bob@u.nus.edu");
    expect(vm.sentAtLabel).toBe("not-a-date");
    expect(vm.isMine).toBe(false);
  });
});
