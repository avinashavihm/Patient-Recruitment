import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes for large file processing
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

export const runPipeline = async (files, onProgress) => {
  const formData = new FormData();
  
  formData.append('protocol_pdf', files.protocolPdf);
  formData.append('patients_xlsx', files.patientsXlsx);
  formData.append('mapping_xlsx', files.mappingXlsx);
  formData.append('site_history_xlsx', files.siteHistoryXlsx);

  const response = await api.post('/run', formData, {
    responseType: 'blob', // Important for downloading files
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });

  // Extract metadata from response headers (case-insensitive)
  const metadataHeader = response.headers['x-metadata'] || 
                         response.headers['X-Metadata'] ||
                         response.headers['X-METADATA'];
  let metadata = null;
  if (metadataHeader) {
    try {
      metadata = JSON.parse(metadataHeader);
    } catch (e) {
      console.warn('Failed to parse metadata from headers:', e);
    }
  }

  return {
    data: response.data,
    headers: response.headers,
    metadata: metadata,
  };
};

export const checkHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export default api;

