import { Link } from "react-router-dom";
import { CreditCard, MapPin, Settings, Shield, CalendarClock, ReceiptText, UserCircle } from "lucide-react";
import { BentoCard, BentoGrid, MemberPage } from "../../components/member/bento/BentoUI";
import { useMemberAuth } from "../../context/MemberAuthContext";

function Tile({ to, icon: Icon, title, desc }) {
  return (
    <Link
      to={to}
      className="group rounded-[22px] border border-black/10 bg-white/70 px-4 py-4 shadow-[0_10px_30px_-28px_rgba(0,0,0,0.35)] transition hover:bg-white"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gray-900 text-white">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-gray-900">{title}</div>
          <div className="mt-1 text-xs text-gray-600">{desc}</div>
        </div>
      </div>
    </Link>
  );
}

export default function AccountHub() {
  const { logout, member } = useMemberAuth();

  return (
    <div>
      <MemberPage eyebrow="My Account" title="Account" subtitle="Manage your details, billing, and history." />

      <div className="max-w-6xl mx-auto">
        <BentoGrid>
          <BentoCard className="md:col-span-12" tone="lilac" title="Quick access" subtitle={member?.email || ""} right={
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-2xl border border-black/10 bg-white/70 px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-white"
            >
              Sign out
            </button>
          }>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Tile
                to="/member/profile"
                icon={UserCircle}
                title="Personal details"
                desc="Profile, phone, health info."
              />
              <Tile
                to="/member/account/addresses"
                icon={MapPin}
                title="Saved addresses"
                desc="Home/office addresses."
              />
              <Tile
                to="/member/payments"
                icon={CreditCard}
                title="Billing & payments"
                desc="Receipts, bill history, email copies."
              />
              <Tile
                to="/member/account/membership-history"
                icon={CalendarClock}
                title="Membership history"
                desc="Your plan changes and renewals."
              />
              <Tile
                to="/member/payments"
                icon={ReceiptText}
                title="Transactions"
                desc="Payment transactions (if applicable)."
              />
              <Tile
                to="/member/account/settings"
                icon={Settings}
                title="Settings"
                desc="Preferences & account options."
              />
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-xs text-gray-700">
              <Shield size={16} className="mt-0.5" />
              <div>
                Keep your account secure. Sign out when using shared devices.
              </div>
            </div>
          </BentoCard>
        </BentoGrid>
      </div>
    </div>
  );
}

