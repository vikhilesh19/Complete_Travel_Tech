import { Download } from "lucide-react";
import "./OfflineSavePanel.css";

function OfflineSavePanel({ onSave, savedAt, saving, disabled, label }) {
  const formattedTime = savedAt
    ? new Date(savedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <button
      type="button"
      className="offline-save-button"
      onClick={onSave}
      disabled={saving || disabled}
      aria-label={label}
      title={
        disabled
          ? "Connect to the internet to refresh saved information"
          : savedAt
            ? `Saved offline at ${formattedTime}. Select to update.`
            : label
      }
    >
      <Download size={15} /> {saving ? "Saving…" : label}
    </button>
  );
}

export default OfflineSavePanel;
