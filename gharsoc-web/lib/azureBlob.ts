import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'gharsoch-assets';

let blobServiceClient: BlobServiceClient;
let containerClient: ContainerClient;

export function getBlobClient() {
  if (!AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is not defined');
  }
  
  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
  }
  
  return { blobServiceClient, containerClient };
}

export async function uploadToBlob(fileBuffer: Buffer, fileName: string, contentType: string) {
  const { containerClient } = getBlobClient();
  
  // Create container if it doesn't exist
  await containerClient.createIfNotExists({ access: 'blob' });
  
  const blockBlobClient = containerClient.getBlockBlobClient(fileName);
  
  await blockBlobClient.uploadData(fileBuffer, {
    blobHTTPHeaders: { blobContentType: contentType }
  });
  
  return blockBlobClient.url;
}

export async function deleteFromBlob(fileName: string) {
  const { containerClient } = getBlobClient();
  const blockBlobClient = containerClient.getBlockBlobClient(fileName);
  await blockBlobClient.deleteIfExists();
}
