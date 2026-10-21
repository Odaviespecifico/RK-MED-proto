import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import Stripe from 'stripe';

export const API_VERSION = '2026-09-30.endive';
export const AMOUNT = 6960;
export const EVENTS = [
  'checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'invoice.paid', 'invoice.payment_failed',
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'charge.dispute.created', 'charge.refunded', 'radar.early_fraud_warning.created',
];

export class SandboxError extends Error {}

export function readConfig(env = process.env, { requireKey = false, requireWebhook = false } = {}) {
  const environment = env.STRIPE_TEST_ENV || 'local';
  if (!['local', 'ci', 'staging'].includes(environment)) {
    throw new SandboxError('STRIPE_TEST_ENV deve ser local, ci ou staging. Produção não é suportada.');
  }
  const key = env.STRIPE_SECRET_KEY || '';
  if ((key && !/^(rk_test_|sk_test_|rkcs_test_)[A-Za-z0-9]+$/.test(key)) || (requireKey && !key)) {
    throw new SandboxError('Configure uma chave Stripe de TESTE em STRIPE_SECRET_KEY.');
  }
  const accountId = env.STRIPE_TEST_ACCOUNT_ID || '';
  if ((accountId && !/^acct_[A-Za-z0-9]+$/.test(accountId)) || (requireKey && !accountId)) {
    throw new SandboxError('Configure STRIPE_TEST_ACCOUNT_ID com o ID do sandbox esperado.');
  }
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET || '';
  if ((webhookSecret && !/^whsec_[A-Za-z0-9]+$/.test(webhookSecret)) || (requireWebhook && !webhookSecret)) {
    throw new SandboxError('Configure STRIPE_WEBHOOK_SECRET com o segredo do listener de testes.');
  }
  let origin;
  try { origin = new URL(env.STRIPE_TEST_ORIGIN || 'http://127.0.0.1:4242'); }
  catch { throw new SandboxError('STRIPE_TEST_ORIGIN inválida.'); }
  if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(origin.hostname)
    || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new SandboxError('STRIPE_TEST_ORIGIN deve ser uma origem HTTP de loopback, sem caminho ou credenciais.');
  }
  return { environment, key, accountId, webhookSecret, origin: origin.origin, port: Number(origin.port || 80) };
}

export function loadConfig(options) {
  const file = process.env.STRIPE_ENV_FILE || '.env.stripe.local';
  let fileEnv = {};
  try { fileEnv = parseEnv(readFileSync(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new SandboxError('Não foi possível ler o arquivo de ambiente Stripe.'); }
  // CI/secret-store values take precedence over the local file.
  return readConfig({ ...fileEnv, ...process.env }, options);
}

export function stripeClient(config) {
  if (!config.key || !config.accountId) throw new SandboxError('Credenciais de sandbox ausentes.');
  return new Stripe(config.key, { apiVersion: API_VERSION, maxNetworkRetries: 2, timeout: 20_000 });
}

export async function verifyAccount(stripe, config) {
  const account = await stripe.accounts.retrieve();
  if (account.id !== config.accountId) throw new SandboxError('A chave pertence a uma conta diferente do sandbox esperado.');
  return account;
}

export function assertTestObject(object) {
  if (object.livemode !== false) throw new SandboxError('Objeto sem confirmação explícita de modo de teste. Operação interrompida.');
  return object;
}

export function reportError(error) {
  if (error instanceof SandboxError) console.error(error.message);
  else console.error('Falha na operação Stripe. Confira permissões, conexão e Workbench do sandbox. Nenhuma credencial foi exibida.');
  process.exitCode = 1;
}
