import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { fetchGroupChatAttachmentBlob, downloadGroupChatAttachment } from "../../services/groupChatService";

function AttachmentView({ attachment }) {
  const [imageUrl, setImageUrl] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let localUrl = "";

    async function loadImagePreview() {
      if (!attachment?.isImage || !attachment?.id) return;
      setLoadingPreview(true);
      try {
        const { blob } = await fetchGroupChatAttachmentBlob(attachment.id);
        if (cancelled) return;
        localUrl = URL.createObjectURL(blob);
        setImageUrl(localUrl);
      } catch {
        if (!cancelled) {
          setImageUrl("");
        }
      } finally {
        if (!cancelled) {
          setLoadingPreview(false);
        }
      }
    }

    loadImagePreview();

    return () => {
      cancelled = true;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [attachment]);

  if (!attachment) {
    return null;
  }

  return (
    <div className="gdChatAttachmentCard">
      <div className="gdChatAttachmentMeta">
        <strong>{attachment.fileName}</strong>
        <span>{Math.max(1, Math.round((attachment.fileSize || 0) / 1024))} KB</span>
      </div>

      {attachment.isImage ? (
        loadingPreview ? (
          <div className="gdChatAttachmentLoading">Loading image preview…</div>
        ) : imageUrl ? (
          <img src={imageUrl} alt={attachment.fileName} className="gdChatAttachmentImage" />
        ) : null
      ) : null}

      <div className="gdChatAttachmentActions">
        <button type="button" className="gdCancelBtn" onClick={() => downloadGroupChatAttachment(attachment)}>
          Download
        </button>
      </div>
    </div>
  );
}

export default function GroupChatMessageList({ messages, loading }) {
  if (loading) {
    return <p className="gdChatState">Loading chat messages…</p>;
  }

  if (!messages.length) {
    return <p className="gdChatState">No messages yet. Start the conversation.</p>;
  }

  return (
    <div className="gdChatMessages" role="log" aria-live="polite">
      {messages.map((msg) => (
        <div key={msg.id} className={`gdChatBubbleWrap ${msg.isMine ? "mine" : ""}`}>
          <div className={`gdChatBubble ${msg.isMine ? "mine" : ""}`}>
            <div className="gdChatMeta">
              <strong>{msg.senderName}</strong>
              <span>{msg.sentAtLabel}</span>
            </div>
            <p>{msg.content}</p>
            {msg.attachment ? <AttachmentView attachment={msg.attachment} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

GroupChatMessageList.propTypes = {
  messages: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    senderName: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    attachment: PropTypes.shape({
      id: PropTypes.string.isRequired,
      fileName: PropTypes.string,
      contentType: PropTypes.string,
      fileSize: PropTypes.number,
      downloadUrl: PropTypes.string,
      isImage: PropTypes.bool,
    }),
    sentAtLabel: PropTypes.string,
    isMine: PropTypes.bool,
  })).isRequired,
  loading: PropTypes.bool,
};

GroupChatMessageList.defaultProps = {
  loading: false,
};
