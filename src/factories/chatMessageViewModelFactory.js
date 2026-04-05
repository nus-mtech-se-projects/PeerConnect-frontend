function formatTimestamp(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear());
  const hh = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mins}`;
}

function fallbackSenderName(message) {
  if (message?.senderName) return message.senderName;
  if (message?.senderEmail) return message.senderEmail;
  return "Group member";
}

export function createChatMessageViewModel(message, viewerEmail) {
  const senderEmail = (message?.senderEmail || "").toLowerCase();
  const currentEmail = (viewerEmail || "").toLowerCase();

  return {
    id: message?.id || `tmp-${Date.now()}`,
    senderName: fallbackSenderName(message),
    senderEmail: message?.senderEmail || "",
    content: message?.content || "",
    attachment: message?.attachment
      ? {
          id: message.attachment.id,
          fileName: message.attachment.fileName,
          contentType: message.attachment.contentType,
          fileSize: message.attachment.fileSize,
          downloadUrl: message.attachment.downloadUrl,
          isImage: !!message.attachment.image,
        }
      : null,
    sentAtLabel: formatTimestamp(message?.sentAt),
    sentAt: message?.sentAt || "",
    isMine: !!currentEmail && senderEmail === currentEmail,
  };
}
