export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type SourceChunk = {
  chunk_id: string;
  score: number;
  title?: string | null;
  source?: string | null;
  text: string;
};

export type TraceStep = {
  name: string;
  detail: string;
};

export type QueryResponse = {
  answer: string;
  sources: SourceChunk[];
  trace: TraceStep[];
};
