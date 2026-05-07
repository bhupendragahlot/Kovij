import { useEffect, useState } from "react";
import { memberApi } from "../../lib/memberApi";
import { BentoCard, BentoGrid, MemberPage } from "../../components/member/bento/BentoUI";

export default function Payments() {
  const [list, setList] = useState([]);
  const [err, setErr] = useState(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await memberApi.get("/payments/me");
        setList(data.payments || []);
      } catch (e) {
        setErr(e?.response?.data?.message || e.message);
      }
    })();
  }, []);

  const openBill = async (id, emailCopy) => {
    setNote("");
    try {
      const { data, headers } = await memberApi.get(`/payments/${id}/bill`, {
        params: emailCopy ? { emailCopy: "1" } : {},
        responseType: "text",
      });
      const mime = headers["content-type"] || "text/html";
      const blob = new Blob([data], { type: mime });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (emailCopy) setNote("Bill opened; email copy queued if configured.");
    } catch (e) {
      setNote(e?.response?.data?.message || e.message || "Failed to load bill");
    }
  };

  if (err) return <p className="text-red-300">{err}</p>;

  return (
    <div>
      <MemberPage eyebrow="Receipts" title="Payments" subtitle="Bills and payment history." />

      <div className="max-w-6xl mx-auto">
        <BentoGrid>
          <BentoCard className="md:col-span-12" tone="sky" title="Your receipts" subtitle="Open a bill or email a copy">
            {note ? (
              <div className="rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-sm text-gray-800">{note}</div>
            ) : null}

            <div className="mt-4 space-y-3">
              {list.length === 0 && <p className="text-sm text-gray-700">No payments yet.</p>}
              {list.map((p) => (
                <div
                  key={p._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-black/10 bg-white/70 px-4 py-4 text-sm shadow-[0_10px_30px_-28px_rgba(0,0,0,0.35)]"
                >
                  <div className="min-w-[220px]">
                    <div className="font-semibold capitalize text-gray-900">{p.type}</div>
                    <div className="mt-1 text-xs text-gray-600">
                      ₹{p.amount} • {String(p.mode || "").toUpperCase()} •{" "}
                      <span className={p.status === "paid" ? "text-emerald-700" : p.status === "pending" ? "text-amber-700" : "text-rose-700"}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">{p.invoiceNo}</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-2xl bg-gray-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-black"
                      onClick={() => openBill(p._id, false)}
                    >
                      View bill
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-white"
                      onClick={() => openBill(p._id, true)}
                    >
                      Email copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </BentoCard>
        </BentoGrid>
      </div>
    </div>
  );
}
