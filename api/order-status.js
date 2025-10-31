import { Buffer } from 'buffer';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // CRITICAL FIX: Use the actual environment variable KEYS (ClientId, secret)
  // as defined in Vercel, not the long secret VALUES.
  const clientId = process.env.ClientId;
  const secret = process.env.secret;

  // PayPal passes the order ID as 'token' on return_url
  const { token: orderId } = req.query; 

  if (!orderId) {
    console.error("Missing required query parameter: token (PayPal Order ID).");
    // If the token is missing, redirect to a failure page
    res.writeHead(302, { Location: 'https://ggsels.vercel.app/failure?message=MissingOrderID' });
    return res.end();
  }

  if (!clientId || !secret) {
    console.error("Configuration Error: ClientId or secret environment variables are not set.");
    // Redirect to a failure page on server config error
    res.writeHead(302, { Location: 'https://ggsels.vercel.app/failure?message=ConfigError' });
    return res.end();
  }
  
  // Basic Auth header generation: Base64 encode 'ClientId:secret'
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

  try {
    // 1. Capture the order using the order ID (token)
    // *** CRITICAL CHANGE: Switched from sandbox.paypal.com to paypal.com for LIVE API ***
    const capture = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        // You generally only need a Bearer token here if you get one in step 1, 
        // but Basic Auth with ClientId/secret often works for capture too.
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    });

    const result = await capture.json();

    if (capture.ok && result.status === 'COMPLETED') {
      console.log('Payment Completed:', result.id);
      
      // OPTIONAL: You may want to log or save the full result here 
      // (e.g., to your database) to verify the payment details.

      // Redirect back to your frontend on success
      res.writeHead(302, { Location: `https://ggsels.vercel.app/success?order=${orderId}` });
      return res.end();
    } else {
      console.error('Capture Failed:', result);
      // Redirect back to your frontend on failure
      res.writeHead(302, { Location: `https://ggsels.vercel.app/failure?order=${orderId}` });
      return res.end();
    }
  } catch (error) {
    console.error('Error during capture:', error);
    // Redirect on network/server error
    res.writeHead(302, { Location: 'https://ggsels.vercel.app/failure?message=ServerError' });
    return res.end();
  }
}
