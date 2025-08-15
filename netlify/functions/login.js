// netlify/functions/login.js
const crypto = require('crypto')

// Hash function untuk password (gunakan yang sama untuk setup)
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
}

// Generate JWT token sederhana
function generateToken(username) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = { 
    username, 
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 jam
  }
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  
  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'your-secret-key-change-this')
    .update(encodedHeader + '.' + encodedPayload)
    .digest('base64url')
  
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

// Predefined users
const USERS = {
  'Unkindleddd20032004': {
    passwordHash: 'ec52e2f1451a0c36ba53950521b200e0c96e22fff9980e7607d18923b17bf9a146ffe16d90fc85a7afb5b0a5b88b0748d13250eea0897993dbca202d6b776c93',
    salt: '3f1f037f3598baa0ed4b2dc89c4be0c33b56cd0f2e1045046afcc6090c355ec1'
  },
  'Schatz': {
    passwordHash: '46e8d405b4c33389cf3984e8e1d23a1da11c76dd39f0438068d83b138f001239e69b4031ff0c56809b1b93cbac38c489ed47fa7985df8402a47e0edfa035d7f2',
    salt: '7c5c7b841d44a078ce1207b7078b409bb753bdf186db53dfb33b8562f4b2e5d3'
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
    const { username, password } = JSON.parse(event.body)
    
    // Validate input
    if (!username || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Username and password are required' 
        })
      }
    }

    // Rate limiting sederhana
    const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown'
    // Check if user exists
    const user = USERS[username]
    if (!user) {
      // Delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Invalid credentials' 
        })
      }
    }

    // Verify password
    const inputHash = hashPassword(password, user.salt)
    if (inputHash !== user.passwordHash) {
      // Delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Invalid credentials' 
        })
      }
    }

    // Generate token
    const token = generateToken(username)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        token,
        message: 'Login successful'
      })
    }

  } catch (error) {
    console.error('Login error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Server error'
      })
    }
  }
}