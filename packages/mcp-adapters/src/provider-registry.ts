import type { MCPProvider } from "./index";

export class MCPProviderRegistry {
  private readonly providers = new Map<string, MCPProvider[]>();

  constructor(initialProviders: readonly MCPProvider[] = []) {
    for (const provider of initialProviders) {
      this.register(provider);
    }
  }

  register(provider: MCPProvider): void {
    for (const capability of provider.capabilities) {
      const providers = this.providers.get(capability) ?? [];
      providers.push(provider);
      this.providers.set(capability, providers);
    }
  }

  resolve(capability: string): MCPProvider {
    const provider = this.providers.get(capability)?.[0];
    if (!provider) {
      throw new Error(`No MCP provider registered for capability: ${capability}`);
    }

    return provider;
  }

  resolveAll(capability: string): readonly MCPProvider[] {
    return this.providers.get(capability) ?? [];
  }

  has(capability: string): boolean {
    return (this.providers.get(capability)?.length ?? 0) > 0;
  }
}
