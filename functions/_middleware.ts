// Cloudflare Pages Functions middleware
export async function onRequest(context: any) {
  const url = new URL(context.request.url);
  
  // Redirect API calls to Workers
  if (url.pathname.startsWith('/api/')) {
    const workerUrl = 'https://cozy-soccer-champ.cozzy-soccer.workers.dev' + url.pathname + url.search;
    return fetch(workerUrl, {
      method: context.request.method,
      headers: context.request.headers,
      body: context.request.body,
    });
  }
  
  // Continue to next middleware/page
  return context.next();
}
