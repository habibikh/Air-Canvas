import React from 'react';
import { Camera, ShieldCheck, ShieldAlert, AlertCircle, RefreshCw, MousePointer, Sparkles, Hand, Play, Globe } from 'lucide-react';
import { CameraStatus } from '../types';

interface CameraPermissionPromptProps {
  cameraStatus: CameraStatus;
  errorMessage: string | null;
  onStartCamera: () => void;
  onStartDemo?: () => void;
  onDismiss: () => void;
}

export const CameraPermissionPrompt: React.FC<CameraPermissionPromptProps> = ({
  cameraStatus,
  errorMessage,
  onStartCamera,
  onStartDemo,
  onDismiss,
}) => {
  const isDenied = cameraStatus === 'denied';
  const isError = cameraStatus === 'error' || cameraStatus === 'unsupported';
  const isRequesting = cameraStatus === 'requesting';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-6 sm:p-7 text-center">
        {/* Visual Icon */}
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div
            className={`w-16 h-16 rounded-3xl flex items-center justify-center text-white shadow-lg ${
              isDenied
                ? 'bg-gradient-to-tr from-amber-600 to-amber-400 shadow-amber-500/25'
                : isError
                ? 'bg-gradient-to-tr from-rose-600 to-rose-400 shadow-rose-500/25'
                : 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 shadow-indigo-500/25'
            }`}
          >
            {isDenied ? (
              <ShieldAlert className="w-8 h-8 text-white" />
            ) : isError ? (
              <AlertCircle className="w-8 h-8 text-white" />
            ) : (
              <Hand className="w-8 h-8 text-white" />
            )}
          </div>
          {isRequesting && (
            <div className="absolute inset-0 rounded-3xl border-2 border-indigo-400 border-t-transparent animate-spin" />
          )}
        </div>

        {/* Title & Description */}
        {isDenied ? (
          <>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 mb-2">
              <Globe className="w-3.5 h-3.5 text-amber-600" />
              Browser Permission Blocked
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Camera Access Blocked</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              AirCanvas uses client-side MediaPipe to detect hand gestures. The browser blocked camera access, or permissions were dismissed.
            </p>

            <div className="mt-4 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-left text-xs text-amber-900">
              <p className="font-semibold text-amber-950 mb-1.5 flex items-center gap-1.5">
                <span>How to allow camera access:</span>
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-amber-800">
                <li>Click the <strong>lock 🔒 or camera icon</strong> in your browser address bar.</li>
                <li>Set <strong>Camera</strong> permission to <strong>Allow</strong>.</li>
                <li>Click <strong>Retry Camera</strong> below, or draw directly with mouse/touch!</li>
              </ol>
            </div>
          </>
        ) : isError ? (
          <>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              Hardware Unavailable
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Camera Not Available</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {errorMessage || 'No camera device was detected, or another application is currently using it.'}
            </p>
            <div className="mt-3.5 p-3 rounded-2xl bg-indigo-50/80 border border-indigo-100 text-xs text-indigo-800 text-left">
              <p className="font-semibold mb-0.5">Want to test gestures right now?</p>
              <p className="text-[11px] text-indigo-700">
                You can try the <strong>Interactive Air Hand Demo</strong> to experience real-time gesture writing and palm erasing immediately!
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Touchless Spatial Whiteboard
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome to AirCanvas</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Draw and write in thin air using your webcam. Index finger writes, open palm erases, fist pauses.
            </p>

            {/* Privacy Guarantee Box */}
            <div className="mt-4 p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex items-start gap-2.5 text-left text-xs text-emerald-800">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-900">100% Private & Client-Side</p>
                <p className="text-[11px] text-emerald-700/90 mt-0.5">
                  Webcam frames are analyzed locally using MediaPipe on your machine. No video or data is ever recorded or uploaded.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          {/* If denied, make "Continue with Mouse & Touch Mode" the prominent primary action so user is never blocked */}
          {isDenied ? (
            <>
              <button
                onClick={onDismiss}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <MousePointer className="w-4 h-4" />
                <span>Draw with Mouse & Touch Mode</span>
              </button>

              <button
                onClick={onStartCamera}
                disabled={isRequesting}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-200"
              >
                {isRequesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting Camera...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Camera Access</span>
                  </>
                )}
              </button>

              {onStartDemo && (
                <button
                  onClick={onStartDemo}
                  className="w-full py-2.5 px-4 rounded-xl bg-cyan-50 hover:bg-cyan-100/80 border border-cyan-200 text-cyan-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 text-cyan-700" />
                  <span>Try Interactive Demo Simulation</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={onStartCamera}
                disabled={isRequesting}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isRequesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting Camera & Model...</span>
                  </>
                ) : isError ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Retry Camera Connection</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>Enable Camera & Start Air Drawing</span>
                  </>
                )}
              </button>

              {onStartDemo && (
                <button
                  onClick={onStartDemo}
                  className="w-full py-2.5 px-4 rounded-xl bg-cyan-50 hover:bg-cyan-100/80 border border-cyan-200 text-cyan-900 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 text-cyan-700" />
                  <span>Try Interactive Air Hand Demo</span>
                </button>
              )}

              <button
                onClick={onDismiss}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span>Continue with Mouse & Touch Mode</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
