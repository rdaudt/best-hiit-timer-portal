export type NodeReq = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

export type NodeRes = {
  setHeader?: (name: string, value: string | string[]) => void;
  end?: (body?: string | Buffer) => void;
  status: (code: number) => { json: (body: unknown) => void };
};

export function errorResponse(code: string, message: string, details?: unknown) {
  return {
    error: {
      code,
      message,
      details: details ?? null,
    },
  };
}

export const nowIso = () => new Date().toISOString();
