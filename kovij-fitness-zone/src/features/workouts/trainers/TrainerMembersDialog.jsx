import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserMinus, UserPlus, Users } from "lucide-react";
import { useAssignTrainerMembers, useTrainerMembers, useUnassignTrainerMember } from "../api";
import { MemberMultiPicker } from "../MemberMultiPicker";
import { dayKeyDate } from "../labels";
import { usePermission } from "../../auth/permissions";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import { useOnlineStatus } from "../../../shared/hooks/useOnlineStatus";
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  FormError,
  IconButton,
  InlineAlert,
  Pagination,
  SearchInput,
  SkeletonList,
  StatusBadge,
  useConfirm,
  useToast,
} from "../../../shared/ui";
import { formatRelativeDay } from "../../../shared/lib/format";

const LIMIT = 20;

/** A trainer's members: who they coach, adding members in bulk, and removing them. */
export function TrainerMembersDialog({ open, trainer, onClose }) {
  const canManage = usePermission("trainers.manage");
  const online = useOnlineStatus();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState([]);
  const term = useDebouncedValue(q.trim(), 250);
  const list = useTrainerMembers(trainer?._id, { q: term || undefined, page, limit: LIMIT }, { enabled: open });
  const assign = useAssignTrainerMembers();
  const unassign = useUnassignTrainerMember();
  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setQ("");
    setPage(1);
    setAdding([]);
    assign.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setPage(1), [term]);

  const onAssign = () =>
    assign.mutate(
      { trainerId: trainer._id, memberIds: adding.map((m) => m._id) },
      {
        onSuccess: (d) => {
          toast.success(`${d.assigned} ${d.assigned === 1 ? "member" : "members"} assigned to ${trainer.name}`, {
            description: d.moved ? `${d.moved} moved from another trainer.` : undefined,
          });
          setAdding([]);
        },
      }
    );

  const onRemove = async (m) => {
    const ok = await confirm({
      title: `Remove ${m.name} from ${trainer.name}?`,
      body: "They'll have no trainer until you assign one. Their workout plan and history stay as they are.",
      confirmLabel: "Remove from trainer",
      tone: "danger",
    });
    if (!ok) return;
    unassign.mutate(
      { trainerId: trainer._id, memberId: m._id },
      { onSuccess: () => toast.success(`${m.name} removed from ${trainer.name}`), onError: (e) => toast.error("Couldn't remove the member", { description: e.message }) }
    );
  };

  const data = list.data;

  return (
    <Dialog open={open} onClose={onClose} title={trainer ? `${trainer.name}'s members` : "Members"} placement="side" size="lg">
      {canManage && (
        <section className="mb-5 rounded-tile bg-surface-2 p-3.5" aria-label="Assign members">
          <p className="mb-2 text-sm font-semibold">Assign members</p>
          {trainer?.isActive === false ? (
            <InlineAlert tone="warning">{trainer.name} is marked as not working here. Change that to assign members.</InlineAlert>
          ) : (
            <>
              <FormError error={assign.error} />
              <MemberMultiPicker value={adding} onChange={setAdding} max={200} error={assign.error?.fields?.memberIds} />
              {adding.length > 0 && (
                <Button className="mt-3" variant="primary" icon={UserPlus} block loading={assign.isPending} disabled={!online} onClick={onAssign}>
                  Assign {adding.length} {adding.length === 1 ? "member" : "members"}
                </Button>
              )}
              <p className="mt-2 text-[13px] text-ink-3">Members who already have a trainer move to {trainer?.name}.</p>
            </>
          )}
        </section>
      )}

      <SearchInput value={q} onChange={setQ} label="Search this trainer's members" placeholder="Search members" className="mb-3" />
      {list.isPending ? (
        <SkeletonList rows={5} />
      ) : list.isError && !data ? (
        <ErrorState compact error={list.error} onRetry={() => list.refetch()} />
      ) : !data.items.length ? (
        <EmptyState compact icon={Users} title={term ? "No members match" : "No members yet"} body={term ? "Try another name or phone." : canManage ? "Search above to assign members." : "A manager assigns members to trainers."} />
      ) : (
        <>
          <ul className="-mx-1 divide-y divide-line">
            {data.items.map((m) => (
              <li key={m._id} className="flex items-center gap-3 px-1 py-2.5">
                <Link to={`/admin/members/${m._id}`} className="flex min-w-0 flex-1 items-center gap-3" onClick={onClose}>
                  <Avatar name={m.name} src={m.profilePhoto} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold hover:underline">{m.name}</span>
                    <span className="block truncate text-[13px] text-ink-3">
                      {m.workout ? m.workout.name : "No workout plan"}
                      {m.lastSessionDay ? `, trained ${formatRelativeDay(dayKeyDate(m.lastSessionDay))}` : ""}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <StatusBadge kind="member" status={m.state} size="sm" />
                      <Badge size="sm">{m.visits30} visits in 30 days</Badge>
                    </span>
                  </span>
                </Link>
                {canManage && <IconButton icon={UserMinus} label={`Remove ${m.name} from ${trainer?.name}`} onClick={() => onRemove(m)} />}
              </li>
            ))}
          </ul>
          <Pagination page={page} limit={LIMIT} total={data.total} onPage={setPage} className="-mx-5 md:-mx-6" />
        </>
      )}
    </Dialog>
  );
}
