import { Construction } from "lucide-react";
import { Card, EmptyState, PageHeader } from "../../shared/ui";

/** OWNER: reports & dashboard module (phase 2). Placeholder from the platform foundation; the owning module replaces it. */
export default function Placeholder() {
  return (
    <>
      <PageHeader title="Reports" description="Members, attendance, revenue, expiries and trainers." />
      <Card>
        <EmptyState icon={Construction} title="Coming soon" body="This section is being built." />
      </Card>
    </>
  );
}
