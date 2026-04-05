import { API_BASE, authHeaders } from "../utils/auth";

async function parseJsonOrThrow(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `${fallbackMessage} (${response.status})`);
  }
  return payload;
}

export async function fetchAccessibleGroupChats() {
  const response = await fetch(`${API_BASE}/api/group-chats`, {
    headers: authHeaders(),
    credentials: "include",
  });
  return parseJsonOrThrow(response, "Failed to load group chats");
}

export async function fetchGroupChatSummaryByChatId(chatId) {
  const response = await fetch(`${API_BASE}/api/group-chats/${chatId}`, {
    headers: authHeaders(),
    credentials: "include",
  });
  return parseJsonOrThrow(response, "Failed to load chat summary");
}

export async function fetchGroupChatMessagesByChatId(chatId) {
  const response = await fetch(`${API_BASE}/api/group-chats/${chatId}/messages`, {
    headers: authHeaders(),
    credentials: "include",
  });
  return parseJsonOrThrow(response, "Failed to load chat messages");
}

export async function sendGroupChatMessageByChatId(chatId, content) {
  const response = await fetch(`${API_BASE}/api/group-chats/${chatId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify({ content }),
  });
  return parseJsonOrThrow(response, "Failed to send message");
}

export function sendGroupChatMessageWithAttachmentByChatId(chatId, content, file, onProgress) {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem("accessToken");
    const formData = new FormData();
    formData.append("content", content || "");
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/group-chats/${chatId}/messages/with-attachment`);
    xhr.withCredentials = true;

    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let payload = {};
      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch {
        payload = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
      } else {
        reject(new Error(payload?.error || `Failed to upload attachment (${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Attachment upload failed"));
    };

    xhr.send(formData);
  });
}

export async function fetchGroupChatAttachmentBlob(attachmentId) {
  const response = await fetch(`${API_BASE}/api/group-chats/attachments/${attachmentId}`, {
    headers: authHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch attachment (${response.status})`);
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

export async function downloadGroupChatAttachment(attachment) {
  const { blob } = await fetchGroupChatAttachmentBlob(attachment.id);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = attachment.fileName || "attachment";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function fetchGroupChatSummary(groupId) {
  const response = await fetch(`${API_BASE}/api/groups/${groupId}/chat`, {
    headers: authHeaders(),
    credentials: "include",
  });
  return parseJsonOrThrow(response, "Failed to load chat summary");
}

export async function fetchGroupChatMessages(groupId) {
  const response = await fetch(`${API_BASE}/api/groups/${groupId}/chat/messages`, {
    headers: authHeaders(),
    credentials: "include",
  });
  return parseJsonOrThrow(response, "Failed to load chat messages");
}

export async function sendGroupChatMessage(groupId, content) {
  const response = await fetch(`${API_BASE}/api/groups/${groupId}/chat/messages`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify({ content }),
  });
  return parseJsonOrThrow(response, "Failed to send message");
}

export const groupChatService = {
  fetchAccessibleGroupChats,
  fetchGroupChatSummaryByChatId,
  fetchGroupChatMessagesByChatId,
  sendGroupChatMessageByChatId,
  sendGroupChatMessageWithAttachmentByChatId,
  fetchGroupChatAttachmentBlob,
  downloadGroupChatAttachment,
  fetchGroupChatSummary,
  fetchGroupChatMessages,
  sendGroupChatMessage,
};
