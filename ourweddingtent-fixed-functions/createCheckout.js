const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event, context) {
  try {
    const data = JSON.parse(event.body);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Vendor Spot - ${data.vendorName}`,
            description: data.notes || ''
          },
          unit_amount: parseInt(data.amount, 10) * 100
        },
        quantity: 1,
      }],
      customer_email: data.businessEmail,
      success_url: 'https://www.ourweddingtent.com/thank-you.html',
      cancel_url: 'https://www.ourweddingtent.com/admin.html',
      metadata: {
        vendor_id: data.vendorID,
        sales_rep_email: data.ccEmail || ''
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
