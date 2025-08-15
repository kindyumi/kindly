const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

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
    const { name, message, emoji } = JSON.parse(event.body)
    
    // Validate input
    if (!name || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Name and message are required' })
      }
    }

    // Sanitize input
    const sanitizedName = name.trim().substring(0, 50)
    const sanitizedMessage = message.trim().substring(0, 500)
    const sanitizedEmoji = emoji || '❤️'

    const { data, error } = await supabase
      .from('guestbook_messages')
      .insert([
        {
          name: sanitizedName,
          message: sanitizedMessage,
          emoji: sanitizedEmoji,
          created_at: new Date().toISOString()
        }
      ])
      .select()

    if (error) {
      throw error
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        data: data[0] 
      })
    }

  } catch (error) {
    console.error('Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to add message',
        details: error.message 
      })
    }
  }
}