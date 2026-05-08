import {
  downloadGroupChatAttachment,
  fetchAccessibleGroupChats,
  fetchGroupChatAttachmentBlob,
  fetchGroupChatMessages,
  fetchGroupChatMessagesByChatId,
  fetchGroupChatSummary,
  fetchGroupChatSummaryByChatId,
  sendGroupChatMessage,
  sendGroupChatMessageByChatId,
  sendGroupChatMessageWithAttachmentByChatId,
} from "../groupChatService";

describe("groupChatService", () => {
  beforeEach(() => {
    localStorage.setItem("accessToken", "chat-token");
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockJsonResponse(payload, ok = true, status = 200) {
    globalThis.fetch.mockResolvedValueOnce({
      ok,
      status,
      json: async () => payload,
    });
  }

  it("fetches accessible group chats with auth headers", async () => {
    mockJsonResponse([{ id: "c1" }]);

    await expect(fetchAccessibleGroupChats()).resolves.toEqual([{ id: "c1" }]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/group-chats"),
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({ Authorization: "Bearer chat-token" }),
      })
    );
  });

  it.each([
    [fetchGroupChatSummaryByChatId, "chat-1", "/api/group-chats/chat-1"],
    [fetchGroupChatMessagesByChatId, "chat-1", "/api/group-chats/chat-1/messages"],
    [fetchGroupChatSummary, "42", "/api/groups/42/chat"],
    [fetchGroupChatMessages, "42", "/api/groups/42/chat/messages"],
  ])("GET helper calls the expected endpoint", async (fn, id, path) => {
    mockJsonResponse({ id });

    await expect(fn(id)).resolves.toEqual({ id });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining(path),
      expect.objectContaining({ credentials: "include" })
    );
  });

  it.each([
    [sendGroupChatMessageByChatId, "chat-1", "/api/group-chats/chat-1/messages"],
    [sendGroupChatMessage, "42", "/api/groups/42/chat/messages"],
  ])("POST helper sends message content as JSON", async (fn, id, path) => {
    mockJsonResponse({ id: "m1", content: "hello" });

    await expect(fn(id, "hello")).resolves.toEqual({ id: "m1", content: "hello" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining(path),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "hello" }),
      })
    );
  });

  it("throws the server error field for failed JSON responses", async () => {
    mockJsonResponse({ error: "No access" }, false, 403);

    await expect(fetchAccessibleGroupChats()).rejects.toThrow("No access");
  });

  it("uses fallback error text when failed response body is not JSON", async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("bad json");
      },
    });

    await expect(fetchGroupChatSummary("42")).rejects.toThrow("Failed to load chat summary (500)");
  });

  it("fetches attachment blobs with content type fallback", async () => {
    const blob = new Blob(["file"]);
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => blob,
      headers: { get: () => "" },
    });

    await expect(fetchGroupChatAttachmentBlob("att-1")).resolves.toEqual({
      blob,
      contentType: "application/octet-stream",
    });
  });

  it("throws when attachment fetch fails", async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(fetchGroupChatAttachmentBlob("missing")).rejects.toThrow("Failed to fetch attachment (404)");
  });

  it("downloads an attachment through a temporary anchor", async () => {
    const blob = new Blob(["file"]);
    const appendChild = vi.spyOn(document.body, "appendChild");
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const anchor = document.createElement("a");
    const click = vi.spyOn(anchor, "click").mockImplementation(() => {});
    const remove = vi.spyOn(anchor, "remove").mockImplementation(() => {});
    const createElement = vi.spyOn(document, "createElement").mockReturnValue(anchor);
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => blob,
      headers: { get: () => "text/plain" },
    });

    await downloadGroupChatAttachment({ id: "att-1", fileName: "notes.txt" });

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(createElement).toHaveBeenCalledWith("a");
    expect(appendChild).toHaveBeenCalled();
    expect(anchor.download).toBe("notes.txt");
    expect(click).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  it("uploads an attachment with progress and authorization", async () => {
    const progress = vi.fn();
    const setRequestHeader = vi.fn();
    const send = vi.fn(function send() {
      this.upload.onprogress({ lengthComputable: true, loaded: 5, total: 10 });
      this.status = 201;
      this.responseText = '{"id":"m1"}';
      this.onload();
    });
    const open = vi.fn();

    vi.stubGlobal("XMLHttpRequest", vi.fn(function XhrMock() {
      this.upload = {};
      this.open = open;
      this.setRequestHeader = setRequestHeader;
      this.send = send;
    }));

    await expect(sendGroupChatMessageWithAttachmentByChatId("chat-1", "hi", new File(["x"], "x.txt"), progress))
      .resolves.toEqual({ id: "m1" });

    expect(open).toHaveBeenCalledWith(
      "POST",
      expect.stringContaining("/api/group-chats/chat-1/messages/with-attachment")
    );
    expect(setRequestHeader).toHaveBeenCalledWith("Authorization", "Bearer chat-token");
    expect(progress).toHaveBeenCalledWith(50);
  });

  it("rejects failed attachment uploads with parsed server errors", async () => {
    vi.stubGlobal("XMLHttpRequest", vi.fn(function XhrMock() {
      this.upload = {};
      this.open = vi.fn();
      this.setRequestHeader = vi.fn();
      this.send = vi.fn(function send() {
        this.status = 413;
        this.responseText = '{"error":"Too large"}';
        this.onload();
      });
    }));

    await expect(sendGroupChatMessageWithAttachmentByChatId("chat-1", "", new File(["x"], "x.txt")))
      .rejects.toThrow("Too large");
  });
});
