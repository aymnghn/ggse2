import { Buffer } from 'buffer';
import fetch from 'node-fetch'; // Kept for compatibility with older Vercel/Node runtimes

export default async function handler(req, res) {
  // CRITICAL FIX: The Vercel key appears to be 'ClientId' (capital 'I'),
  // but the code used 'Clientid' (lowercase 'i'). Case must match exactly.
  const clientId = process.env.ClientId; 
  const secret = process.env.secret;
  
  const { amount, description } = req.query;

  if (!clientId || !secret) {
    // This configuration error should now be fixed with the case correction above.
    return res.status(500).json({ error: "Configuration Error: ClientId or secret environment variables are missing." });
  }

  if (!amount || !description) {
    return res.status(400).json({ error: "Missing required query parameters: amount and description." });
  }

  // Ensure amount is a string with two decimal places for PayPal
  const formattedAmount = parseFloat(amount).toFixed(2);
  
  // Basic Auth header generation: Base64 encode 'ClientId:secret'
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

  // 1. Create order on PayPal LIVE API
  // *** THIS IS THE CRITICAL LINE CHANGE ***
  const response = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: formattedAmount },
          description: description || "Product Purchase"
        }
      ],
      application_context: {
        // You MUST use the full Vercel URL for the redirect and status endpoints
        // Using a placeholder for your app's actual Vercel domain
        return_url: `https://ggsels.vercel.app/api/order-status`, 
        cancel_url: `https://ggsels.vercel.app/cancel`,
        brand_name: 'GGSel Payment Gateway', // Optional: customize the checkout page
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW'
      }
    })
  });

  const data = await response.json();

  if (response.ok && data.id) {
    // 2. Find the approval link to redirect the user
    const approveLink = data.links.find(link => link.rel === 'approve');
    
    if (approveLink) {
      // 3. Redirect the user's browser to the PayPal payment page (302)
      console.log(`Order created. Redirecting to: ${approveLink.href}`);
      res.writeHead(302, { Location: approveLink.href });
      return res.end();
    } else {
      console.error('PayPal Response Missing Approve Link:', data);
      return res.status(500).json({ error: "Order created, but missing payment approval link." });
    }
  } else {
    // Handle PayPal API errors (e.g., INVALID_CLIENT or validation errors)
    console.error('PayPal API Error:', data);
    return res.status(response.status).json({ 
      error: data.name || "PayPal API Error", 
      details: data.message || "Failed to create order." 
    });
  }
}
