import React from 'react';
import { Camera, ShieldCheck, AlertCircle, RefreshCw, MousePointer, Sparkles, Hand } from 'lucide-react';
import { CameraStatus } from '../types';

interface CameraPermissionPromptProps {
  cameraStatus: CameraStatus;
  errorMessage: string | null;
  onStartCamera: () => void;
  onDismiss: () => void;
}

export const CameraPermissionPrompt: React.FC<CameraPermissionPromptProps> = ({
  cameraStatus,
  errorMessage,
  onStartCamera,
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
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            {isDenied || isError ? (
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
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Camera Permission Blocked</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              AirCanvas requires webcam access to track your index finger gestures in real time. Please click the camera/lock icon in your browser address bar to allow camera access.
            </p>
            <div className="mt-4 p-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-left text-xs text-amber-800">
              <p className="font-semibold mb-1">How to enable:</p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-700">
                <li>Click the lock or site settings icon next to the URL.</li>
                <li>Set <strong>Camera</strong> to <strong>Allow</strong>.</li>
                <li>Click the <em>Retry Camera</em> button below.</li>
              </ol>
            </div>
          </>
        ) : isError ? (
          <>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Camera Initialization Error</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {errorMessage || 'Unable to connect to camera device. Ensure no other application is using your webcam.'}
            </p>
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
          <button
            onClick={onStartCamera}
            disabled={isRequesting}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all"
          >
            {isRequesting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Initializing MediaPipe & Camera...</span>
              </>
            ) : isDenied || isError ? (
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

          <button
            onClick={onDismiss}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Continue with Mouse & Touch Mode</span>
          </button>
        </div>
      </div>
    </div>
  );
};
