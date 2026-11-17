import { reviewLabels, type ReviewResult } from "../review/engine";
export function ReviewBadge({ result }: { result?: ReviewResult }) {
  const status = result?.status || "Not Configured";
  return (
    <span
      className={`review-badge review-${status.replaceAll(" ", "-").toLowerCase()}`}
    >
      {reviewLabels[status]}
      {result?.required ? ` · ${result.approvals}/${result.required}` : ""}
    </span>
  );
}
