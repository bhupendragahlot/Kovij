import { Construction } from "lucide-react";
import { Card, EmptyState, PageHeader } from "../../shared/ui";

/** OWNER: member app content & support module (phase 2). Placeholder from the platform foundation; the owning module replaces it. */
export default function Placeholder() {
  return (
    <>
      <PageHeader title="Support inbox" description="Complaints and feedback from members." />
      <Card>
        <EmptyState icon={Construction} title="Coming soon" body="This section is being built." />
      </Card>
    </>
  );
}
