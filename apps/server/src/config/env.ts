import dotenv from 'dotenv';

dotenv.config();

export type ServerEnv = {
  port: number;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
};

export function readEnv(): ServerEnv {
  return {
    port: Number(process.env.PORT ?? 8787),
    llmBaseUrl: process.env.LLM_BASE_URL ?? '',
    llmApiKey: process.env.LLM_API_KEY ?? '',
    llmModel: process.env.LLM_MODEL ?? 'gpt-4o-mini'
  };
}
