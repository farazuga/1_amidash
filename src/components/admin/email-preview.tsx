'use client';

interface EmailPreviewProps {
  styleOverrides: {
    primaryColor: string;
    logoUrl: string;
    footerText: string;
    buttonColor: string;
    buttonTextColor: string;
  };
}

export function EmailPreview({ styleOverrides }: EmailPreviewProps) {
  const { primaryColor, logoUrl, footerText, buttonColor, buttonTextColor } = styleOverrides;

  return (
    <div className="border rounded-lg overflow-hidden bg-gray-100 text-sm">
      {/* Header with logo */}
      <div
        className="flex items-center justify-center py-4 px-6"
        style={{ backgroundColor: primaryColor }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo preview"
            className="h-8 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="text-white font-semibold text-base">Your Logo</span>
        )}
      </div>

      {/* Body */}
      <div className="bg-white mx-4 my-3 rounded p-4 space-y-3">
        <p className="text-gray-800 font-medium">Hi Sample Client,</p>
        <p className="text-gray-600">Your project status has been updated.</p>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="bg-gray-100 rounded px-2 py-0.5">Engineering</span>
          <span>&rarr;</span>
          <span className="bg-gray-100 rounded px-2 py-0.5 font-semibold text-gray-700">
            Production
          </span>
        </div>

        <div className="pt-1">
          <button
            type="button"
            className="rounded px-4 py-2 text-xs font-medium"
            style={{ backgroundColor: buttonColor, color: buttonTextColor }}
          >
            View Project Status
          </button>
        </div>
      </div>

      {/* Footer */}
      {footerText && (
        <div className="text-center text-[11px] text-gray-400 px-4 pb-3 pt-1 whitespace-pre-line">
          {footerText}
        </div>
      )}
    </div>
  );
}
