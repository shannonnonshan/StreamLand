import { Logger } from '@nestjs/common';

interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

interface StreamingTranscribeResponse {
  status: 'processing' | 'success' | 'error';
  data?: unknown;
  error?: string;
  message?: string;
  elapsed_seconds?: number;
}

// Default timeout for AI service calls (transcription can take a long time)
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function logFetch(
  input: RequestInfo,
  init?: FetchOptions,
  logger: Logger | Console = console,
) {
  const start = Date.now();
  const method = (init?.method || 'GET').toUpperCase();
  const timeoutMs = init?.timeoutMs || DEFAULT_TIMEOUT_MS; // Default 30 minutes, can be overridden
  
  let safeBody = '';
  try {
    if (init?.body) {
      if (typeof init.body === 'string') safeBody = init.body.slice(0, 1000);
      else if (init.body instanceof FormData) safeBody = '[FormData]';
      else safeBody = JSON.stringify(init.body).slice(0, 1000);
    }
  } catch {
    safeBody = '[unserializable body]';
  }

  const logPrefix = '[AI FETCH]';
  const log = (logger as any).log ? (msg: string, ...args: any[]) => (logger as any).log(msg, ...args) : (msg: string, ...args: any[]) => (logger as Console).log(msg, ...args);
  const error = (logger as any).error ? (msg: string, ...args: any[]) => (logger as any).error(msg, ...args) : (msg: string, ...args: any[]) => (logger as Console).error(msg, ...args);

  log(`${logPrefix} → ${method} ${String(input)} timeout=${timeoutMs}ms body=${safeBody || '<empty>'}`);

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
      bodyTimeout: timeoutMs, // undici body timeout
      headersTimeout: timeoutMs, // undici headers timeout
    } as any);

    clearTimeout(timeoutId);
    const took = Date.now() - start;
    let text = '';
    try {
      text = await res.clone().text();
    } catch {
      text = '<non-text response>';
    }
    const truncated = text.length > 1000 ? text.slice(0, 1000) + '...' : text;
    log(`${logPrefix} ← ${res.status} ${res.statusText} (${took}ms) ${String(input)} response=${truncated}`);
    return res;
  } catch (err) {
    const took = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    error(`${logPrefix} ✖ ${method} ${String(input)} error (${took}ms):`, errMsg);
    throw err;
  }
}

/**
 * Handle streaming transcribe response (NDJSON format).
 * Reads line-by-line until status is "success" or "error".
 */
export async function logStreamingTranscribe(
  input: RequestInfo,
  init?: FetchOptions,
  logger: Logger | Console = console,
) {
  const start = Date.now();
  const method = (init?.method || 'GET').toUpperCase();
  const timeoutMs = init?.timeoutMs || DEFAULT_TIMEOUT_MS;

  let safeBody = '';
  try {
    if (init?.body) {
      if (typeof init.body === 'string') safeBody = init.body.slice(0, 1000);
      else if (init.body instanceof FormData) safeBody = '[FormData]';
      else safeBody = JSON.stringify(init.body).slice(0, 1000);
    }
  } catch {
    safeBody = '[unserializable body]';
  }

  const logPrefix = '[AI TRANSCRIBE]';
  const log = (logger as any).log ? (msg: string, ...args: any[]) => (logger as any).log(msg, ...args) : (msg: string, ...args: any[]) => (logger as Console).log(msg, ...args);
  const error = (logger as any).error ? (msg: string, ...args: any[]) => (logger as any).error(msg, ...args) : (msg: string, ...args: any[]) => (logger as Console).error(msg, ...args);

  log(`${logPrefix} → ${method} ${String(input)} timeout=${timeoutMs}ms body=${safeBody || '<empty>'}`);

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
      bodyTimeout: timeoutMs,
      headersTimeout: timeoutMs,
    } as any);

    if (!res.ok) {
      clearTimeout(timeoutId);
      const errorBody = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorBody}`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let lastLine = '';
    let finalResponse: StreamingTranscribeResponse | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Process all complete lines
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          try {
            const json = JSON.parse(line) as StreamingTranscribeResponse;
            lastLine = line;

            if (json.status === 'processing') {
              const elapsed = json.elapsed_seconds ? ` (${json.elapsed_seconds}s elapsed)` : '';
              log(`${logPrefix} ⏳ ${json.message}${elapsed}`);
            } else if (json.status === 'success') {
              log(`${logPrefix} ✓ Transcription completed`);
              finalResponse = json;
              break;
            } else if (json.status === 'error') {
              error(`${logPrefix} ✗ Transcription error: ${json.error}`);
              finalResponse = json;
              break;
            }
          } catch (parseErr) {
            error(`${logPrefix} Failed to parse line: ${line}`, parseErr);
          }
        }

        // Keep last incomplete line in buffer
        buffer = lines[lines.length - 1];

        // Break if we got final response
        if (finalResponse) break;
      }
    } finally {
      reader.releaseLock();
      clearTimeout(timeoutId);
    }

    if (!finalResponse) {
      throw new Error('No valid response from transcribe service');
    }

    if (finalResponse.status === 'error') {
      throw new Error(`Transcribe error: ${finalResponse.error}`);
    }

    const took = Date.now() - start;
    log(`${logPrefix} ← Success (${took}ms)`);

    return finalResponse;
  } catch (err) {
    const took = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    error(`${logPrefix} ✖ ${method} ${String(input)} error (${took}ms):`, errMsg);
    throw err;
  }
}

export default logFetch;
