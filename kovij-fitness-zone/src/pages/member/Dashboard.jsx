import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { memberApi } from "../../lib/memberApi";
import { useMemberAuth } from "../../context/MemberAuthContext";
import { formatIstDdMmYyyyHm } from "../../utils/date";
import { BentoCard, BentoGrid, MemberPage, SoftButton } from "../../components/member/bento/BentoUI";

export default function MemberDashboard() {
  const { member, logout } = useMemberAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [profileRes, membershipRes, paymentsRes] = await Promise.allSettled([
          memberApi.get("/member/auth/profile"),
          memberApi.get("/membership/me"),
          memberApi.get("/payments/me"),
        ]);

        const profile = profileRes.status === "fulfilled" ? profileRes.value.data : null;
        const membership = membershipRes.status === "fulfilled" ? membershipRes.value.data : null;
        const payments = paymentsRes.status === "fulfilled" ? paymentsRes.value.data : null;

        setData({
          profile,
          membership,
          payments,
        });
      } catch (e) {
        setErr(e?.response?.data?.message || e.message || "Failed to load dashboard");
      }
    })();
  }, []);

  const activeMembership = data?.membership?.membership || null;
  const planName = activeMembership?.planId?.name || activeMembership?.planName || "";

  const lastPayment = useMemo(() => {
    const list = data?.payments?.payments || [];
    return list[0] || null;
  }, [data]);

  if (err) {
    return <p className="text-red-400">{err}</p>;
  }

  return (
    <div>
      <MemberPage
        eyebrow="Always be in touch"
        title={`Hi${member?.name ? `, ${member.name}` : ""}`}
        subtitle="Your gym account at a glance."
        right={
          <div className="md:hidden">
            <SoftButton type="button" onClick={() => logout()}>
              Sign out
            </SoftButton>
          </div>
        }
      />

      <div className="max-w-6xl mx-auto">
        <BentoGrid>
          <BentoCard className="md:col-span-6" tone="lilac" title="Account" subtitle="Your profile basics">
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Email</span>
                <span className="font-medium">{member?.email}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Phone</span>
                <span className="font-medium">{data?.profile?.member?.phone || "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Joined</span>
                <span className="font-medium">{data?.profile?.member?.createdAt ? formatIstDdMmYyyyHm(data.profile.member.createdAt) : "—"}</span>
              </div>
              <Link to="/member/profile" className="mt-2 inline-flex text-sm font-semibold text-gray-900/90 hover:underline">
                View profile →
              </Link>
            </div>
          </BentoCard>

          <BentoCard className="md:col-span-6" tone="mint" title="Membership" subtitle={planName ? planName : "No active plan"}>
            {activeMembership ? (
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Status</span>
                  <span className="rounded-full bg-emerald-600/15 px-3 py-1 text-xs font-bold text-emerald-700">
                    {activeMembership.status}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Start</span>
                  <span className="font-medium">{formatIstDdMmYyyyHm(activeMembership.startDate)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">End</span>
                  <span className="font-medium">{formatIstDdMmYyyyHm(activeMembership.endDate)}</span>
                </div>
                <Link to="/member/membership" className="mt-2 inline-flex text-sm font-semibold text-gray-900/90 hover:underline">
                  View membership →
                </Link>
              </div>
            ) : (
              <div className="text-sm text-gray-700">
                Complete your membership form to activate a plan.
                <div className="mt-4">
                  <Link to="/member/join/form" className="inline-flex w-full justify-center rounded-2xl bg-gray-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-black">
                    Complete membership form
                  </Link>
                </div>
              </div>
            )}
          </BentoCard>

          <BentoCard className="md:col-span-8" tone="sky" title="Payments" subtitle="Recent receipt">
            {lastPayment ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-sm">
                <div className="font-semibold capitalize">
                  {lastPayment.type} • ₹{lastPayment.amount} • {lastPayment.status}
                </div>
                <div className="text-xs text-gray-600">{lastPayment.invoiceNo}</div>
              </div>
            ) : (
              <div className="text-sm text-gray-700">No payments yet.</div>
            )}
            <div className="mt-3">
              <Link to="/member/payments" className="text-sm font-semibold text-gray-900/90 hover:underline">
                View all →
              </Link>
            </div>
          </BentoCard>

          <BentoCard className="md:col-span-4" tone="peach" title="Quick actions" subtitle="What do you want to do?">
            <div className="grid gap-2">
              <Link to="/member/profile" className="rounded-2xl bg-white/60 px-4 py-3 text-sm font-semibold hover:bg-white">
                Update profile
              </Link>
              <Link to="/member/membership" className="rounded-2xl bg-white/60 px-4 py-3 text-sm font-semibold hover:bg-white">
                View membership
              </Link>
              <Link to="/member/payments" className="rounded-2xl bg-white/60 px-4 py-3 text-sm font-semibold hover:bg-white">
                Open receipts
              </Link>
            </div>
          </BentoCard>
        </BentoGrid>
      </div>
    </div>
  );
}

