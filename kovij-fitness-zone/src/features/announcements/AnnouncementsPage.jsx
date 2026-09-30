import { Construction } from "lucide-react";
import { Card, EmptyState, PageHeader } from "../../shared/ui";

/** OWNER: reminders, notifications & announcements module. Placeholder from the platform foundation; the owning module replaces it. */
export default function Placeholder() {
  return (
    <>
      <PageHeader title="Announcements" description="Events, offers, holidays and notices for members." />
      <Card>
        <EmptyState icon={Construction} title="Coming soon" body="This section is being built." />
      </Card>
    </>
  );
}
