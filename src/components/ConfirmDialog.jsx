import PropTypes from "prop-types";

export default function ConfirmDialog({ dialog, onClose }) {
  if (!dialog) return null;
  return (
    <>
      <div className="modalOverlay" aria-hidden="true" onClick={onClose} />
      <dialog open className="confirmDialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <p className="confirmMsg">{dialog.message}</p>
        <div className="confirmActions">
          <button className={dialog.cancelBtnClass || "confirmBtnOutline"} onClick={dialog.onCancel}>{dialog.cancelLabel || "Cancel"}</button>
          <button className={dialog.confirmBtnClass || "confirmBtnGreen"} onClick={dialog.onConfirm}>{dialog.confirmLabel || "Yes"}</button>
        </div>
      </dialog>
    </>
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
