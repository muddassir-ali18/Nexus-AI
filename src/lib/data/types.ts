export type DataSourceKind = "csv" | "manual" | "unknown";

export type DataSourceRef = {
  id: string;
  kind: DataSourceKind;
  label: string;
};

export type InvestigationContext = {
  questionId: string;
  sources: DataSourceRef[];
};

export type Evidence = {
  id: string;
  source: string;
  claim: string;
  value?: unknown;
  toolName: string;
};
