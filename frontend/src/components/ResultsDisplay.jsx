import React from 'react';
import { Download, CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';

const ResultsDisplay = ({ results, onDownload }) => {
  if (!results) return null;

  const { counts, errors, downloadUrl, filename } = results;

  const handleDownload = () => {
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'eligibility_results.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (onDownload) {
      onDownload();
    }
  };

  return (
    <div className="card space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Results</h2>
        {downloadUrl && (
          <button
            onClick={handleDownload}
            className="btn-primary flex items-center space-x-2"
          >
            <Download className="w-5 h-5" />
            <span>Download Results</span>
          </button>
        )}
      </div>

      {counts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center space-x-2 mb-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Total Patients</h3>
            </div>
            <p className="text-3xl font-bold text-blue-700">{counts.patients || 0}</p>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-green-900">Eligible</h3>
            </div>
            <p className="text-3xl font-bold text-green-700">{counts.eligible_true || 0}</p>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <h3 className="font-semibold text-yellow-900">Inconclusive</h3>
            </div>
            <p className="text-3xl font-bold text-yellow-700">{counts.inconclusive || 0}</p>
          </div>
        </div>
      )}

      {errors && errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-900">Processing Errors</h3>
          </div>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Output Files</h3>
        <p className="text-sm text-gray-600">
          The results Excel file contains 4 sheets:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-700">
          <li>Site Ranking</li>
          <li>Eligible Patients Roster</li>
          <li>All Patients Roster</li>
          <li>Extracted Criteria</li>
        </ul>
      </div>
    </div>
  );
};

export default ResultsDisplay;

