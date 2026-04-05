import { useRef, useState } from "react";
import PropTypes from "prop-types";

const QUICK_EMOJIS = ["😀", "😂", "😍", "🤔", "👍", "🎉", "🙏", "🔥", "💯", "✅", "📚", "😅"];

export default function GroupChatComposer({ disabled, uploadProgress, onSend }) {
  const [draft, setDraft] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef(null);

  function openFilePicker() {
    if (disabled) return;
    fileInputRef.current?.click();
  }

  function onFileSelected(event) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  }

  function removeFile() {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function insertEmoji(emoji) {
    setDraft((prev) => `${prev}${emoji}`);
    setEmojiOpen(false);
  }

  async function submitMessage(event) {
    event.preventDefault();
    if (disabled) return;

    const content = draft.trim();
    if (!content && !selectedFile) return;

    const outgoingFile = selectedFile;
    setDraft("");
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    const ok = await onSend({ content, file: outgoingFile });
    if (!ok) {
      setDraft(content);
      setSelectedFile(outgoingFile);
    }
  }

  return (
    <form className="gdChatComposer" onSubmit={submitMessage}>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={onFileSelected}
        accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
      />

      {selectedFile ? (
        <div className="gdChatAttachmentPreview">
          <span>{selectedFile.name}</span>
          <button type="button" className="gdCancelBtn" onClick={removeFile} disabled={disabled}>
            Remove
          </button>
        </div>
      ) : null}

      <div className="gdChatComposerTools">
        <button type="button" className="gdCancelBtn" onClick={openFilePicker} disabled={disabled}>
          Attach
        </button>
        <div className="gdEmojiWrap">
          <button
            type="button"
            className="gdCancelBtn"
            onClick={() => setEmojiOpen((prev) => !prev)}
            disabled={disabled}
          >
            Emoji
          </button>
          {emojiOpen ? (
            <div className="gdEmojiPicker" role="menu" aria-label="Emoji picker">
              {QUICK_EMOJIS.map((emoji) => (
                <button key={emoji} type="button" className="gdEmojiBtn" onClick={() => insertEmoji(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <textarea
        className="gdInput gdChatInput"
        rows={2}
        maxLength={2000}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Type your message…"
        disabled={disabled}
      />
      {uploadProgress > 0 && uploadProgress < 100 ? (
        <div className="gdChatUploadProgress">Uploading attachment: {uploadProgress}%</div>
      ) : null}
      <button type="submit" className="gdSubmitBtn" disabled={disabled || (!draft.trim() && !selectedFile)}>
        Send
      </button>
    </form>
  );
}

GroupChatComposer.propTypes = {
  disabled: PropTypes.bool,
  uploadProgress: PropTypes.number,
  onSend: PropTypes.func.isRequired,
};

GroupChatComposer.defaultProps = {
  disabled: false,
  uploadProgress: 0,
};
