const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  try {
    const data = JSON.parse(event.body);
    const { vendor_id, vendor_name, email, cc_email, amount, notes } = data;

    // 1. Create Stripe customer
    const customer = await stripe.customers.create({
      email,
      metadata: {
        vendor_id,
        vendor_name,
        notes
      }
    });

    // 2. Create Stripe Checkout Session with card storage for future use
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'payment',
      payment_method_types: ['card'],
      payment_intent_data: {
        setup_future_usage: 'off_session' // ✅ Correct placement
      },
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Lead Credit – ${vendor_name}`,
            ...(notes ? { description: notes } : {}) // ✅ Only include if not blank
          },
          unit_amount: parseInt(amount) * 100
        },
        quantity: 1
      }],
      success_url: 'https://ourweddingtent.com/thank-you.html',
      cancel_url: 'https://ourweddingtent.com/admin.html'
    });

    // 3. Email checkout link to vendor + sales rep
    await resend.emails.send({
      from: 'sales@ourweddingtent.com', // ✅ Must be a verified Resend sender
      to: [email, cc_email].filter(Boolean),
      subject: `Lead Credit Payment – ${vendor_name}`,
      html: `
        <p>Hello,</p>
        <p>A checkout link has been generated for <strong>${vendor_name}</strong>.</p>
        <p><a href="${session.url}">Click here to complete the payment of $${amount}</a>.</p>
        ${notes ? `<p><em>Note: ${notes}</em></p>` : ''}
      `
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };

  } catch (err) {
    console.error('Checkout session error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Stripe session creation failed.' })
    };
  }
};
