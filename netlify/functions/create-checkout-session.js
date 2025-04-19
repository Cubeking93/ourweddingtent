const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  try {
    const data = JSON.parse(event.body);
    const { vendor_id, vendor_name, email, cc_email, amount, notes } = data;

    // 1. Create customer in Stripe
    const customer = await stripe.customers.create({
      email,
      metadata: {
        vendor_id,
        vendor_name,
        notes
      }
    });

    // 2. Create Stripe Checkout session (❗️ removed customer_email)
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Lead Credit – ${vendor_name}`,
            description: notes || ''
          },
          unit_amount: parseInt(amount) * 100
        },
        quantity: 1
      }],
      success_url: 'https://ourweddingtent.com/thank-you.html',
      cancel_url: 'https://ourweddingtent.com/admin.html'
    });

    // 3. Send checkout link via Resend
    await resend.emails.send({
      from: 'sales@ourweddingtent.com',
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
