import { useState, useEffect } from "react";
import { updateGroupAnnouncement } from "../services/announcements.js";

/**
 * EditAnnouncementForm
 * Modal form component for editing announcements
 * Only shown to group admins/owners
 */
export default function EditAnnouncementForm({ groupId, announcement, onSuccess, onCancel }) {
  const [title, setTitle] = useState(announcement?.title || "");
  const [content, setContent] = useState(announcement?.content || "");
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState("");

  const titleLength = title.length;
  const contentLength = content.length;
  const titleMaxLength = 200;
  const contentMaxLength = 4000;

  const isValid = title.trim() && content.trim() && titleLength <= titleMaxLength && contentLength <= contentMaxLength;
  const hasChanges = title !== (announcement?.title || "") || content !== (announcement?.content || "");

  useEffect(() => {
    if (announcement) {
      setTitle(announcement.title || "");
      setContent(announcement.content || "");
      setValidationError("");
    }
  }, [announcement]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!announcement?.id) return;
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
      const updatedAnnouncement = await updateGroupAnnouncement(groupId, announcement.id, {
        title: title.trim(),
        content: content.trim(),
      });
      onSuccess?.(updatedAnnouncement);
    } catch (err) {
      const errorMsg = err.message || "Failed to update announcement";
      setValidationError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="announcementEditCard">
      <h4 className="announcementEditTitle">Edit Announcement</h4>

      {validationError && (
        <div className="announcementEditError">{validationError}</div>
      )}

      <form className="announcementEditForm" onSubmit={handleSubmit}>
        <div className="announcementEditField">
          <label className="announcementEditLabel">
            Title <span className="announcementEditRequired">*</span>
          </label>
          <input
            type="text"
            className="announcementEditInput"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Room change for next session"
            maxLength={titleMaxLength}
            disabled={loading}
          />
          <div className="announcementEditCounter">
            {titleLength}/{titleMaxLength}
          </div>
        </div>

        <div className="announcementEditField">
          <label className="announcementEditLabel">
            Content <span className="announcementEditRequired">*</span>
          </label>
          <textarea
            className="announcementEditTextarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter the announcement details..."
            maxLength={contentMaxLength}
            rows={4}
            disabled={loading}
          />
          <div className="announcementEditCounter">
            {contentLength}/{contentMaxLength}
          </div>
        </div>

        <div className="announcementEditActions">
          <button
            type="button"
            className="announcementEditCancel"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="announcementEditSubmit"
            disabled={!isValid || !hasChanges || loading}
          >
            {loading ? "Updating…" : "Update Announcement"}
          </button>
        </div>
      </form>
    </div>
  );
}