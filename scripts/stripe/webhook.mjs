import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import Stripe from 'stripe';
import { EVENTS, loadConfig, reportError } from './config.mjs';

const MAX_BODY = 1024 * 1024;
const idPattern = /^[a-z]+_[A-Za-z0-9_]+$/;

export function receiveEvent(stripe, config, body, signature, directory) {
  let event;
  try { event = stripe.webhooks.constructEvent(body, signature, config.webhookSecret); }
  catch { return { status: 400, result: 'invalid_signature' }; }
  if (event.livemode !== false) return { status: 400, result: 'test_events_only' };
  if (typeof event.id !== 'string' || !/^evt_[A-Za-z0-9_]+$/.test(event.id)
    || !Number.isSafeInteger(event.created) || event.created < 0) {
    return { status: 400, result: 'invalid_event' };
  }
  if (!EVENTS.includes(event.type)) return { status: 200, result: 'ignored' };
  const record = {
    id: event.id, type: event.type, created: event.created, livemode: false,
    environment: config.environment,
    objectId: typeof event.data?.object?.id === 'string' && idPattern.test(event.data.object.id) ? event.data.object.id : null,
  };
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = join(directory, `${event.id}.json`);
  try { writeFileSync(file, JSON.stringify(record) + '\n', { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // A partial/corrupt receipt must not silently acknowledge an event as persisted.
    const previous = JSON.parse(readFileSync(file, 'utf8'));
    if (previous.id !== record.id || previous.type !== record.type) throw new Error('Invalid receipt');
    return { status: 200, result: 'duplicate' };
  }
  return { status: 200, result: 'recorded' };
}

export function webhookServer(config, directory) {
  // Signature verification is offline and does not require an API key or API requests.
  const stripe = new Stripe('signature-verification-only');
  return createServer(async (req, res) => {
    const reply = (status, result) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ result }));
    };
    const path = req.url?.split('?')[0];
    if (req.method === 'GET' && ['/health', '/success', '/cancel'].includes(path)) {
      reply(200, path === '/health' ? 'test_receiver_only' : 'Retorno de teste. Nenhum benefício foi ativado.');
      return;
    }
    if (req.method !== 'POST' || path !== '/webhook') { reply(404, 'not_found'); return; }
    try {
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > MAX_BODY) { reply(413, 'payload_too_large'); req.resume(); return; }
        chunks.push(chunk);
      }
      const signature = req.headers['stripe-signature'];
      if (typeof signature !== 'string') { reply(400, 'invalid_signature'); return; }
      const { status, result } = receiveEvent(stripe, config, Buffer.concat(chunks), signature, directory);
      reply(status, result);
    } catch { reply(500, 'receipt_not_saved'); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const config = loadConfig({ requireWebhook: true });
    const directory = resolve('.local/stripe', config.environment, config.accountId || 'local-signature-tests', 'events');
    const server = webhookServer(config, directory);
    server.on('error', reportError);
    server.listen(config.port, '127.0.0.1', () => {
      console.log(`Receptor de testes: http://127.0.0.1:${config.port}/webhook. Não ativa associados.`);
    });
    for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
  } catch (error) { reportError(error); }
}
