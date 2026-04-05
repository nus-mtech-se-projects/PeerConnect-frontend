import PropTypes from "prop-types";

export default function GroupChatsNavList({ chats, activeChatId, onSelectChat, loading }) {
  return (
    <div className="dashChatNavSection">
      <span className="dashNavLabel">GROUP CHATS</span>
      {loading ? <p className="dashChatNavEmpty">Loading chats…</p> : null}
      {!loading && chats.length === 0 ? <p className="dashChatNavEmpty">No joined group chats yet</p> : null}
      {!loading && chats.map((chat) => (
        <button
          key={chat.chatId}
          className={`dashNavItem dashChatNavItem ${activeChatId === chat.chatId ? "active" : ""}`}
          onClick={() => onSelectChat(chat.chatId)}
          title={chat.groupName}
        >
          <span className="dashChatName">{chat.groupName}</span>
          {chat.messageCount > 0 ? <span className="dashChatCount">{chat.messageCount}</span> : null}
        </button>
      ))}
    </div>
  );
}

GroupChatsNavList.propTypes = {
  chats: PropTypes.arrayOf(PropTypes.shape({
    chatId: PropTypes.string.isRequired,
    groupName: PropTypes.string,
    messageCount: PropTypes.number,
  })).isRequired,
  activeChatId: PropTypes.string,
  onSelectChat: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

GroupChatsNavList.defaultProps = {
  activeChatId: "",
  loading: false,
};
