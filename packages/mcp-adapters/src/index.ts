export interface MCPRequest {
  capability: string;
  operation: string;
  input: Record<string, unknown>;
}

export interface MCPResponse<TData = unknown> {
  ok: boolean;
  data?: TData;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface MCPProvider {
  readonly id: string;
  readonly capabilities: readonly string[];
  invoke(request: MCPRequest): Promise<MCPResponse>;
}
