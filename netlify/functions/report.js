export default async (req, context) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }
    const body = await req.json()

    // TODO: plug into your email provider (Postmark/SES/etc.)
    // For now, just log + return a success.
    console.log('Report request:', JSON.stringify(body).slice(0, 2000))

    // Example: persist to Netlify Forms, Airtable, or your backend here.

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error('report error', e)
    return new Response(`Report error: ${String(e)}`, { status: 500 })
  }
}
