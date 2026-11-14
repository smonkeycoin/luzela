/* QA process preload only. Never imported by application code or enabled in deployment.
 * Real catalog reads are allowed; all remote database/payment/email mutations fail closed.
 * A single synthetic checkout/order lets the unchanged payment page render the real SDK.
 */
const realFetch = globalThis.fetch;
const sessionId = '00000000-0000-4000-8000-000000000004';
const orderId = '00000000-0000-4000-8000-000000000005';
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
globalThis.fetch = async function(input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (url.hostname.endsWith('.supabase.co')) {
    if (method === 'GET' && url.pathname.endsWith('/checkout_sessions') && url.searchParams.get('id') === `eq.${sessionId}`)
      return json({ id: sessionId, order_id: orderId, email: 'qa-v4@example.invalid' });
    if (method === 'GET' && url.pathname.endsWith('/orders') && url.searchParams.get('id') === `eq.${orderId}`)
      return json({ id: orderId, order_number: 'QA-V4-LOCAL-ONLY', subtotal_cents: 81900, discount_cents: 5000, discount_code: 'SUMMER DROP', shipping_cents: 0, total_cents: 76900, currency: 'mxn', order_items: [{ name: 'SUMMER 3X (QA)', quantity: 1, unit_price_cents: 81900, metadata: {} }] });
    const readOnlyRpc = method === 'POST' && url.pathname.endsWith('/rpc/get_summer_drop_availability');
    if (!['GET','HEAD'].includes(method) && !readOnlyRpc)
      return new Response(JSON.stringify({ message: 'V4 QA: remote mutations disabled' }), { status: 403, headers: {'content-type':'application/json'} });
  }
  if (['api.mercadopago.com','api.resend.com','api.stripe.com'].includes(url.hostname) && !['GET','HEAD'].includes(method))
    throw new Error('V4 QA: payment and email mutations disabled');
  return realFetch.call(this,input,init);
};
