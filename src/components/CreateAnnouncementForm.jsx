import { useState } from "react";
import { createGroupAnnouncement } from "../services/announcements.js";

/**
 * CreateAnnouncementForm
 * Reusable form component for creating announcements in a group
 * Only shown to group admins/owners
 */
export default function CreateAnnouncementForm({ groupId, onSuccess, onError }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState("");

  const titleLength = title.length;
  const contentLength = content.length;
  const titleMaxLength = 200;
  const contentMaxLength = 4000;

  const isValid = title.trim() && content.trim() && titleLength <= titleMaxLength && contentLength <= contentMaxLength;

  async function handleSubmit(e) {
    e.preventDefault();
    setValidationError("");

    // Validate
    if (!title.trim()) {
      setValidationError("Please enter an announcement title");
      return;
    }
    if (!content.trim()) {
      setValidationError("Please enter announcement content");
      return;
    }
    if (titleLength > titleMaxLength) {
      setValidationError(`Title must be ${titleMaxLength} characters or less`);
      return;
    }
    if (contentLength > contentMaxLength) {
      setValidationError(`Content must be ${contentMaxLength} characters or less`);
      return;
    }

    setLoading(true);
    try {
      const newAnnouncement = await createGroupAnnouncement(groupId, {
        title: title.trim(),
        content: content.trim(),
      });
      setTitle("");
      setContent("");
      onSuccess?.(newAnnouncement);
    } catch (err) {
      const errorMsg = err.message || "Failed to create announcement";
      setValidationError(errorMsg);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="announcementCreateCard">
      <h4 className="announcementCreateTitle">Create Announcement</h4>

      {validationError && (
        <div className="announcementCreateError">{validationError}</div>
      )}

      <form className="announcementCreateForm" onSubmit={handleSubmit}>
        <div className="announcementCreateField">
          <label className="announcementCreateLabel">
            Title <span className="announcementCreateRequired">*</span>
          </label>
          <input
            type="text"
            className="announcementCreateInput"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Room change for next session"
            maxLength={titleMaxLength}
            disabled={loading}
          />
          <div className="announcementCreateCounter">
            {titleLength}/{titleMaxLength}
          </div>
        </div>

        <div className="announcementCreateField">
          <label className="announcementCreateLabel">
            Content <span className="announcementCreateRequired">*</span>
          </label>
          <textarea
            className="announcementCreateTextarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter the announcement details..."
            maxLength={contentMaxLength}
            rows={4}
            disabled={loading}
          />
          <div className="announcementCreateCounter">
            {contentLength}/{contentMaxLength}
          </div>
        </div>

        <div className="announcementCreateActions">
          <button
            type="submit"
            className="announcementCreateSubmit"
            disabled={!isValid || loading}
          >
            {loading ? "Creating…" : "Post Announcement"}
          </button>
        </div>
      </form>
    </div>
  );
}
