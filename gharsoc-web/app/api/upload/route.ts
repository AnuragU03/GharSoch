import { NextRequest, NextResponse } from 'next/server';
import { uploadToBlob } from '@/lib/azureBlob';

export async function POST(request: NextRequest) {
  try {
    // Graceful failure if environment variables are not set (as requested)
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
      return NextResponse.json(
        {
          success: false,
          message: 'Azure Storage is not configured. Upload simulated successfully for UI demonstration.',
          asset_ids: ['mock-asset-id'],
          files: [{ file_name: 'mock-file.pdf', success: true }],
        },
        { status: 200 } // Return 200 so the UI doesn't crash during demo mode
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files');

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No files provided' },
        { status: 400 }
      );
    }

    const uploadedFiles = [];
    const assetIds = [];

    for (const file of files) {
      if (file instanceof File) {
        const buffer = Buffer.from(await file.arrayBuffer());
        // Upload to Azure
        const url = await uploadToBlob(buffer, file.name, file.type);
        
        uploadedFiles.push({
          file_name: file.name,
          url: url,
          success: true
        });
        assetIds.push(url); // Using the URL as the asset ID for simplicity
      }
    }

    return NextResponse.json({
      success: true,
      asset_ids: assetIds,
      files: uploadedFiles,
      total_files: files.length,
      successful_uploads: uploadedFiles.length,
      failed_uploads: 0,
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error during upload',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
