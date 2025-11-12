import React, { useState } from 'react';
import { Download, CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import ExcelTableViewer from './ExcelTableViewer';

const ResultsDisplay = ({ results, onDownload }) => {
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  if (!results) return null;

  const { counts, errors, downloadUrl, filename, blob } = results;

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
      {/* Success Message - matching Streamlit's st.success */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-800 font-medium">Done! Download your results below.</p>
        </div>
      </div>

      {/* Download Button */}
      {downloadUrl && (
        <div className="flex justify-center">
          <button
            onClick={handleDownload}
            className="btn-primary flex items-center space-x-2"
          >
            <Download className="w-5 h-5" />
            <span>Download XLSX results</span>
          </button>
        </div>
      )}

      {/* Summary Section - matching Streamlit's st.subheader and st.metric */}
      {counts && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Summary</h2>
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
                <h3 className="font-semibold text-green-900">Eligible = True</h3>
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
        </div>
      )}

      {/* Excel Table Viewer */}
      {blob && (
        <div className="border-t border-gray-200 pt-6">
          <ExcelTableViewer blob={blob} filename={filename} />
        </div>
      )}

      {/* Errors Section - matching Streamlit's st.warning and st.expander */}
      {errors && errors.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <p className="text-yellow-800 font-medium">Some batches reported errors.</p>
          </div>
          
          {/* Expandable errors section - matching Streamlit's st.expander */}
          <button
            onClick={() => setErrorsExpanded(!errorsExpanded)}
            className="mt-2 flex items-center space-x-2 text-yellow-800 hover:text-yellow-900 font-medium text-sm"
          >
            <span>Show errors</span>
            {errorsExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          
          {errorsExpanded && (
            <div className="mt-3 space-y-2">
              {errors.map((error, index) => (
                <div
                  key={index}
                  className="bg-white rounded p-3 border border-yellow-300 font-mono text-xs text-gray-800 overflow-x-auto"
                >
                  {typeof error === 'string' ? error : JSON.stringify(error, null, 2)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResultsDisplay;

