import PropTypes from "prop-types";

export default function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <button
      type="button"
      className={`dashToast ${toast.type === "error" ? "dashToastError" : "dashToastSuccess"}`}
      onClick={onDismiss}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onDismiss()}
    >
      {toast.message}
    </button>
  );
}

Toast.propTypes = {
  toast: PropTypes.shape({
    message: PropTypes.string,
    type: PropTypes.string,
  }),
  onDismiss: PropTypes.func.isRequired,
};
