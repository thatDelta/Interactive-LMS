import { useState, useEffect } from 'react'
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit2, Trash2, Plus } from 'lucide-react'

export default function DataTable({ endpoint, columns, title, hideActions, hideInsert, onRowSelect, token }) {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [newItem, setNewItem] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const limit = 5

  const fetchData = async () => {
    setLoading(true)
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {}
      const res = await fetch(`http://localhost:8000${endpoint}?skip=${skip}&limit=${limit}&q=${encodeURIComponent(search)}`, { headers })
      if (!res.ok) throw new Error()
      const result = await res.json()
      setData(result.data || result)
      setTotal(result.total || result.length || 0)
    } catch (e) { console.error("Fetch failed", e) }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [skip, search, endpoint])

  const handleDelete = async (id, e) => {
    if(e) e.stopPropagation()
    if(!confirm("Delete this record?")) return
    try {
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {}
      await fetch(`http://localhost:8000${endpoint}/${id}`, { 
        method: 'DELETE',
        headers
      })
      fetchData()
    } catch(err) { console.error(err) }
  }

  const handleSaveEdit = async () => {
    try {
      const headers = token ? { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
      } : { 'Content-Type': 'application/json' }
      await fetch(`http://localhost:8000${endpoint}/${editItem.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify(editItem)
      })
      setEditItem(null); fetchData()
    } catch(err) { console.error(err) }
  }

  const handleSaveNew = async () => {
    try {
      const headers = token ? { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
      } : { 'Content-Type': 'application/json' }
      await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST', headers,
        body: JSON.stringify(newItem)
      })
      setNewItem(null); fetchData()
    } catch(err) { console.error(err) }
  }

  return (
    <div className="space-y-4 animate-fade-in relative">
      <div className="flex justify-between items-center bg-[#111] p-4 rounded-lg border border-white/5">
        <h3 className="text-lg font-bold tracking-wide">{title} Records</h3>
        <div className="flex space-x-3 w-1/2">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 z-10" size={16} />
            <input type="text" placeholder="Search..." value={search}
              onChange={(e) => { setSearch(e.target.value); setSkip(0) }}
              className="glass-input !pl-9 h-full text-sm w-full" />
          </div>
          {!hideActions && !hideInsert && (
            <button onClick={() => setNewItem({})} className="flex items-center space-x-1.5 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all">
              <Plus size={16} /> <span>Insert</span>
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden border border-white/5 rounded-lg bg-[#0d0d0d]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 bg-[#080808]">
              {columns.map(c => <th key={c.key} className="p-3 text-[10px] tracking-wider uppercase text-gray-600 font-bold">{c.label}</th>)}
              {!hideActions && <th className="p-3 text-right pr-4 uppercase text-gray-600 text-[10px] font-bold">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length + 1} className="p-6 text-center text-gray-600 text-sm">Loading...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="p-6 text-center text-gray-600 text-sm">No records found.</td></tr>
            ) : (
              data.map((item, idx) => (
                <tr key={idx} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${onRowSelect ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowSelect && onRowSelect(item)}>
                  {columns.map(c => <td key={c.key} className="p-3 text-sm text-gray-300 truncate max-w-[200px]">{item[c.key] ?? '—'}</td>)}
                  {!hideActions && (
                    <td className="p-3 text-right pr-4 space-x-3">
                      <button onClick={(e) => { e.stopPropagation(); setEditItem({...item}) }} className="text-gray-600 hover:text-indigo-400 transition-colors"><Edit2 size={14} /></button>
                      <button onClick={(e) => handleDelete(item.id, e)} className="text-gray-600 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-600 font-mono">{Math.min(skip+1,total)}–{Math.min(skip+limit,total)} of {total}</span>
        <div className="flex space-x-1">
          {[
            { icon: ChevronsLeft, action: () => setSkip(0), disabled: skip === 0 },
            { icon: ChevronLeft, action: () => setSkip(s => Math.max(0, s-limit)), disabled: skip === 0 },
            { icon: ChevronRight, action: () => setSkip(s => s+limit), disabled: skip+limit >= total },
            { icon: ChevronsRight, action: () => setSkip(Math.max(0, Math.floor((total-1)/limit)*limit)), disabled: skip+limit >= total },
          ].map((btn, i) => (
            <button key={i} onClick={btn.action} disabled={btn.disabled}
              className="w-7 h-7 flex justify-center items-center rounded bg-[#111] border border-white/5 text-gray-500 disabled:opacity-20 hover:bg-white/5 transition-colors">
              <btn.icon size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100]" onClick={() => setEditItem(null)}>
          <div className="bg-[#111] p-6 w-full max-w-md rounded-xl border border-white/10" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 text-white">Edit Record</h3>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {columns.map(c => (
                <div key={c.key}>
                  <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1">{c.label}</label>
                  <input className="glass-input w-full text-sm" value={editItem[c.key] || ''}
                    onChange={e => setEditItem({...editItem, [c.key]: e.target.value})} />
                </div>
              ))}
            </div>
            <div className="flex justify-end space-x-3 mt-5">
              <button onClick={() => setEditItem(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 text-sm rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Insert Modal */}
      {newItem && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100]" onClick={() => setNewItem(null)}>
          <div className="bg-[#111] p-6 w-full max-w-md rounded-xl border border-white/10" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 text-white">Insert Record</h3>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {columns.map(c => (
                <div key={c.key}>
                  <label className="block text-[10px] uppercase tracking-wider text-gray-600 mb-1">{c.label}</label>
                  <input className="glass-input w-full text-sm" value={newItem[c.key] || ''}
                    onChange={e => setNewItem({...newItem, [c.key]: e.target.value})} />
                </div>
              ))}
            </div>
            <div className="flex justify-end space-x-3 mt-5">
              <button onClick={() => setNewItem(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSaveNew} className="px-4 py-2 text-sm rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
