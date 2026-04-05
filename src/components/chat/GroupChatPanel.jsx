import PropTypes from "prop-types";
import GroupChatMessageList from "./GroupChatMessageList";
import GroupChatComposer from "./GroupChatComposer";

export default function GroupChatPanel({
  loading,
  error,
  summary,
  messages,
  canSend,
  uploadProgress,
  onSend,
  onRefresh,
}) {
  return (
    <div className="gdChatPanel">
      <div className="gdChatHeader">
        <div>
          <h3>Group Chat</h3>
          <p>
            {summary?.messageCount ?? 0} messages
            {summary?.retrievalMode ? ` · ${summary.retrievalMode} updates` : ""}
          </p>
        </div>
        <button type="button" className="gdCancelBtn" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {error ? <p className="gdChatError">{error}</p> : null}

      <GroupChatMessageList messages={messages} loading={loading} />

      <GroupChatComposer disabled={!canSend} uploadProgress={uploadProgress} onSend={onSend} />
    </div>
  );
}

GroupChatPanel.propTypes = {
  loading: PropTypes.bool,
  error: PropTypes.string,
  summary: PropTypes.shape({
    messageCount: PropTypes.number,
    retrievalMode: PropTypes.string,
  }),
  messages: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    senderName: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    sentAtLabel: PropTypes.string,
    isMine: PropTypes.bool,
  })).isRequired,
  canSend: PropTypes.bool,
  uploadProgress: PropTypes.number,
  onSend: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
};

GroupChatPanel.defaultProps = {
  loading: false,
  error: "",
  summary: null,
  canSend: true,
  uploadProgress: 0,
};
