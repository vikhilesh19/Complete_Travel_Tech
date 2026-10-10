import { useState } from "react";
import { apiFetch } from "../api.js";
import { BellRing, Check, MessageSquareText } from "lucide-react";
import "./SmsSubscription.css";

async function postSubscription(path, body) {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "SMS subscription failed.");
  return result;
}

function SmsSubscription({ areaId, areaName, language, enabled, text }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const areaText = textValue(text, areaName);

  async function requestCode(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await postSubscription("/api/sms/subscriptions/request-code", {
        phone,
        areaId,
        language,
        consent,
      });
      setPhase("code");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await postSubscription("/api/sms/subscriptions/verify", {
        phone,
        areaId,
        language,
        consent,
        code,
      });
      setPhase("subscribed");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sms-subscription" aria-labelledby="sms-heading">
      <div className="sms-subscription-heading">
        <span className="sms-icon"><BellRing size={17} /></span>
        <div><p className="eyebrow">TRAVELER NOTIFICATIONS</p><h2 id="sms-heading">{text.title}</h2></div>
      </div>
      <p className="sms-description">{areaText.description}</p>
      {!enabled ? (
        <p className="sms-unavailable" role="status">{text.unavailable}</p>
      ) : phase === "subscribed" ? (
        <div className="sms-success" role="status"><Check size={16} /><span>{areaText.success}</span></div>
      ) : phase === "phone" ? (
        <form className="sms-form" onSubmit={requestCode}>
          <label className="sms-field">{text.phoneLabel}<input type="tel" name="phone" autoComplete="tel" placeholder={text.phonePlaceholder} value={phone} onChange={(event) => setPhone(event.target.value)} pattern="\+[1-9][0-9\s().-]{7,20}" maxLength={24} required /></label>
          <label className="sms-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>{areaText.consent}</span></label>
          {error && <p className="sms-error" role="alert">{error}</p>}
          <button className="sms-submit" type="submit" disabled={busy || !consent}><MessageSquareText size={15} />{busy ? text.sendingCode : text.sendCode}</button>
        </form>
      ) : (
        <form className="sms-form" onSubmit={verifyCode}>
          <label className="sms-field">{text.codeLabel}<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,10}" maxLength={10} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required /></label>
          <p className="sms-privacy">{text.codeSent}</p>
          {error && <p className="sms-error" role="alert">{error}</p>}
          <div className="sms-form-actions"><button className="sms-submit" type="submit" disabled={busy}>{busy ? text.verifying : text.verify}</button><button className="sms-text-button" type="button" onClick={() => { setPhase("phone"); setCode(""); setError(""); }}>{text.changeNumber}</button></div>
        </form>
      )}
      <p className="sms-privacy">{text.privacy}</p>
    </section>
  );
}

function textValue(text, areaName) {
  return Object.fromEntries(
    Object.entries(text).map(([key, value]) => [
      key,
      value.replaceAll("{area}", areaName),
    ]),
  );
}

export default SmsSubscription;