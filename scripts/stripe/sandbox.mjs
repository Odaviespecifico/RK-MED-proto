import { copyFileSync, constants } from 'node:fs';
import { loadConfig, stripeClient, verifyAccount, API_VERSION, reportError } from './config.mjs';
import { ensureCatalog, createCheckout, createDraftInvoice } from './fixtures.mjs';

try {
  const command = process.argv[2];
  if (command === 'init') {
    try {
      copyFileSync('.env.stripe.example', '.env.stripe.local', constants.COPYFILE_EXCL);
      const { chmodSync } = await import('node:fs');
      chmodSync('.env.stripe.local', 0o600);
      console.log('.env.stripe.local criado, sem credenciais. Configure somente chaves de teste.');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      console.log('.env.stripe.local já existe e foi preservado.');
    }
  } else if (command === 'doctor') {
    const config = loadConfig();
    console.log(JSON.stringify({
      environment: config.environment, apiVersion: API_VERSION, origin: config.origin,
      testKeyConfigured: Boolean(config.key), expectedAccountConfigured: Boolean(config.accountId),
      webhookSecretConfigured: Boolean(config.webhookSecret), remoteConnectionVerified: false,
      note: 'Diagnóstico local. Sem chamadas à API e sem integração com a elegibilidade RKMED.',
    }, null, 2));
  } else if (['bootstrap', 'checkout', 'invoice'].includes(command)) {
    const config = loadConfig({ requireKey: true });
    const stripe = stripeClient(config);
    await verifyAccount(stripe, config);
    if (command === 'bootstrap') {
      const { product, price } = await ensureCatalog(stripe, config);
      console.log(JSON.stringify({ environment: config.environment, product: product.id, price: price.id, amount: price.unit_amount, currency: price.currency }));
    } else if (command === 'checkout') {
      const session = await createCheckout(stripe, config);
      // Checkout URL is a test capability. Display only on an explicit operator command.
      console.log(JSON.stringify({ id: session.id, url: session.url, livemode: session.livemode }));
    } else {
      const invoice = await createDraftInvoice(stripe, config);
      console.log(JSON.stringify({ id: invoice.id, status: invoice.status, total: invoice.total, livemode: invoice.livemode }));
    }
  } else {
    console.error('Comandos: init, doctor, bootstrap, checkout, invoice. Veja docs/stripe-testes.md.');
    process.exitCode = 1;
  }
} catch (error) { reportError(error); }
