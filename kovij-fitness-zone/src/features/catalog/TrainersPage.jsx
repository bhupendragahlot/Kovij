import { useState } from "react";
import { Clock, Dumbbell, Ellipsis, Eye, EyeOff, KeyRound, MessageCircle, Pencil, Phone, Plus, Trash2, Users } from "lucide-react";
import { useRemoveTrainer, useTrainerPerformance, useTrainers } from "../workouts/api";
import { TrainerDialog } from "../workouts/trainers/TrainerDialog";
import { TrainerMembersDialog } from "../workouts/trainers/TrainerMembersDialog";
import { usePermission } from "../auth/permissions";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, IconButton, Menu, PageHeader, SkeletonList, useConfirm, useToast } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatPhone, phoneHref } from "../../shared/lib/format";

/** Coaching numbers for managers: members, active/lapsed, on a plan, visits and sessions (30 days). */
function PerformanceRow({ perf }) {
  if (!perf) return null;
  const items = [
    { label: "Active", value: perf.active },
    { label: "Lapsed", value: perf.lapsed, warn: perf.lapsed > 0 },
    { label: "On a plan", value: `${perf.onPlan}/${perf.members}` },
    { label: "Visits each", value: perf.avgVisits30 },
    { label: "Sessions", value: perf.sessions30 },
  ];
  return (
    <dl className="mt-4 grid grid-cols-3 gap-2 rounded-tile bg-surface-2 p-3 sm:grid-cols-5" aria-label="Last 30 days">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="truncate text-[12px] text-ink-3">{i.label}</dt>
          <dd className={cn("tabular text-[15px] font-bold", i.warn && "text-warn")}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TrainerCard({ trainer: t, perf, canManage, onEdit, onMembers, onRemove }) {
  const tel = phoneHref(t.phone);
  const whatsapp = phoneHref(t.phone, "whatsapp");
  return (
    <Card className={cn("flex h-full flex-col", t.isActive === false && "opacity-75")}>
      <div className="flex items-start gap-3">
        <Avatar name={t.name} src={t.image} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{t.name}</p>
          <p className="truncate text-[13px] text-ink-3">{t.role}</p>
        </div>
        {canManage && (
          <Menu
            label={`Actions for ${t.name}`}
            trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for ${t.name}`} />}
            items={[
              { label: "Edit", icon: Pencil, onSelect: onEdit },
              { label: "Members", icon: Users, onSelect: onMembers },
              { type: "separator" },
              { label: "Remove trainer", icon: Trash2, tone: "danger", onSelect: onRemove },
            ]}
          />
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {t.isActive === false ? <Badge size="sm">Not working here</Badge> : <Badge size="sm" tone="good">Active</Badge>}
        {t.showOnFrontend ? <Badge size="sm" icon={Eye}>On website</Badge> : <Badge size="sm" icon={EyeOff}>Hidden</Badge>}
        {canManage &&
          (t.user ? (
            <Badge size="sm" icon={KeyRound} tone="info">
              Signs in as @{t.user.username}
            </Badge>
          ) : (
            <Badge size="sm" icon={KeyRound} tone="warn">
              No login linked
            </Badge>
          ))}
        {(t.specialties || []).slice(0, 3).map((s) => (
          <Badge key={s} size="sm" tone="brand">
            {s}
          </Badge>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-1.5 text-sm text-ink-2">
        {t.scheduleText && (
          <p className="flex items-start gap-1.5">
            <Clock className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
            {t.scheduleText}
          </p>
        )}
        <p className="flex items-center gap-1.5">
          <Users className="size-3.5 text-ink-3" aria-hidden />
          {t.memberCount} {t.memberCount === 1 ? "member" : "members"}
        </p>
      </div>
      <PerformanceRow perf={perf} />
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button variant="quiet" icon={Users} onClick={onMembers}>
          Members
        </Button>
        {tel && (
          <a href={tel} className="inline-flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink md:h-10">
            <Phone className="size-4" aria-hidden />
            <span className="tabular">{formatPhone(t.phone)}</span>
          </a>
        )}
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink md:h-10"
          >
            <MessageCircle className="size-4" aria-hidden />
            WhatsApp
          </a>
        )}
      </div>
    </Card>
  );
}

export default function TrainersPage() {
  const trainers = useTrainers();
  const canManage = usePermission("trainers.manage");
  const performance = useTrainerPerformance({ enabled: canManage });
  const remove = useRemoveTrainer();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [membersOf, setMembersOf] = useState(null);

  const perfById = new Map((performance.data || []).map((p) => [p.trainerId, p]));

  const onRemove = async (t) => {
    const ok = await confirm({
      title: `Remove ${t.name}?`,
      body: t.memberCount
        ? `${t.name} coaches ${t.memberCount} ${t.memberCount === 1 ? "member" : "members"}. Move them to another trainer first, or turn off “Currently working here” instead.`
        : "They'll disappear from the website too. To keep their profile, turn off “Currently working here” instead.",
      confirmLabel: "Remove trainer",
      tone: "danger",
    });
    if (!ok) return;
    remove.mutate(t._id, { onSuccess: () => toast.success(`${t.name} removed`), onError: (e) => toast.error("Couldn't remove the trainer", { description: e.message }) });
  };

  const addButton = canManage && (
    <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
      Add trainer
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Trainers"
        description={canManage ? "Your coaching team, their hours, their members and how coaching is going (last 30 days)." : "Your coaching team and when they're on the floor."}
        actions={addButton}
      />
      {trainers.isPending ? (
        <Card>
          <SkeletonList rows={3} />
        </Card>
      ) : trainers.isError ? (
        <Card>
          <ErrorState error={trainers.error} onRetry={() => trainers.refetch()} />
        </Card>
      ) : trainers.data.length === 0 ? (
        <Card>
          <EmptyState icon={Dumbbell} title="No trainers yet" body="Add your coaches so members can see who trains them." action={addButton} />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {trainers.data.map((t) => (
            <li key={t._id}>
              <TrainerCard
                trainer={t}
                perf={canManage ? perfById.get(t._id) : null}
                canManage={canManage}
                onEdit={() => setEditing(t)}
                onMembers={() => setMembersOf(t)}
                onRemove={() => onRemove(t)}
              />
            </li>
          ))}
        </ul>
      )}
      <TrainerDialog open={creating || Boolean(editing)} trainer={editing} onClose={() => (setCreating(false), setEditing(null))} />
      <TrainerMembersDialog open={Boolean(membersOf)} trainer={membersOf} onClose={() => setMembersOf(null)} />
    </>
  );
}
