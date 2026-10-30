export type BuildInvestigateRequestInput = {
  question: string;
  csvFile?: File | null;
};

export type BuiltInvestigateRequest = {
  init: RequestInit;
  mode: "json" | "multipart";
};

export function buildInvestigateFetchRequest(
  input: BuildInvestigateRequestInput,
): BuiltInvestigateRequest {
  const trimmedQuestion = input.question.trim();

  if (input.csvFile) {
    const formData = new FormData();
    formData.append("question", trimmedQuestion);
    formData.append("file", input.csvFile, input.csvFile.name);

    return {
      mode: "multipart",
      init: {
        method: "POST",
        body: formData,
      },
    };
  }

  return {
    mode: "json",
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: trimmedQuestion }),
    },
  };
}

export function validateClientCsvSelection(file: File | null | undefined): string | null {
  if (!file) {
    return "Select a CSV file.";
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return "Only .csv files are supported.";
  }

  return null;
}
