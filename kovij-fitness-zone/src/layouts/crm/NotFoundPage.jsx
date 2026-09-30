import { Compass } from "lucide-react";
import { ButtonLink, Card, EmptyState } from "../../shared/ui";

export default function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon={Compass}
        title="This page doesn't exist"
        body="The link may be old, or the record was removed."
        action={
          <ButtonLink to="/admin" variant="primary">
            Go to Today
          </ButtonLink>
        }
      />
    </Card>
  );
}
