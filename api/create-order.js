import { parse } from 'url';
import { Buffer } from 'buffer';
import fetch from 'node-fetch';

// *** CRITICAL CHANGE: Set base URL to LIVE API ***
const PAYPAL_BASE_URL = 'https://api.paypal.com';

export default async function handler(req, res) {
    const clientId = process.env.ClientId;
    const secret = process.env.secret;

    if (!clientId || !secret) {
        return res.status(500).json({ error: 'Configuration Error: ClientId or secret environment variables are missing.' });
    }

    // 1. Get Access Token (Required for all V2 API calls)
    const authString = Buffer.from(`${clientId}:${secret}`).toString('base64');
    
    let accessToken;
    try {
        // *** CRITICAL FIX: Token endpoint must use the LIVE URL ***
        const tokenResponse = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.json();
            console.error('PayPal Token Error (LIVE):', error);
            // This error often means invalid Live ClientID/Secret
            throw new Error('Failed to obtain access token (Check Vercel Live Credentials).');
        }

        const tokenData = await tokenResponse.json();
        accessToken = tokenData.access_token;

    } catch (error) {
        console.error('Authentication or Token Fetch Error:', error);
        return res.status(500).json({ error: 'Failed to authenticate with PayPal: ' + error.message });
    }
    
    // Parse URL Parameters
    const { query } = parse(req.url, true);
    const amount = query.amount || '1.00';
    const description = query.description || 'Digital Product Purchase';

    // 2. Create Order Request (using the acquired Access Token)
    const orderPayload = {
        intent: 'CAPTURE',
        purchase_units: [{
            amount: {
                currency_code: 'USD',
                value: parseFloat(amount).toFixed(2),
            },
            description: description
        }],
        application_context: {
            // These URLs should be correct
            return_url: `https://ggsels.vercel.app/api/order-status`, 
            cancel_url: `https://ggsels.vercel.app/failure?message=Canceled`, 
            brand_name: 'GGSel Payment Gateway',
            user_action: 'PAY_NOW'
        },
    };

    try {
        // *** Order creation endpoint must use the LIVE URL ***
        const orderResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`, // Use the Bearer token here
            },
            body: JSON.stringify(orderPayload),
        });

        if (!orderResponse.ok) {
            const error = await orderResponse.json();
            console.error('PayPal Order Creation Error (LIVE):', error);
            throw new Error('Failed to create order. Check PayPal settings or API logs.');
        }

        const orderData = await orderResponse.json();
        
        // 3. Redirect to PayPal Approval Link
        const approvalLink = orderData.links.find(link => link.rel === 'approve');
        
        if (approvalLink) {
            res.writeHead(302, { Location: approvalLink.href });
            res.end();
        } else {
            return res.status(500).json({ error: 'PayPal did not return an approval link.' });
        }

    } catch (error) {
        console.error('Order Creation/Redirect Error:', error);
        return res.status(500).json({ error: 'PayPal API Error', details: error.message });
    }
}
