// netlify/functions/verify-token.js
const crypto = require('crypto')

// Verify JWT token
function verifyToken(token, secret = process.env.JWT_SECRET || 'your-secret-key-change-this') {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.')
    
    if (!encodedHeader || !encodedPayload || !signature) {
      return { valid: false, error: 'Invalid token format' }
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(encodedHeader + '.' + encodedPayload)
      .digest('base64url')

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' }
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString())

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Token expired' }
    }

    return { 
      valid: true, 
      payload,
      username: payload.username 
    }

  } catch (error) {
    console.error('Token verification error:', error)
    return { valid: false, error: 'Token verification failed' }
  }
}

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { token } = JSON.parse(event.body)
    
    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          valid: false, 
          error: 'Token is required' 
        })
      }
    }

    const verification = verifyToken(token)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(verification)
    }

  } catch (error) {
    console.error('Token verification error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        valid: false,
        error: 'Server error'
      })
    }
  }
}