import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { groupChatService } from "../../services/groupChatService";
import { resolveChatRefreshStrategy } from "../../services/chatRefreshStrategies";
import { createChatMessageViewModel } from "../../factories/chatMessageViewModelFactory";
import GroupChatPanel from "./GroupChatPanel";

function resolveCurrentUserEmail() {
  const token = localStorage.getItem("accessToken");
  if (!token) return "";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.email || payload.preferred_username || payload.unique_name || "";
  } catch {
    return "";
  }
}

export default function GroupChatWorkspace({ chatId, selectedChatName }) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [messages, setMessages] = useState([]);

  const viewerEmail = useMemo(() => resolveCurrentUserEmail(), []);
  const refreshStrategy = useMemo(() => resolveChatRefreshStrategy("polling"), []);

  const hydrateMessages = useCallback((rawMessages) => {
    const mapped = (Array.isArray(rawMessages) ? rawMessages : [])
      .map((item) => createChatMessageViewModel(item, viewerEmail));
    setMessages(mapped);
  }, [viewerEmail]);

  const loadMessages = useCallback(async ({ silent } = { silent: false }) => {
    if (!chatId) return;
    if (!silent) setLoading(true);

    try {
      setError("");
      const payload = await groupChatService.fetchGroupChatMessagesByChatId(chatId);
      setSummary(payload.chat || null);
      hydrateMessages(payload.messages || []);
    } catch (err) {
      setError(err.message || "Failed to load group chat");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [chatId, hydrateMessages]);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setSummary(null);
      return () => {};
    }

    loadMessages();
    const stop = refreshStrategy.start(() => loadMessages({ silent: true }));
    return () => stop();
  }, [chatId, loadMessages, refreshStrategy]);

  const handleSend = useCallback(async ({ content, file }) => {
    if (!chatId) return false;

    const normalizedContent = (content || "").trim();

    const optimistic = createChatMessageViewModel({
      id: `optimistic-${Date.now()}`,
      senderName: viewerEmail || "You",
      senderEmail: viewerEmail,
      content: normalizedContent || "[Attachment]",
      sentAt: new Date().toISOString(),
      attachment: file
        ? {
            id: `tmp-attachment-${Date.now()}`,
            fileName: file.name,
            contentType: file.type,
            fileSize: file.size,
            isImage: file.type?.startsWith("image/"),
          }
        : null,
    }, viewerEmail);

    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    setUploadProgress(0);
    try {
      setError("");
      const response = file
        ? await groupChatService.sendGroupChatMessageWithAttachmentByChatId(
            chatId,
            normalizedContent,
            file,
            (progress) => setUploadProgress(progress)
          )
        : await groupChatService.sendGroupChatMessageByChatId(chatId, normalizedContent);

      const sent = createChatMessageViewModel(response?.message, viewerEmail);
      setMessages((prev) => prev.map((item) => (item.id === optimistic.id ? sent : item)));
      setSummary((prev) => ({
        ...(prev || {}),
        messageCount: (prev?.messageCount || 0) + 1,
      }));
      setUploadProgress(100);
      return true;
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item.id !== optimistic.id));
      setError(err.message || "Failed to send message");
      setUploadProgress(0);
      return false;
    } finally {
      setSending(false);
      setTimeout(() => setUploadProgress(0), 300);
    }
  }, [chatId, viewerEmail]);

  if (!chatId) {
    return (
      <div className="dashEmpty" style={{ marginTop: 20 }}>
        <p>Select a group chat from the left sidebar to start messaging.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="dashHeader" style={{ marginBottom: 10 }}>
        <div className="dashHeaderTop">
          <div>
            <h1 className="dashTitle">{selectedChatName || summary?.groupName || "Group Chat"}</h1>
            <p className="dashSubtitle">Switch groups from the Group Chats sidebar section</p>
          </div>
        </div>
      </div>

      <GroupChatPanel
        loading={loading}
        error={error}
        summary={summary}
        messages={messages}
        canSend={!sending}
        uploadProgress={uploadProgress}
        onSend={handleSend}
        onRefresh={() => loadMessages()}
      />
    </div>
  );
}

GroupChatWorkspace.propTypes = {
  chatId: PropTypes.string,
  selectedChatName: PropTypes.string,
};

GroupChatWorkspace.defaultProps = {
  chatId: "",
  selectedChatName: "",
};
