/** Shared by the card badge and the table badge, so an outcome never gets two colours. */
export const outcomeVariant = (
  outcome: string | null,
): "success" | "warning" | "danger" | "secondary" => {
  if (outcome === "match") return "success";
  if (outcome === "no_capacity") return "warning";
  if (outcome === "no_eligible_staff") return "danger";
  return "secondary";
};
