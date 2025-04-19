const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  try {
    const data = JSON.parse(event.body);
    const { vendor_id, vendor_name, email, cc_email, amount, notes } = data;

    // 1. Create customer in Stripe with metadata
    const customer = await stripe.customers.create({
      email,
      metadata: {
        vendor_id,
        vendor_name,
        notes
      }
    });

    // 2. Create Stripe Checkout session (no customer_creation!)
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Lead Credit – ${vendor_name}`,
            description: notes || 'Lead credit purchase'
          },
          unit_amount: parseInt(amount) * 100
        },
        quantity: 1
      }],
      success_url: 'https://ourweddingtent.com/thank-you.html',
      cancel_url: 'https://ourweddingtent.com/admin.html'
    });

    // 3. Send checkout link via email
    const recipients = [email, cc_email].filter(Boolean);
    console.log('📨 Sending checkout link to:', recipients);

    await resend.emails.send({
      from: 'sales@ourweddingtent.com',
      to: recipients,
      subject: `Lead Credit Payment – ${vendor_name}`,
      html: `
        <p>Hello,</p>
        <p>A payment link has been generated for <strong>${vendor_name}</strong>.</p>
        <p><a href="${session.url}">Click here to complete the $${amount} payment</a>.</p>
        ${notes ? `<p><em>Note: ${notes}</em></p>` : ''}
      `
    });

    console.log('✅ Email sent');

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error('❌ Checkout session error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Stripe session creation failed.' })
    };
  }
};
