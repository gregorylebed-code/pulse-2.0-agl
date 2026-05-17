import * as Sentry from '@sentry/react';

interface AiErrorMeta {
  noteLength?: number;
  transcriptLength?: number;
  noteCount?: number;
  tagCount?: number;
  hadManualTags?: boolean;
  reportLength?: number;
  instructionsLength?: number;
  model?: string;
}

export function captureAiFlowError(flow: string, err: unknown, meta?: AiErrorMeta) {
  const extra: Record<string, unknown> = { ...(meta ?? {}) };
  Sentry.captureException(err, {
    tags: { flow },
    extra,
  });
}
