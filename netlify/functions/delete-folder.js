// netlify/functions/delete-folder.js
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
    const { folderId } = JSON.parse(event.body);
    
    if (!folderId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Folder ID is required' })
      };
    }

    // Get all media in folder
    const { data: mediaList, error: fetchError } = await supabase
      .from('memory_media')
      .select('drive_file_id')
      .eq('folder_id', folderId);

    if (fetchError) {
      throw fetchError;
    }

    // Delete all files from Google Drive
    for (const media of mediaList) {
      if (media.drive_file_id) {
        try {
          await drive.files.delete({
            fileId: media.drive_file_id
          });
        } catch (driveError) {
          console.warn('Could not delete file from Google Drive:', driveError);
        }
      }
    }

    // Delete all media records
    const { error: deleteMediaError } = await supabase
      .from('memory_media')
      .delete()
      .eq('folder_id', folderId);

    if (deleteMediaError) {
      throw deleteMediaError;
    }

    // Delete folder
    const { error: deleteFolderError } = await supabase
      .from('memory_folders')
      .delete()
      .eq('id', folderId);

    if (deleteFolderError) {
      throw deleteFolderError;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Folder and all media deleted successfully'
      })
    };

  } catch (error) {
    console.error('Error deleting folder:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to delete folder: ' + error.message
      })
    };
  }
};

// Simple multipart parser function (used in upload functions)
function parseMultipart(body, boundary) {
  const parts = [];
  const sections = body.split(`--${boundary}`);
  
  for (let section of sections) {
    if (section.includes('Content-Disposition')) {
      const lines = section.split('\r\n');
      const disposition = lines.find(line => line.includes('Content-Disposition'));
      const contentType = lines.find(line => line.includes('Content-Type'));
      
      if (disposition) {
        const nameMatch = disposition.match(/name="([^"]+)"/);
        const name = nameMatch ? nameMatch[1] : '';
        
        const dataStartIndex = section.indexOf('\r\n\r\n') + 4;
        const data = section.slice(dataStartIndex).replace(/\r\n$/, '');
        
        parts.push({
          name,
          data,
          contentType: contentType ? contentType.split(': ')[1] : 'text/plain'
        });
      }
    }
  }
  
  return parts;
}