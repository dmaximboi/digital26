export type ProgrammeCode =
  | "THREE_MONTH"
  | "FOUR_MONTH"
  | "FIVE_MONTH"
  | "SIX_MONTH"
  | "CUSTOM";

export function programmeLabel(
  programme: string,
  customMonths: number | null = null,
): string {
  switch (programme) {
    case "THREE_MONTH":
      return "3-Month Intensive";
    case "FOUR_MONTH":
      return "4-Month Advanced";
    case "FIVE_MONTH":
      return "5-Month Accelerated";
    case "SIX_MONTH":
      return "6-Month Standard";
    case "CUSTOM":
      return customMonths ? `${customMonths}-Month Custom` : "Custom Programme";
    default:
      return "Vibe Coding Programme";
  }
}

export function programmeShort(programme: string, customMonths: number | null = null): string {
  switch (programme) {
    case "THREE_MONTH":
      return "3M";
    case "FOUR_MONTH":
      return "4M";
    case "FIVE_MONTH":
      return "5M";
    case "SIX_MONTH":
      return "6M";
    case "CUSTOM":
      return customMonths ? `${customMonths}M Custom` : "Custom";
    default:
      return programme;
  }
}

export function programmeWeeks(programme: string, customMonths: number | null = null): number {
  switch (programme) {
    case "THREE_MONTH":
      return 12;
    case "FOUR_MONTH":
      return 16;
    case "FIVE_MONTH":
      return 22;
    case "SIX_MONTH":
      return 26;
    case "CUSTOM":
      return customMonths && customMonths > 0 ? customMonths * 4 : 26;
    default:
      return 26;
  }
}
