import { Dumbbell, HandCoins, Home, Receipt, Wrench, Zap } from "lucide-react";

/** Expense categories (server: models/Expense.js), in the order the owner thinks of them. */
export const EXPENSE_CATEGORY = {
  rent: { label: "Rent", icon: Home },
  salary: { label: "Salary", icon: HandCoins },
  electricity: { label: "Electricity", icon: Zap },
  equipment: { label: "Equipment", icon: Dumbbell },
  maintenance: { label: "Maintenance", icon: Wrench },
  other: { label: "Other", icon: Receipt },
};
export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY);

export const EXPENSE_MODE = { cash: "Cash", upi: "UPI", card: "Card", bank: "Bank or cheque" };
