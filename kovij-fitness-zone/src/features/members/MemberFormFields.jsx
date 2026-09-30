import { Field, Input, Select, Switch, Textarea } from "../../shared/ui";
import { GOAL_LABEL } from "../../shared/domain/status";

export function ContactFields({ value, onChange, errors = {}, phoneHint }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Full name" error={errors.name} required className="sm:col-span-2">
        <Input value={value.name} onChange={set("name")} autoComplete="off" maxLength={120} />
      </Field>
      <Field label="Mobile number" error={errors.phone} required hint={phoneHint}>
        <Input type="tel" inputMode="tel" value={value.phone} onChange={set("phone")} placeholder="98765 43210" maxLength={20} />
      </Field>
      <Field label="Email" optional error={errors.email} hint="For receipts and renewal reminders.">
        <Input type="email" inputMode="email" value={value.email} onChange={set("email")} maxLength={120} />
      </Field>
      <Field label="Gender" optional error={errors.gender}>
        <Select value={value.gender} onChange={set("gender")}>
          <option value="">Not specified</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
          <option value="prefer_not_say">Prefer not to say</option>
        </Select>
      </Field>
      <Field label="Date of birth" optional error={errors.dob}>
        <Input type="date" value={value.dob} onChange={set("dob")} max={new Date().toISOString().slice(0, 10)} />
      </Field>
    </div>
  );
}

export function AddressFields({ value, onChange, errors = {} }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Address" optional error={errors.line1} className="sm:col-span-2">
        <Input value={value.line1} onChange={set("line1")} maxLength={200} />
      </Field>
      <Field label="City" optional error={errors.city}>
        <Input value={value.city} onChange={set("city")} maxLength={80} />
      </Field>
      <Field label="State" optional error={errors.state}>
        <Input value={value.state} onChange={set("state")} maxLength={80} />
      </Field>
      <Field label="Emergency contact name" optional error={errors.emergencyName}>
        <Input value={value.emergencyName} onChange={set("emergencyName")} maxLength={120} />
      </Field>
      <Field label="Emergency contact phone" optional error={errors.emergencyPhone}>
        <Input type="tel" inputMode="tel" value={value.emergencyPhone} onChange={set("emergencyPhone")} maxLength={20} />
      </Field>
      <Field label="Notes for staff" optional error={errors.notes} className="sm:col-span-2">
        <Textarea value={value.notes} onChange={set("notes")} maxLength={2000} placeholder="e.g. Prefers morning slots, referred by Ravi" />
      </Field>
    </div>
  );
}

export function HealthFields({ value, onChange, errors = {} }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const h = Number(value.heightCm) / 100;
  const bmi = h && Number(value.weightKg) ? Math.round((Number(value.weightKg) / (h * h)) * 10) / 10 : null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Field label="Height" optional error={errors.heightCm}>
        <Input type="number" inputMode="decimal" suffix="cm" value={value.heightCm} onChange={set("heightCm")} min="50" max="260" />
      </Field>
      <Field label="Weight" optional error={errors.weightKg} hint={bmi ? `BMI ${bmi}` : undefined}>
        <Input type="number" inputMode="decimal" suffix="kg" value={value.weightKg} onChange={set("weightKg")} min="10" max="400" />
      </Field>
      <Field label="Blood group" optional error={errors.bloodGroup}>
        <Select value={value.bloodGroup} onChange={set("bloodGroup")}>
          <option value="">Unknown</option>
          {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Fitness goal" optional error={errors.goalKind} className="sm:col-span-3">
        <Select value={value.goalKind} onChange={set("goalKind")}>
          <option value="">Not specified</option>
          {Object.entries(GOAL_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-3">
        <Switch
          label="Has a medical condition"
          description="Trainers see this before planning workouts."
          checked={value.medicalHas}
          onChange={(medicalHas) => onChange({ ...value, medicalHas })}
        />
      </div>
      {value.medicalHas && (
        <Field label="Medical details" error={errors.medicalDetails} className="sm:col-span-3">
          <Textarea value={value.medicalDetails} onChange={set("medicalDetails")} maxLength={1000} />
        </Field>
      )}
      <Field label="Injuries" optional error={errors.injuries} className="sm:col-span-3">
        <Input value={value.injuries} onChange={set("injuries")} maxLength={1000} />
      </Field>
    </div>
  );
}
