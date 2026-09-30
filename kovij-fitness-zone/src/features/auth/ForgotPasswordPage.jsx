import { Construction } from "lucide-react";
import { Card, EmptyState, PageHeader } from "../../shared/ui";

/** OWNER: security, staff & settings module. Placeholder from the platform foundation; the owning module replaces it. */
export default function Placeholder() {
  return (
    <>
      <PageHeader title="Reset your password" description="" />
      <Card>
        <EmptyState icon={Construction} title="Coming soon" body="This section is being built." />
      </Card>
    </>
  );
}
