import { Logger } from '@nestjs/common';
import { Agent } from 'http';
import { Agent as HttpsAgent } from 'https';

interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

// Create HTTP/HTTPS agents with long timeouts for AI transcription
const httpAgent = new Agent({
  keepAlive: true,
  timeout: 10 * 60 * 1000, // 10 minutes
});

const httpsAgent = new HttpsAgent({
  keepAlive: true,
  timeout: 10 * 60 * 1000, // 10 minutes
});

export async function logFetch(
  input: RequestInfo,
  init?: FetchOptions,
  logger: Logger | Console = console,
) {
  const start = Date.now();
  const method = (init?.method || 'GET').toUpperCase();
  const timeoutMs = init?.timeoutMs || 15 * 60 * 1000; // Default 15 minutes, can be overridden
  
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

    // Determine which agent to use based on URL
    const urlStr = String(input);
    const isHttps = urlStr.startsWith('https://');
    const agent = isHttps ? httpsAgent : httpAgent;

    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
      // @ts-ignore - dispatcher option is supported by undici but not in TypeScript definitions
      dispatcher: agent,
    });

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

export default logFetch;
