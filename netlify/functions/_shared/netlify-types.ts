export type HandlerEvent = {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  queryStringParameters: Record<string, string | undefined> | null;
};

export type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
};

export type Handler = (event: HandlerEvent) => Promise<HandlerResponse> | HandlerResponse;
