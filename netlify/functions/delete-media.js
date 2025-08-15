// netlify/functions/delete-media.js
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const drive = google.drive({
  version: 'v3',
  auth: new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  }),
});

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { mediaId } = JSON.parse(event.body);
    
    if (!mediaId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Media ID is required' })
      };
    }

    // Get media info first
    const { data: mediaData, error: fetchError } = await supabase
      .from('memory_media')
      .select('drive_file_id')
      .eq('id', mediaId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Delete from Google Drive
    if (mediaData.drive_file_id) {
      try {
        await drive.files.delete({
          fileId: mediaData.drive_file_id
        });
      } catch (driveError) {
        console.warn('Could not delete from Google Drive:', driveError);
        // Continue with database deletion even if Drive deletion fails
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('memory_media')
      .delete()
      .eq('id', mediaId);

    if (deleteError) {
      throw deleteError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Media deleted successfully'
      })
    };

  } catch (error) {
    console.error('Error deleting media:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to delete media: ' + error.message
      })
    };
  }
};