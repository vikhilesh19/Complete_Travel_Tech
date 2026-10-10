import { Download, Check } from "lucide-react";
import "./OfflineSavePanel.css";

function OfflineSavePanel({ onSave, savedAt, saving, disabled, error }) {
  const formattedTime = savedAt
    ? new Date(savedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <section
      className="offline-save-panel"
      aria-label="Offline area information"
    >
      <div>
        <strong>Save this area for offline use</strong>
        {savedAt ? (
          <p role="status">
            <Check size={14} /> Saved for offline use. Last updated{" "}
            {formattedTime}.
          </p>
        ) : (
          <p>
            Save the latest available reports and area information on this
            device.
          </p>
        )}
        {error && (
          <p className="offline-save-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        title={
          disabled
            ? "Connect to the internet to refresh saved information"
            : undefined
        }
      >
        <Download size={15} /> {saving ? "Saving…" : "Save for offline"}
      </button>
    </section>
  );
}

export default OfflineSavePanel;
