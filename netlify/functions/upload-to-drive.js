// netlify/functions/upload-to-drive.js
const { google } = require('googleapis');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Google Drive setup
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

    if (!file) {
      throw new Error('No file provided');
    }

    // Upload to Google Drive
    const fileMetadata = {
      name: `memories_${Date.now()}_${filename}`,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID], // Your Google Drive folder ID
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        fileUrl: fileUrl,
        fileId: driveResponse.data.id
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

// Simple multipart parser
function parseMultipart(body, boundary) {
  const parts = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const bodyBuffer = Buffer.from(body, 'base64');
  
  const sections = bodyBuffer.toString().split(`--${boundary}`);
  
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