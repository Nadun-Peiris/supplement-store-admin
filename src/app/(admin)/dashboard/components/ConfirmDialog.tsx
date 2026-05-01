"use client";

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmText: string;
  isDanger?: boolean;
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  title,
  message,
  confirmText,
  isDanger = false,
  isLoading = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111]/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-white bg-white/80 p-6 backdrop-blur-xl shadow-[0_20px_50px_rgba(3,199,254,0.08)]">
        <h3 className="text-lg font-black text-[#111]">{title}</h3>
        <p className="mt-2 text-xs font-bold leading-6 text-[#888]">{message}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-2xl border border-[#cfeef7] bg-white px-5 py-3 text-xs font-black text-[#555] transition hover:border-[#03c7fe] hover:text-[#03c7fe] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-2xl px-5 py-3 text-xs font-black text-white transition hover:scale-[1.02] disabled:opacity-50 ${
              isDanger
                ? "bg-red-500 shadow-[0_10px_25px_rgba(239,68,68,0.3)]"
                : "bg-[#03c7fe] shadow-[0_10px_25px_rgba(3,199,254,0.3)]"
            }`}
          >
            {isLoading ? "Processing..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
