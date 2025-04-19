const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  try {
    const data = JSON.parse(event.body);
    const { vendor_id, vendor_name, email, cc_email, amount, notes } = data;

    // 1. Create a Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Lead Credit – ${vendor_name}`,
            description: notes || 'Lead credit payment'
          },
          unit_amount: parseInt(amount) * 100
        },
        quantity: 1
      }],
      success_url: 'https://ourweddingtent.com/thank-you.html',
      cancel_url: 'https://ourweddingtent.com/admin.html',
      customer_creation: 'always'
    });

    // 2. Send the checkout link via email
    await resend.emails.send({
      from: 'sales@mail.ourweddingtent.com', // ✅ Verified domain
      to: [email, cc_email].filter(Boolean),
      subject: `Lead Credit Payment – ${vendor_name}`,
      html: `
        <p>Hello,</p>
        <p>A payment link has been generated for <strong>${vendor_name}</strong>.</p>
        <p><a href="${session.url}">Click here to complete the payment of $${amount}</a>.</p>
        ${notes ? `<p><em>Note: ${notes}</em></p>` : ''}
      `
    });

    console.log('✅ Email sent to:', [email, cc_email].filter(Boolean));

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
