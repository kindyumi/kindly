// netlify/functions/create-folder.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { name } = JSON.parse(event.body);
    
    if (!name || !name.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Folder name is required' })
      };
    }

    const { data, error } = await supabase
      .from('memory_folders')
      .insert([{
        name: name.trim(),
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: data[0]
      })
    };

  } catch (error) {
    console.error('Error creating folder:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to create folder: ' + error.message
      })
    };
  }
};

// netlify/functions/get-folders.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get folders with media count
    const { data, error } = await supabase
      .from('memory_folders')
      .select(`
        *,
        folder_media:memory_media(count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Format data to include media count
    const formattedData = data.map(folder => ({
      ...folder,
      media_count: folder.folder_media[0]?.count || 0
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: formattedData
      })
    };

  } catch (error) {
    console.error('Error fetching folders:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch folders: ' + error.message
      })
    };
  }
};

// netlify/functions/upload-media-to-folder.js
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse multipart form data
    const boundary = event.headers['content-type'].split('boundary=')[1];
    const parts = parseMultipart(event.body, boundary);
    
    const file = parts.find(part => part.name === 'file');
    const filename = parts.find(part => part.name === 'filename')?.data || 'unnamed';
    const folderId = parts.find(part => part.name === 'folderId')?.data;
    const caption = parts.find(part => part.name === 'caption')?.data || '';
    const username = parts.find(part => part.name === 'username')?.data;

    if (!file || !folderId) {
      throw new Error('File and folder ID are required');
    }

    // Upload to Google Drive
    const fileMetadata = {
      name: `folder_${folderId}_${Date.now()}_${filename}`,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    };

    const media = {
      mimeType: file.contentType,
      body: Buffer.from(file.data, 'base64'),
    };

    const driveResponse = await drive.files.create({
      resource: fileMetadata,
      media: media,
    });

    // Make file publicly accessible
    await drive.permissions.create({
      fileId: driveResponse.data.id,
      resource: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const fileUrl = `https://drive.google.com/uc?id=${driveResponse.data.id}`;

    // Save to database
    const { data, error } = await supabase
      .from('memory_media')
      .insert([{
        folder_id: parseInt(folderId),
        media_url: fileUrl,
        media_type: file.contentType,
        caption: caption,
        username: username,
        drive_file_id: driveResponse.data.id,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: data[0]
      })
    };

  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Upload failed: ' + error.message
      })
    };
  }
};

// netlify/functions/get-folder-media.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const folderId = event.queryStringParameters?.folderId;
    
    if (!folderId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Folder ID is required' })
      };
    }

    const { data, error } = await supabase
      .from('memory_media')
      .select('*')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: data || []
      })
    };

  } catch (error) {
    console.error('Error fetching folder media:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch media: ' + error.message
      })
    };
  }
};

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