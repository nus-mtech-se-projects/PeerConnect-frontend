import PropTypes from "prop-types";

export default function ConfirmDialog({ dialog, onClose }) {
  if (!dialog) return null;
  return (
    <div className="modalOverlay" onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()} role="presentation">
      <dialog open className="confirmDialog" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} aria-modal="true">
        <p className="confirmMsg">{dialog.message}</p>
        <div className="confirmActions">
          <button className={dialog.cancelBtnClass || "confirmBtnOutline"} onClick={dialog.onCancel}>{dialog.cancelLabel || "Cancel"}</button>
          <button className={dialog.confirmBtnClass || "confirmBtnGreen"} onClick={dialog.onConfirm}>{dialog.confirmLabel || "Yes"}</button>
        </div>
      </dialog>
    </div>
  );
}

ConfirmDialog.propTypes = {
  dialog: PropTypes.shape({
    message: PropTypes.string,
    cancelBtnClass: PropTypes.string,
    confirmBtnClass: PropTypes.string,
    cancelLabel: PropTypes.string,
    confirmLabel: PropTypes.string,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func,
  }),
  onClose: PropTypes.func.isRequired,
};
