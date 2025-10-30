import { Buffer } from 'buffer';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Use the actual environment variable names from Vercel
  const clientId = process.env.AYb8FfXzrPCKiyxXzGtyGDiK4OouKRF3NEmyCIB3WdxsDQBICOcq5dGQUblS0oVa5RFPazOPJk7PUqIC;
  const secret = process.env.ECMbpOpCG0DjbM6TAgQ6cy9mtR1WzetLGpdfItv35B7GXyCZEqLwSQb_hlnjgbTYnD3XkVoZ06rrcEmB;

  // PayPal passes the order ID as 'token' on return_url
  const { token: orderId } = req.query; 

  if (!orderId) {
    // If the token is missing, redirect to a failure page
    res.writeHead(302, { Location: 'https://ggsels.vercel.app/failure?message=MissingOrderID' });
    return res.end();
  }

  if (!clientId || !secret) {
    console.error("Configuration Error: API credentials are not set.");
    // Redirect to a failure page on server config error
    res.writeHead(302, { Location: 'https://ggsels.vercel.app/failure?message=ConfigError' });
    return res.end();
  }
  
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

  try {
    // 1. Capture the order using the order ID (token)
    const capture = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    });

    const result = await capture.json();

    if (capture.ok && result.status === 'COMPLETED') {
      console.log('Payment Completed:', result.id);
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
