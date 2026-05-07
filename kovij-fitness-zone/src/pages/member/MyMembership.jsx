import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { memberApi } from "../../lib/memberApi";
import { formatIstDdMmYyyyHm } from "../../utils/date";
import { BentoCard, BentoGrid, MemberPage } from "../../components/member/bento/BentoUI";

export default function MyMembership() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await memberApi.get("/membership/me");
        setData(d);
      } catch (e) {
        setErr(e?.response?.data?.message || e.message);
      }
    })();
  }, []);

  if (err) return <p className="text-red-300">{err}</p>;
  if (!data) return <p className="text-gray-300">Loading…</p>;

  const m = data.membership;
  return (
    <div>
      <MemberPage eyebrow="Plan details" title="My membership" subtitle="Your current plan and validity." />

      <div className="max-w-6xl mx-auto">
        <BentoGrid>
          {!m ? (
            <BentoCard className="md:col-span-12" tone="mint" title="No active membership" subtitle="Join to activate your plan">
              <div className="text-sm text-gray-700">
                You don’t have an active plan yet.
                <div className="mt-4">
                  <Link to="/member/join" className="inline-flex rounded-2xl bg-gray-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-black">
                    Join now
                  </Link>
                </div>
              </div>
            </BentoCard>
          ) : (
            <BentoCard className="md:col-span-8" tone="mint" title={m.planId?.name || "Plan"} subtitle="Validity & status">
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Status</span>
                  <span className="rounded-full bg-emerald-600/15 px-3 py-1 text-xs font-bold text-emerald-700">{m.status}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Start</span>
                  <span className="font-semibold">{formatIstDdMmYyyyHm(m.startDate)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">End</span>
                  <span className="font-semibold">{formatIstDdMmYyyyHm(m.endDate)}</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/member/payments" className="inline-flex rounded-2xl bg-gray-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-black">
                  View payments
                </Link>
                <Link to="/member/dashboard" className="inline-flex rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-white">
                  Back to dashboard
                </Link>
              </div>
            </BentoCard>
          )}

          {m ? (
            <BentoCard className="md:col-span-4" tone="lilac" title="Need help?" subtitle="Quick links">
              <div className="grid gap-2">
                <Link to="/member/profile" className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white">
                  Update profile
                </Link>
                <Link to="/member/payments" className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white">
                  Open receipts
                </Link>
                <Link to="/member/dashboard" className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold hover:bg-white">
                  Dashboard
                </Link>
              </div>
            </BentoCard>
          ) : null}
        </BentoGrid>
      </div>
    </div>
  );
}
