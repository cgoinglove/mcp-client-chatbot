import type { MCPServerConfig } from "app-types/mcp";
import { pgDb as db } from "../db.pg";
import { McpServerSchema } from "../schema.pg";
import { eq } from "drizzle-orm";
import { generateUUID } from "lib/utils";

// Define interface for the repository
export interface MCPRepository {
  createServer(server: {
    name: string;
    config: MCPServerConfig;
    enabled?: boolean;
  }): Promise<string>;
  getServer(id: string): Promise<{
    id: string;
    name: string;
    config: MCPServerConfig;
    enabled: boolean;
  } | null>;
  getServerByName(name: string): Promise<{
    id: string;
    name: string;
    config: MCPServerConfig;
    enabled: boolean;
  } | null>;
  getAllServers(): Promise<
    { id: string; name: string; config: MCPServerConfig; enabled: boolean }[]
  >;
  updateServer(
    id: string,
    data: { name?: string; config?: MCPServerConfig; enabled?: boolean },
  ): Promise<void>;
  deleteServer(id: string): Promise<void>;
  hasServerWithName(name: string): Promise<boolean>;
}

export const pgMcpRepository: MCPRepository = {
  async createServer(server) {
    const [result] = await db
      .insert(McpServerSchema)
      .values({
        id: generateUUID(),
        name: server.name,
        config: server.config,
        enabled: server.enabled ?? true,
      })
      .returning();

    return result.id;
  },

  async getServer(id) {
    const [result] = await db
      .select()
      .from(McpServerSchema)
      .where(eq(McpServerSchema.id, id));

    if (!result) return null;

    return {
      id: result.id,
      name: result.name,
      config: result.config as MCPServerConfig,
      enabled: result.enabled,
    };
  },

  async getServerByName(name) {
    const [result] = await db
      .select()
      .from(McpServerSchema)
      .where(eq(McpServerSchema.name, name));

    if (!result) return null;

    return {
      id: result.id,
      name: result.name,
      config: result.config as MCPServerConfig,
      enabled: result.enabled,
    };
  },

  async getAllServers() {
    const results = await db.select().from(McpServerSchema);

    return results.map((result) => ({
      id: result.id,
      name: result.name,
      config: result.config as MCPServerConfig,
      enabled: result.enabled,
    }));
  },

  async updateServer(id, data) {
    await db
      .update(McpServerSchema)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(McpServerSchema.id, id));
  },

  async deleteServer(id) {
    await db.delete(McpServerSchema).where(eq(McpServerSchema.id, id));
  },

  async hasServerWithName(name) {
    const [result] = await db
      .select({ id: McpServerSchema.id })
      .from(McpServerSchema)
      .where(eq(McpServerSchema.name, name));

    return !!result;
  },
};
