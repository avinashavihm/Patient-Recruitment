import React, { useState, useEffect } from 'react';
import { FileText, Users, MapPin, Building2, Play, AlertCircle } from 'lucide-react';
import FileUpload from './components/FileUpload';
import ProgressBar from './components/ProgressBar';
import ResultsDisplay from './components/ResultsDisplay';
import { runPipeline, checkHealth } from './services/api';

function App() {
  const [files, setFiles] = useState({
    protocolPdf: null,
    patientsXlsx: null,
    mappingXlsx: null,
    siteHistoryXlsx: null,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');

  useEffect(() => {
    // Check server health on mount and periodically
    const checkServer = async () => {
      try {
        await checkHealth();
        setServerStatus('online');
      } catch (error) {
        console.error('Server health check failed:', error);
        setServerStatus('offline');
      }
    };
    
    checkServer();
    // Check every 5 seconds
    const interval = setInterval(checkServer, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (fileType, file) => {
    setFiles((prev) => ({ ...prev, [fileType]: file }));
    setError(null);
  };

  const allFilesUploaded = () => {
    return files.protocolPdf && files.patientsXlsx && files.mappingXlsx && files.siteHistoryXlsx;
  };

  const handleSubmit = async () => {
    if (!allFilesUploaded()) {
      setError('Please upload all required files');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatus('Preparing files...');
    setError(null);
    setResults(null);

    try {
      setStatus('Uploading files to server...');
      setProgress(10);

      const response = await runPipeline(files, (uploadProgress) => {
        // Update progress during upload (0-30%)
        setProgress(10 + Math.floor(uploadProgress * 0.2));
      });

      setProgress(30);
      setStatus('Processing eligibility criteria...');

      // Simulate processing progress (since we can't track actual processing)
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 90) return prev + 5;
          return prev;
        });
      }, 500);

      // Create a blob URL for the downloaded file
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const filename = response.headers['content-disposition']
        ? response.headers['content-disposition'].split('filename=')[1]?.replace(/"/g, '')
        : 'eligibility_results.xlsx';

      clearInterval(progressInterval);
      setProgress(90);
      setStatus('Generating results...');

      // Extract metadata from response
      const metadata = response.metadata || {};
      const counts = metadata.counts || {};

      setResults({
        downloadUrl: url,
        filename: filename,
        counts: {
          patients: counts.patients || 0,
          eligible_true: counts.eligible_true || 0,
          inconclusive: counts.inconclusive || 0,
        },
        errors: metadata.errors || [],
      });

      setProgress(100);
      setStatus('Complete!');
    } catch (err) {
      console.error('Error processing pipeline:', err);
      setError(
        err.response?.data?.detail ||
        err.message ||
        'An error occurred while processing your files. Please try again.'
      );
      setStatus('Error');
      setProgress(null);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setProgress(null);
        setStatus('');
      }, 2000);
    }
  };

  const handleReset = () => {
    setFiles({
      protocolPdf: null,
      patientsXlsx: null,
      mappingXlsx: null,
      siteHistoryXlsx: null,
    });
    setResults(null);
    setError(null);
    setProgress(null);
    setStatus('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Patient Recruitment Eligibility System
              </h1>
              <p className="text-gray-600 mt-1">
                Evaluate patient eligibility and rank clinical trial sites
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  serverStatus === 'online'
                    ? 'bg-green-500'
                    : serverStatus === 'offline'
                    ? 'bg-red-500'
                    : 'bg-yellow-500'
                }`}
              />
              <span className="text-sm text-gray-600">
                {serverStatus === 'online'
                  ? 'Server Online'
                  : serverStatus === 'offline'
                  ? 'Server Offline'
                  : 'Checking...'}
              </span>
              {serverStatus === 'offline' && (
                <button
                  onClick={() => {
                    setServerStatus('checking');
                    checkHealth()
                      .then(() => setServerStatus('online'))
                      .catch(() => setServerStatus('offline'));
                  }}
                  className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Instructions */}
        <div className="card mb-8 bg-blue-50 border-blue-200">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Instructions</h3>
              <p className="text-sm text-blue-800 mb-2">
                Upload the four required files, then click <strong>Run</strong> to generate the Excel output with 4 sheets:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Protocol PDF - Contains eligibility criteria</li>
                <li>Patients.xlsx - Patient data (no Site_ID column)</li>
                <li>Patient↔Site mapping.xlsx - Maps patients to sites</li>
                <li>Site history.xlsx - Site performance history</li>
              </ol>
              <p className="text-sm text-blue-800 mt-2">
                <strong>Output sheets:</strong> Site Ranking, Eligible Patients Roster, All Patients Roster, Extracted Criteria
              </p>
            </div>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="card mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Files</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FileUpload
              label="Protocol PDF"
              accept=".pdf,application/pdf"
              file={files.protocolPdf}
              onChange={(file) => handleFileChange('protocolPdf', file)}
              required
              description="Clinical trial protocol document"
            />

            <FileUpload
              label="Patients.xlsx"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              file={files.patientsXlsx}
              onChange={(file) => handleFileChange('patientsXlsx', file)}
              required
              description="Patient data without Site_ID column"
            />

            <FileUpload
              label="Patient↔Site mapping.xlsx"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              file={files.mappingXlsx}
              onChange={(file) => handleFileChange('mappingXlsx', file)}
              required
              description="Maps patients to clinical trial sites"
            />

            <FileUpload
              label="Site history.xlsx"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              file={files.siteHistoryXlsx}
              onChange={(file) => handleFileChange('siteHistoryXlsx', file)}
              required
              description="Historical site performance data"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={handleReset}
              className="btn-secondary"
              disabled={isProcessing}
            >
              Reset
            </button>
            <button
              onClick={handleSubmit}
              disabled={!allFilesUploaded() || isProcessing || serverStatus !== 'online'}
              className="btn-primary flex items-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>Run Pipeline</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress Section */}
        {isProcessing && (
          <div className="card mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Processing</h2>
            <ProgressBar
              progress={progress}
              status={status}
              message="Please wait while we process your files..."
            />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="card mb-8 bg-red-50 border-red-200">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {results && !isProcessing && (
          <ResultsDisplay results={results} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-600">
            Patient Recruitment Eligibility System v3.0
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;

