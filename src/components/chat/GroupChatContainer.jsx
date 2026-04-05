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

export default function GroupChatContainer({ groupId, enabled }) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
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
    if (!enabled || !groupId) return;

    if (!silent) setLoading(true);
    try {
      setError("");
      const payload = await groupChatService.fetchGroupChatMessages(groupId);
      setSummary(payload.chat || null);
      hydrateMessages(payload.messages || []);
    } catch (err) {
      setError(err.message || "Failed to load group chat");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [enabled, groupId, hydrateMessages]);

  useEffect(() => {
    if (!enabled || !groupId) {
      setLoading(false);
      return () => {};
    }

    loadMessages();
    const stop = refreshStrategy.start(() => loadMessages({ silent: true }));
    return () => stop();
  }, [enabled, groupId, loadMessages, refreshStrategy]);

  const handleSend = useCallback(async (content) => {
    if (!enabled || !groupId) return false;

    const optimistic = createChatMessageViewModel({
      id: `optimistic-${Date.now()}`,
      senderName: viewerEmail || "You",
      senderEmail: viewerEmail,
      content,
      sentAt: new Date().toISOString(),
    }, viewerEmail);

    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    try {
      setError("");
      const response = await groupChatService.sendGroupChatMessage(groupId, content);
      const sent = createChatMessageViewModel(response?.message, viewerEmail);
      setMessages((prev) => prev.map((item) => (item.id === optimistic.id ? sent : item)));
      setSummary((prev) => ({
        ...(prev || {}),
        messageCount: (prev?.messageCount || 0) + 1,
      }));
      return true;
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item.id !== optimistic.id));
      setError(err.message || "Failed to send message");
      return false;
    } finally {
      setSending(false);
    }
  }, [enabled, groupId, viewerEmail]);

  if (!enabled) {
    return null;
  }

  return (
    <GroupChatPanel
      loading={loading}
      error={error}
      summary={summary}
      messages={messages}
      canSend={!sending}
      onSend={handleSend}
      onRefresh={() => loadMessages()}
    />
  );
}

GroupChatContainer.propTypes = {
  groupId: PropTypes.string,
  enabled: PropTypes.bool,
};

GroupChatContainer.defaultProps = {
  groupId: "",
  enabled: true,
};
