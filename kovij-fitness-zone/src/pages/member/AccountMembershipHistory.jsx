import { useEffect, useState } from "react";
import { memberApi } from "../../lib/memberApi";
import { BentoCard, BentoGrid, MemberPage } from "../../components/member/bento/BentoUI";
import { formatIstDdMmYyyyHm } from "../../utils/date";

export default function AccountMembershipHistory() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await memberApi.get("/membership/history/me");
        setItems(data?.history || []);
      } catch (e) {
        setErr(e?.response?.data?.message || e.message || "Failed to load membership history");
      }
    })();
  }, []);

  return (
    <div>
      <MemberPage eyebrow="My Account" title="Membership history" subtitle="Upgrades, downgrades, renewals." />
      <div className="max-w-6xl mx-auto">
        <BentoGrid>
          <BentoCard className="md:col-span-12" tone="mint" title="Plan timeline" subtitle="Most recent first">
            {err ? <p className="text-sm text-rose-700">{err}</p> : null}
            {!err && items.length === 0 ? <p className="text-sm text-gray-700">No history yet.</p> : null}
            <div className="mt-3 space-y-3">
              {items.map((h) => (
                <div key={h._id} className="rounded-[22px] border border-black/10 bg-white/70 px-4 py-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-extrabold text-gray-900 capitalize">{h.action || "update"}</div>
                    <div className="text-xs text-gray-600">{h.createdAt ? formatIstDdMmYyyyHm(h.createdAt) : ""}</div>
                  </div>
                  <div className="mt-1 text-xs text-gray-700">
                    {h.fromPlanName ? <span className="font-semibold">{h.fromPlanName}</span> : "—"} →{" "}
                    {h.toPlanName ? <span className="font-semibold">{h.toPlanName}</span> : "—"}
                    {typeof h.amount === "number" ? (
                      <>
                        {" "}
                        • <span className="font-semibold">₹{h.amount}</span>
                      </>
                    ) : null}
                  </div>
                  {h.note ? <div className="mt-2 text-xs text-gray-600">{h.note}</div> : null}
                </div>
              ))}
            </div>
          </BentoCard>
        </BentoGrid>
      </div>
    </div>
  );
}

