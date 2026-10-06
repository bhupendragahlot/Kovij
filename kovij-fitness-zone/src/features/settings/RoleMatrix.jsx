import { Check, Minus } from "lucide-react";
import { PERMISSIONS, STAFF_ROLES } from "../auth/permissionRules";
import { ROLE_LABEL } from "../../shared/domain/status";
import { Card, CardHeader } from "../../shared/ui";

/** Plain words for each permission, grouped the way owners think about the job. */
const GROUPS = [
  ["Members", [["members.view", "See members"], ["members.edit", "Add and edit members"], ["members.health.view", "See health details"], ["notes.manage", "Write staff notes"], ["communication.send", "Message members"]]],
  ["Plans", [["memberships.sell", "Sell and renew plans"], ["renewals.view", "See renewals"], ["memberships.freeze", "Freeze plans"], ["memberships.extend", "Add free days"], ["membership.cancel", "Cancel plans"], ["price.override", "Change a price at sale"]]],
  ["Attendance", [["attendance.checkin", "Check members in"], ["attendance.view", "See attendance"]]],
  ["Money", [["payments.view", "See payments and dues"], ["payments.collect", "Collect payments"], ["payments.refund", "Record refunds"], ["revenue.view", "See revenue"], ["expenses.manage", "Manage expenses"]]],
  ["Coaching", [["workouts.manage", "Workout plans"], ["diets.manage", "Diet plans"], ["progress.manage", "Record progress"], ["trainers.manage", "Manage trainers"]]],
  ["Growth", [["leads.manage", "Enquiries"], ["support.manage", "Member support"], ["plans.manage", "Plans and prices"], ["campaigns.manage", "Email campaigns"], ["announcements.manage", "Announcements"], ["reminders.manage", "Reminder settings"], ["reports.view", "Reports"]]],
  ["Admin", [["settings.manage", "Gym settings"], ["staff.manage", "Staff accounts"], ["activity.view", "Activity log"]]],
];

const SHORT = { admin: "Owner", manager: "Manager", staff: "Desk", trainer: "Trainer" };

/** Read-only "what each role can do", generated from the same rules the server enforces. */
export function RoleMatrix() {
  const listed = new Set(GROUPS.flatMap(([, items]) => items.map(([key]) => key)));
  const extra = Object.keys(PERMISSIONS).filter((key) => !listed.has(key));
  const groups = extra.length ? [...GROUPS, ["Other", extra.map((key) => [key, key])]] : GROUPS;

  return (
    <Card padding="lg">
      <CardHeader title="What each role can do" description="Set by the app; the server checks every action against this." />
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Permissions by role</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="px-2 py-2 text-left text-body-sm font-semibold text-ink-3">
                Can…
              </th>
              {STAFF_ROLES.map((role) => (
                <th key={role} scope="col" className="w-[3.4rem] px-0.5 py-2 text-center text-label font-semibold text-ink-3 sm:w-20 sm:text-body-sm">
                  <abbr title={ROLE_LABEL[role]} className="no-underline">
                    {SHORT[role]}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map(([group, items]) => (
            <tbody key={group}>
              <tr>
                <th scope="colgroup" colSpan={STAFF_ROLES.length + 1} className="px-2 pb-1 pt-4 text-left text-xs font-bold uppercase tracking-wide text-ink-3">
                  {group}
                </th>
              </tr>
              {items.map(([key, label]) => (
                <tr key={key} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="px-2 py-2 text-left font-medium">
                    {label}
                  </th>
                  {STAFF_ROLES.map((role) => {
                    const yes = PERMISSIONS[key]?.includes(role);
                    return (
                      <td key={role} className="px-0.5 py-2 text-center">
                        {yes ? <Check className="mx-auto size-4 text-good" aria-hidden /> : <Minus className="mx-auto size-4 text-ink-3/50" aria-hidden />}
                        <span className="sr-only">{yes ? "Yes" : "No"}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Card>
  );
}
