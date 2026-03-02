// supabase/functions/create-checkout/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@13.10.0?target=deno"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS (So your app can talk to this)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Get Stripe Key
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // 2. Get data from App
    const { restaurant_id, stripe_account_id, amount } = await req.json()

    console.log(`Creating payment for ${restaurant_id} (${stripe_account_id}) - $${amount}`)

    // 3. Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Rasvia Group Order',
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'rasvia://checkout/success', // <--- DEEP LINK
      cancel_url: 'rasvia://checkout/cancel',
      
      // 4. THE CRITICAL PART: Send money to Restaurant
      payment_intent_data: {
        application_fee_amount: 0, // You take $0
        transfer_data: {
          destination: stripe_account_id, 
        },
      },
    })

    // 5. Return URL
    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})