import { useState } from "react";
import { adminApi } from "../../../lib/adminApi";

export default function BillSender() {
  const [paymentId, setPaymentId] = useState("");
  const [msg, setMsg] = useState("");

  const send = async () => {
    setMsg("");
    try {
      await adminApi.post(`/admin/payments/${paymentId}/send-bill`);
      setMsg("Bill email queued to member.");
    } catch (e) {
      setMsg(e?.response?.data?.message || e.message);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Send payment bill (email)</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Enter a payment document ID (Mongo _id). The member on that payment receives the receipt email.
      </p>
      <div className="flex flex-wrap gap-2 max-w-lg">
        <input
          className="flex-1 border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
          placeholder="Payment ID"
          value={paymentId}
          onChange={(e) => setPaymentId(e.target.value)}
        />
        <button type="button" onClick={send} className="px-4 py-2 bg-blue-600 text-white rounded">
          Queue email
        </button>
      </div>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </div>
  );
}
