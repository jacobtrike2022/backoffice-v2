import { useState } from 'react';
import { X, RefreshCw, CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { APP_CONFIG } from '../lib/config';

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

export function SupabaseDiagnostics({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b`;

  const runDiagnostics = async () => {
    setIsRunning(true);
    const newResults: DiagnosticResult[] = [];

    // Test 1: Check credentials exist
    newResults.push({
      test: 'Credentials Check',
      status: projectId && publicAnonKey ? 'success' : 'error',
      message: projectId && publicAnonKey 
        ? 'Project ID and Anon Key are present' 
        : 'Missing credentials',
      details: `Project ID: ${projectId || 'MISSING'}`
    });

    // Test 2: Check server health endpoint
    try {
      const healthResponse = await fetch(`${SERVER_URL}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (healthResponse.ok) {
        const data = await healthResponse.json();
        newResults.push({
          test: 'Server Health',
          status: 'success',
          message: 'Server is responding',
          details: JSON.stringify(data, null, 2)
        });
      } else {
        newResults.push({
          test: 'Server Health',
          status: 'error',
          message: `Server returned ${healthResponse.status}`,
          details: await healthResponse.text()
        });
      }
    } catch (error: any) {
      newResults.push({
        test: 'Server Health',
        status: 'error',
        message: 'Cannot reach server',
        details: error.message
      });
    }

    // Test 3: Test attachments endpoint
    try {
      const attachmentsResponse = await fetch(`${SERVER_URL}/attachments/test-track-id`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (attachmentsResponse.ok) {
        const data = await attachmentsResponse.json();
        newResults.push({
          test: 'Attachments Endpoint',
          status: 'success',
          message: 'Endpoint is accessible',
          details: `Found ${data.attachments?.length || 0} attachments`
        });
      } else {
        newResults.push({
          test: 'Attachments Endpoint',
          status: 'warning',
          message: `Endpoint returned ${attachmentsResponse.status}`,
          details: await attachmentsResponse.text()
        });
      }
    } catch (error: any) {
      newResults.push({
        test: 'Attachments Endpoint',
        status: 'error',
        message: 'Cannot reach endpoint',
        details: error.message
      });
    }

    // Test 4: Test facts endpoint
    try {
      const factsResponse = await fetch(`${SERVER_URL}/facts/track/test-track-id`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (factsResponse.ok) {
        const data = await factsResponse.json();
        newResults.push({
          test: 'Facts Endpoint',
          status: 'success',
          message: 'Endpoint is accessible',
          details: `Found ${data.facts?.length || 0} facts`
        });
      } else {
        newResults.push({
          test: 'Facts Endpoint',
          status: 'warning',
          message: `Endpoint returned ${factsResponse.status}`,
          details: await factsResponse.text()
        });
      }
    } catch (error: any) {
      newResults.push({
        test: 'Facts Endpoint',
        status: 'error',
        message: 'Cannot reach endpoint',
        details: error.message
      });
    }

    // Test 5: Test track versions endpoint
    try {
      const versionsResponse = await fetch(`${SERVER_URL}/track-versions/test-track-id`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (versionsResponse.ok) {
        const data = await versionsResponse.json();
        newResults.push({
          test: 'Track Versions Endpoint',
          status: 'success',
          message: 'Endpoint is accessible',
          details: `Found ${data.versions?.length || 0} versions. ${data.message || ''}`
        });
      } else {
        newResults.push({
          test: 'Track Versions Endpoint',
          status: 'warning',
          message: `Endpoint returned ${versionsResponse.status}`,
          details: await versionsResponse.text()
        });
      }
    } catch (error: any) {
      newResults.push({
        test: 'Track Versions Endpoint',
        status: 'error',
        message: 'Cannot reach endpoint',
        details: error.message
      });
    }

    // Test 6: Check if we can reach Supabase at all
    try {
      const pingResponse = await fetch(`https://${projectId}.supabase.co`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      newResults.push({
        test: 'Supabase Base URL',
        status: pingResponse.ok ? 'success' : 'warning',
        message: pingResponse.ok ? 'Supabase project is reachable' : `Got ${pingResponse.status}`,
        details: `URL: https://${projectId}.supabase.co`
      });
    } catch (error: any) {
      newResults.push({
        test: 'Supabase Base URL',
        status: 'error',
        message: 'Cannot reach Supabase project',
        details: error.message
      });
    }

    setResults(newResults);
    setIsRunning(false);
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl">Supabase Connection Diagnostics</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6">
            <button
              onClick={runDiagnostics}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Running Tests...' : 'Run Diagnostics'}
            </button>
          </div>

          {results.length > 0 && (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-2 ${
                    result.status === 'success'
                      ? 'border-green-200 bg-green-50'
                      : result.status === 'error'
                      ? 'border-red-200 bg-red-50'
                      : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium">{result.test}</h3>
                        <span
                          className={`text-sm px-2 py-0.5 rounded ${
                            result.status === 'success'
                              ? 'bg-green-100 text-green-700'
                              : result.status === 'error'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {result.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{result.message}</p>
                      {result.details && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                            Show details
                          </summary>
                          <pre className="mt-2 p-2 bg-white rounded border overflow-x-auto">
                            {result.details}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.length === 0 && !isRunning && (
            <div className="text-center text-gray-500 py-8">
              Click "Run Diagnostics" to test your Supabase connection
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50">
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-blue-900 mb-2">Multi-Tenancy Configuration</h3>
                <div className="text-sm text-blue-800 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Mode:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        APP_CONFIG.ENABLE_MULTI_TENANCY ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {APP_CONFIG.ENABLE_MULTI_TENANCY ? 'Multi-Tenant' : 'Single-Tenant'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Demo Mode:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        APP_CONFIG.DEMO_MODE ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {APP_CONFIG.DEMO_MODE ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Auth Required:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        APP_CONFIG.REQUIRE_AUTH ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {APP_CONFIG.REQUIRE_AUTH ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-blue-700">
                    Default Org ID: <code className="bg-blue-100 px-1 rounded">{APP_CONFIG.DEFAULT_ORG_ID}</code>
                  </div>
                  <div className="mt-2 text-xs text-blue-600">
                    📖 See <code>/MULTI_TENANCY_GUIDE.md</code> for migration instructions
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <h3 className="font-medium mb-2">Quick Fix Checklist:</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Verify Edge Function is deployed in Supabase Dashboard</li>
            <li>• Check that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets are set</li>
            <li>• Ensure RLS (Row Level Security) policies allow service role access</li>
            <li>• Confirm the function name matches: make-server-2858cc8b</li>
            <li>• Check Supabase Edge Function logs for errors</li>
          </ul>
        </div>
      </div>
    </div>
  );
}