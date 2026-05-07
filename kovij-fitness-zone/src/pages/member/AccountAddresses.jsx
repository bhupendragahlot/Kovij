import { BentoCard, BentoGrid, MemberPage } from "../../components/member/bento/BentoUI";

export default function AccountAddresses() {
  return (
    <div>
      <MemberPage eyebrow="My Account" title="Saved addresses" subtitle="Manage your saved addresses." />
      <div className="max-w-6xl mx-auto">
        <BentoGrid>
          <BentoCard className="md:col-span-12" tone="peach" title="Coming soon" subtitle="Address book">
            <p className="text-sm text-gray-700">
              Saved addresses UI will appear here. For now, we store a single address in your profile.
            </p>
          </BentoCard>
        </BentoGrid>
      </div>
    </div>
  );
}

