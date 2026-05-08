import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GroupChatsNavList from "../GroupChatsNavList";
import GroupChatMessageList from "../GroupChatMessageList";
import GroupChatComposer from "../GroupChatComposer";
import GroupChatPanel from "../GroupChatPanel";
import GroupChatWorkspace from "../GroupChatWorkspace";
import { groupChatService } from "../../../services/groupChatService";
import { resolveChatRefreshStrategy } from "../../../services/chatRefreshStrategies";

vi.mock("../../../services/groupChatService", () => ({
  fetchGroupChatAttachmentBlob: vi.fn(),
  downloadGroupChatAttachment: vi.fn(),
  groupChatService: {
    fetchGroupChatMessagesByChatId: vi.fn(),
    sendGroupChatMessageByChatId: vi.fn(),
    sendGroupChatMessageWithAttachmentByChatId: vi.fn(),
  },
}));

vi.mock("../../../services/chatRefreshStrategies", () => ({
  resolveChatRefreshStrategy: vi.fn(),
}));

describe("group chat components", () => {
  beforeEach(() => {
    resolveChatRefreshStrategy.mockReturnValue({
      mode: "manual",
      start: vi.fn(() => vi.fn()),
    });
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading and empty states in the chat nav", () => {
    const select = vi.fn();
    const { rerender } = render(
      <GroupChatsNavList chats={[]} activeChatId="" onSelectChat={select} loading />
    );

    expect(screen.getByText(/loading chats/i)).toBeInTheDocument();

    rerender(<GroupChatsNavList chats={[]} activeChatId="" onSelectChat={select} loading={false} />);
    expect(screen.getByText(/no joined group chats/i)).toBeInTheDocument();
  });

  it("renders chat nav items, active state, counts, and selection", () => {
    const select = vi.fn();
    render(
      <GroupChatsNavList
        activeChatId="c2"
        onSelectChat={select}
        chats={[
          { chatId: "c1", groupName: "Algorithms", messageCount: 0 },
          { chatId: "c2", groupName: "Databases", messageCount: 5 },
        ]}
      />
    );

    expect(screen.getByText("Algorithms")).toBeInTheDocument();
    expect(screen.getByText("Databases").closest("button")).toHaveClass("active");
    expect(screen.getByText("5")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Algorithms"));
    expect(select).toHaveBeenCalledWith("c1");
  });

  it("renders message list loading, empty, mine, and attachment states", async () => {
    const { fetchGroupChatAttachmentBlob, downloadGroupChatAttachment } = await import("../../../services/groupChatService");
    fetchGroupChatAttachmentBlob.mockResolvedValue({ blob: new Blob(["image"]) });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:image");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const { rerender } = render(<GroupChatMessageList messages={[]} loading />);
    expect(screen.getByText(/loading chat messages/i)).toBeInTheDocument();

    rerender(<GroupChatMessageList messages={[]} loading={false} />);
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();

    rerender(
      <GroupChatMessageList
        loading={false}
        messages={[
          {
            id: "m1",
            senderName: "Alice",
            content: "Here is a note",
            sentAtLabel: "08/05/2026 10:00",
            isMine: true,
            attachment: {
              id: "att1",
              fileName: "note.png",
              fileSize: 2048,
              isImage: true,
            },
          },
        ]}
      />
    );

    expect(screen.getByRole("log")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Here is a note")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
    expect(await screen.findByAltText("note.png")).toHaveAttribute("src", "blob:image");

    fireEvent.click(screen.getByText("Download"));
    expect(downloadGroupChatAttachment).toHaveBeenCalledWith(expect.objectContaining({ id: "att1" }));
  });

  it("shows attachment metadata without image preview for non-image attachments", () => {
    render(
      <GroupChatMessageList
        loading={false}
        messages={[
          {
            id: "m1",
            senderName: "Alice",
            content: "PDF",
            sentAtLabel: "",
            isMine: false,
            attachment: {
              id: "att1",
              fileName: "notes.pdf",
              fileSize: 1,
              isImage: false,
            },
          },
        ]}
      />
    );

    expect(screen.getByText("notes.pdf")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("composer sends text, inserts emoji, and restores draft when send fails", async () => {
    const user = userEvent.setup();
    const send = vi.fn().mockResolvedValueOnce(false);
    render(<GroupChatComposer onSend={send} />);

    await user.type(screen.getByPlaceholderText(/type your message/i), "hello");
    await user.click(screen.getByText("Emoji"));
    await user.click(screen.getByText("😀"));
    await user.click(screen.getByText("Send"));

    expect(send).toHaveBeenCalledWith({ content: "hello😀", file: null });
    expect(screen.getByPlaceholderText(/type your message/i)).toHaveValue("hello😀");
  });

  it("composer handles file selection, removal, progress, and disabled state", async () => {
    const user = userEvent.setup();
    const send = vi.fn().mockResolvedValue(true);
    const { rerender } = render(<GroupChatComposer onSend={send} uploadProgress={40} />);
    const input = document.querySelector('input[type="file"]');
    const file = new File(["data"], "notes.txt", { type: "text/plain" });

    await user.upload(input, file);
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(screen.getByText(/uploading attachment: 40%/i)).toBeInTheDocument();

    await user.click(screen.getByText("Remove"));
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();

    await user.upload(input, file);
    await user.click(screen.getByText("Send"));
    expect(send).toHaveBeenCalledWith({ content: "", file });

    rerender(<GroupChatComposer onSend={send} disabled />);
    expect(screen.getByText("Attach")).toBeDisabled();
    expect(screen.getByText("Emoji")).toBeDisabled();
  });

  it("panel wires refresh and send callbacks", async () => {
    const refresh = vi.fn();
    const send = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();

    render(
      <GroupChatPanel
        error="Cannot load"
        summary={{ messageCount: 3, retrievalMode: "polling" }}
        messages={[]}
        canSend
        onRefresh={refresh}
        onSend={send}
      />
    );

    expect(screen.getByText("3 messages · polling updates")).toBeInTheDocument();
    expect(screen.getByText("Cannot load")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Refresh"));
    expect(refresh).toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText(/type your message/i), "panel message");
    await user.click(screen.getByText("Send"));
    expect(send).toHaveBeenCalledWith({ content: "panel message", file: null });
  });

  it("workspace renders empty selection state", () => {
    render(<GroupChatWorkspace chatId="" selectedChatName="" />);

    expect(screen.getByText(/select a group chat/i)).toBeInTheDocument();
  });

  it("workspace loads messages and sends a text message", async () => {
    localStorage.setItem("accessToken", `h.${btoa(JSON.stringify({ email: "me@u.nus.edu" }))}.s`);
    groupChatService.fetchGroupChatMessagesByChatId.mockResolvedValue({
      chat: { groupName: "Algorithms", messageCount: 1, retrievalMode: "manual" },
      messages: [
        {
          id: "m1",
          senderName: "Alice",
          senderEmail: "alice@u.nus.edu",
          content: "Welcome",
          sentAt: "2026-05-08T10:00:00Z",
        },
      ],
    });
    groupChatService.sendGroupChatMessageByChatId.mockResolvedValue({
      message: {
        id: "m2",
        senderName: "Me",
        senderEmail: "me@u.nus.edu",
        content: "Reply",
        sentAt: "2026-05-08T10:05:00Z",
      },
    });

    render(<GroupChatWorkspace chatId="chat-1" selectedChatName="Selected Chat" />);

    expect(await screen.findByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Selected Chat")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/type your message/i), { target: { value: "Reply" } });
    fireEvent.click(screen.getByText("Send"));

    await waitFor(() => {
      expect(groupChatService.sendGroupChatMessageByChatId).toHaveBeenCalledWith("chat-1", "Reply");
    });
    expect(await screen.findByText("Reply")).toBeInTheDocument();
  });

  it("workspace shows load and send errors", async () => {
    groupChatService.fetchGroupChatMessagesByChatId.mockRejectedValueOnce(new Error("Load failed"));
    render(<GroupChatWorkspace chatId="chat-err" selectedChatName="" />);

    expect(await screen.findByText("Load failed")).toBeInTheDocument();

    groupChatService.fetchGroupChatMessagesByChatId.mockResolvedValueOnce({ chat: null, messages: [] });
    groupChatService.sendGroupChatMessageByChatId.mockRejectedValueOnce(new Error("Send failed"));
    fireEvent.click(screen.getByText("Refresh"));
    await waitFor(() => expect(groupChatService.fetchGroupChatMessagesByChatId.mock.calls.length).toBeGreaterThanOrEqual(2));

    fireEvent.change(screen.getByPlaceholderText(/type your message/i), { target: { value: "oops" } });
    fireEvent.click(screen.getByText("Send"));

    expect(await screen.findByText("Send failed")).toBeInTheDocument();
  });
});
