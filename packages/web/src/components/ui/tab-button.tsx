export function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
        ${
          active
            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200'
            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}
