import { useSelector } from "react-redux";
import { IndianRupee, UserPlus, Users, Wallet } from "lucide-react";
import { useDashboard } from "./api";
import { EndingSoon, NeedsAttention, RecentActivity, TodayHero } from "./components";
import { usePermission } from "../auth/permissions";
import { selectStaffUser } from "../auth/sessionSlice";
import { Card, ErrorState, KpiTile, PageHeader, Skeleton } from "../../shared/ui";
import { MonthlyRevenue } from "../../shared/ui/charts/charts";
import { formatINR, formatLongToday, formatNumber, greeting } from "../../shared/lib/format";

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12" role="status" aria-label="Loading today">
      <Skeleton className="h-72 rounded-hero xl:col-span-8" />
      <Skeleton className="h-72 rounded-card xl:col-span-4" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-32 rounded-card xl:col-span-3" />
      ))}
    </div>
  );
}

/**
 * "Today": what the desk should do next, then how the gym is doing.
 * Order of visual priority: live floor (hero) → work queue → KPIs → trends → activity.
 */
export default function DashboardPage() {
  const user = useSelector(selectStaffUser);
  const canSeeRevenue = usePermission("revenue.view");
  const dashboard = useDashboard();
  const firstName = (user?.name || user?.username || "").split(" ")[0];
  const d = dashboard.data;

  return (
    <>
      {/* Primary actions live in the hero (Check in) and the top bar (New member); no duplicates here. */}
      <PageHeader title={`${greeting()}${firstName ? `, ${firstName}` : ""}`} description={formatLongToday()} />

      {dashboard.isPending ? (
        <DashboardSkeleton />
      ) : dashboard.isError && !d ? (
        <Card>
          <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
          <TodayHero today={d.today} className="md:col-span-2 xl:col-span-8" />
          <NeedsAttention data={d} className="md:col-span-2 xl:col-span-4" />

          <div className="grid grid-cols-2 gap-4 md:col-span-2 lg:grid-cols-4 xl:col-span-12">
            <KpiTile
              label="Active members"
              icon={Users}
              to="/admin/members?state=active"
              value={formatNumber(d.members.active)}
              sub={d.members.frozen ? `${formatNumber(d.members.frozen)} more on a frozen plan` : `${formatNumber(d.members.newThisMonth)} joined this month`}
            />
            <KpiTile
              label="New this month"
              icon={UserPlus}
              to="/admin/members"
              value={formatNumber(d.members.newThisMonth)}
              delta={{ current: d.members.newThisMonth, previous: d.members.newPrevMonthToDate, label: "last month so far" }}
            />
            {canSeeRevenue && d.revenue && (
              <KpiTile
                label="Collected this month"
                icon={IndianRupee}
                to="/admin/payments?status=paid"
                value={formatINR(d.revenue.monthToDate)}
                delta={{ current: d.revenue.monthToDate, previous: d.revenue.prevMonthToDate, label: "last month so far" }}
              />
            )}
            {d.dues && (
              <KpiTile
                label="Dues outstanding"
                icon={Wallet}
                to="/admin/payments?status=pending"
                value={formatINR(d.dues.amount)}
                sub={`${formatNumber(d.dues.count)} unpaid ${d.dues.count === 1 ? "bill" : "bills"}`}
              />
            )}
          </div>

          {canSeeRevenue && d.revenue && (
            <Card className="md:col-span-2 xl:col-span-7">
              <MonthlyRevenue data={d.revenue.byMonth} />
            </Card>
          )}
          <EndingSoon expiring={d.expiring} className={canSeeRevenue ? "md:col-span-2 xl:col-span-5" : "md:col-span-1 xl:col-span-7"} />
          <RecentActivity items={d.activity} className={canSeeRevenue ? "md:col-span-2 xl:col-span-12" : "md:col-span-1 xl:col-span-5"} />
        </div>
      )}
    </>
  );
}
