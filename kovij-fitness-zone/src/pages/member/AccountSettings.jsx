import { useTheme } from "../../context/ThemeContext";
import { BentoCard, BentoGrid, MemberPage } from "../../components/member/bento/BentoUI";

export default function AccountSettings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div>
      <MemberPage eyebrow="My Account" title="Settings" subtitle="Preferences and app options." />
      <div className="max-w-6xl mx-auto">
        <BentoGrid>
          <BentoCard className="md:col-span-12" tone="sky" title="Appearance" subtitle="Theme preference">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-700">
                Current theme: <span className="font-semibold text-gray-900">{theme}</span>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-2xl bg-gray-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-black"
              >
                Toggle theme
              </button>
            </div>
          </BentoCard>
        </BentoGrid>
      </div>
    </div>
  );
}

