export default function DateControls({
  sortOrder,
  setSortOrder,
  groupBy,
  setGroupBy,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onClearRange,
}) {
  const hasRange = Boolean(startDate || endDate)

  return (
    <div className="bg-white border border-slate-100 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <label className="text-slate-400 font-medium">Sort</label>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-600
                     hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-100
                     focus:border-sky-300 cursor-pointer"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-slate-400 font-medium">Group</label>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value)}
          className="px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-600
                     hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-100
                     focus:border-sky-300 cursor-pointer"
        >
          <option value="none">No grouping</option>
          <option value="day">By day</option>
          <option value="week">By week</option>
          <option value="month">By month</option>
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label className="text-slate-400 font-medium">From</label>
        <input
          type="date"
          value={startDate || ''}
          onChange={(e) => setStartDate(e.target.value || null)}
          className="px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-600
                     focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-300"
        />
        <label className="text-slate-400 font-medium ml-1">To</label>
        <input
          type="date"
          value={endDate || ''}
          onChange={(e) => setEndDate(e.target.value || null)}
          className="px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-600
                     focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-300"
        />
        {hasRange && (
          <button
            type="button"
            onClick={onClearRange}
            className="ml-1 text-slate-400 hover:text-slate-600 cursor-pointer"
            title="Clear date range"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
