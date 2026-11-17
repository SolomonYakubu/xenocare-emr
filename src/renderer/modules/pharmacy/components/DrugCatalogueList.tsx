import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Eye,
  Package,
  AlertTriangle,
  RefreshCw,
  Pill,
  DollarSign,
  Layers,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  X,
  Filter,
  ArrowUpDown,
  Shield,
  TrendingDown,
  Hash,
  RotateCcw,
  BoxSelect,
} from 'lucide-react';
import { Button, Card } from '../../../components/ui';
import { useTimeTheme } from '../../../hooks/useTimeTheme';
import { isNhisFeatureEnabled } from '../../../config/features';
import { useDrugs } from '../hooks/usePharmacy';
import {
  DrugDTO,
  DRUG_CATEGORIES,
  NHIS_DRUG_CATEGORIES,
  DrugCategory,
  getStockLevelColor,
} from '../dtos/pharmacy.dto';

const formatCurrency = (amount: number) => `NGN ${amount.toLocaleString()}`;

// =============================================================================
// Types
// =============================================================================

interface DrugCatalogueListProps {
  onAddDrug: () => void;
  onEditDrug: (drug: DrugDTO) => void;
  onViewDrug: (drug: DrugDTO) => void;
  onManageBatches: (drug: DrugDTO) => void;
}

type StockFilter = 'all' | 'in_stock' | 'low' | 'out';
type ViewMode = 'list' | 'grouped';
type SortField = 'name' | 'stock' | 'price' | 'category';
type SortDir = 'asc' | 'desc';

// =============================================================================
// Helper Functions
// =============================================================================

const getStockInfo = (qty: number, reorder: number) => {
  if (qty === 0)
    return {
      label: 'Out of Stock',
      color: 'text-red-600',
      bg: 'bg-red-50',
      barColor: 'bg-red-500',
      ring: 'ring-red-200',
    };
  if (qty <= reorder)
    return {
      label: 'Low Stock',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      barColor: 'bg-amber-500',
      ring: 'ring-amber-200',
    };
  return {
    label: 'In Stock',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    barColor: 'bg-emerald-500',
    ring: 'ring-emerald-200',
  };
};

// =============================================================================
// DrugRow Component
// =============================================================================

function DrugRow({
  drug,
  isNightMode,
  onView,
  onEdit,
  onManageBatches,
}: {
  drug: DrugDTO;
  isNightMode: boolean;
  onView: () => void;
  onEdit: () => void;
  onManageBatches: () => void;
}) {
  const qty = drug.quantity_in_stock || 0;
  const reorder = drug.reorder_level || 10;
  const stock = getStockInfo(qty, reorder);
  const barPct =
    reorder > 0
      ? Math.min(Math.round((qty / (reorder * 3)) * 100), 100)
      : qty > 0
        ? 80
        : 0;

  return (
    <div
      onClick={onView}
      className={`group flex items-center gap-4 px-4 py-3 border-b last:border-b-0 cursor-pointer transition-all duration-150
        ${
          isNightMode
            ? 'border-slate-700 hover:bg-slate-700/50'
            : 'border-gray-100 hover:bg-indigo-50/40'
        }`}
    >
      {/* Drug icon + name */}
      <div className="flex items-center gap-3 w-64 min-w-0 flex-shrink-0">
        <div className="flex-shrink-0 rounded-lg bg-slate-100 p-2">
          <Pill size={16} className="text-slate-500" />
        </div>
        <div className="min-w-0">
          <div
            className={`text-sm font-semibold truncate ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
          >
            {drug.drug_name}
          </div>
          {drug.generic_name && (
            <div className="truncate text-xs text-gray-400">
              {drug.generic_name}
            </div>
          )}
        </div>
      </div>

      {/* Category / type */}
      <div className="w-40 flex-shrink-0 min-w-0">
        <div
          className={`text-xs font-medium ${isNightMode ? 'text-slate-300' : 'text-gray-700'}`}
        >
          {drug.category || 'N/A'}
        </div>
        <div className="text-xs text-gray-400">
          {drug.drug_type || drug.formulation || '-'}
        </div>
      </div>

      {/* Strength */}
      <div className="w-20 flex-shrink-0">
        <span
          className={`text-xs font-medium ${isNightMode ? 'text-slate-300' : 'text-gray-600'}`}
        >
          {drug.strength || '-'}
        </span>
      </div>

      {/* Stock visual */}
      <div className="w-32 flex-shrink-0">
        <div className="flex items-baseline justify-between mb-1">
          <span
            className={`text-sm font-bold ${getStockLevelColor(qty, reorder)}`}
          >
            {qty}
          </span>
          <span className="text-[10px] text-gray-400">/ {reorder} min</span>
        </div>
        <div
          className={`h-1.5 rounded-full overflow-hidden ${isNightMode ? 'bg-slate-600' : 'bg-gray-200'}`}
        >
          <div
            className={`h-full rounded-full transition-all ${stock.barColor}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
        <span
          className={`inline-flex items-center text-[10px] font-medium mt-0.5 px-1.5 py-0.5 rounded-full ${stock.bg} ${stock.color}`}
        >
          {stock.label}
        </span>
      </div>

      {/* Price */}
      <div className="w-24 flex-shrink-0 text-right">
        <div
          className={`text-sm font-semibold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
        >
          {formatCurrency(drug.price || 0)}
        </div>
      </div>

      {/* Status badge */}
      <div className="w-16 flex-shrink-0 text-center">
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
            drug.is_active
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {drug.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          className={`p-1.5 rounded-lg transition-colors ${isNightMode ? 'hover:bg-slate-600 text-slate-400 hover:text-blue-400' : 'hover:bg-blue-50 text-gray-400 hover:text-blue-600'}`}
          title="View Details"
        >
          <Eye size={15} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className={`p-1.5 rounded-lg transition-colors ${isNightMode ? 'hover:bg-slate-600 text-slate-400 hover:text-emerald-400' : 'hover:bg-emerald-50 text-gray-400 hover:text-emerald-600'}`}
          title="Edit Drug"
        >
          <Edit2 size={15} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onManageBatches();
          }}
          className={`p-1.5 rounded-lg transition-colors ${isNightMode ? 'hover:bg-slate-600 text-slate-400 hover:text-violet-400' : 'hover:bg-violet-50 text-gray-400 hover:text-violet-600'}`}
          title="Manage Batches"
        >
          <Layers size={15} />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function DrugCatalogueList({
  onAddDrug,
  onEditDrug,
  onViewDrug,
  onManageBatches,
}: DrugCatalogueListProps) {
  const { isNightMode } = useTimeTheme();

  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DrugCategory | ''>('');
  const [nhisFilter, setNhisFilter] = useState<boolean>(false);
  const [nhisCategoryFilter, setNhisCategoryFilter] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showFilters, setShowFilters] = useState(false);

  const limit = viewMode === 'grouped' ? 1000 : 20;

  // Query
  const {
    data: drugsData,
    isLoading,
    refetch,
  } = useDrugs({
    page,
    limit,
    search: search || undefined,
    category: categoryFilter || undefined,
    low_stock: stockFilter === 'low' ? true : undefined,
  });

  const drugs = drugsData?.data || [];
  const totalPages = drugsData?.totalPages || 1;

  // Filter + sort
  const filteredDrugs = useMemo(() => {
    let result = drugs;

    if (nhisFilter) result = result.filter((d) => d.is_nhis_covered);
    if (nhisCategoryFilter)
      result = result.filter((d) => d.nhis_category === nhisCategoryFilter);
    if (stockFilter === 'out')
      result = result.filter((d) => (d.quantity_in_stock || 0) === 0);
    if (stockFilter === 'in_stock')
      result = result.filter(
        (d) => (d.quantity_in_stock || 0) > (d.reorder_level || 10),
      );

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = (a.drug_name || '').localeCompare(b.drug_name || '');
          break;
        case 'stock':
          cmp = (a.quantity_in_stock || 0) - (b.quantity_in_stock || 0);
          break;
        case 'price':
          cmp = (a.nhis_price || a.price || 0) - (b.nhis_price || b.price || 0);
          break;
        case 'category':
          cmp = (a.nhis_category || a.category || '').localeCompare(
            b.nhis_category || b.category || '',
          );
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [drugs, nhisFilter, nhisCategoryFilter, stockFilter, sortField, sortDir]);

  // Grouped view
  const groupedDrugs = useMemo(() => {
    if (viewMode !== 'grouped') return {};
    const groups: Record<string, DrugDTO[]> = {};
    filteredDrugs.forEach((drug) => {
      const cat = drug.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(drug);
    });
    return Object.keys(groups)
      .sort()
      .reduce(
        (acc, k) => {
          acc[k] = groups[k];
          return acc;
        },
        {} as Record<string, DrugDTO[]>,
      );
  }, [filteredDrugs, viewMode]);

  const availableNhisCategories = useMemo(() => {
    const cats = new Set<string>();
    drugs.forEach((d) => {
      if (d.nhis_category) cats.add(d.nhis_category);
    });
    return Array.from(cats).sort();
  }, [drugs]);

  const toggleCategory = (cat: string) => {
    const next = new Set(expandedCategories);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    setExpandedCategories(next);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Stats — use server total (not paginated array length)
  const stats = useMemo(() => {
    const total = drugsData?.total || drugs.length;
    const nhis = drugs.filter((d) => d.is_nhis_covered).length;
    const low = drugs.filter(
      (d) =>
        (d.quantity_in_stock || 0) <= (d.reorder_level || 10) &&
        (d.quantity_in_stock || 0) > 0,
    ).length;
    const out = drugs.filter((d) => (d.quantity_in_stock || 0) === 0).length;
    return { total, nhis, low, out };
  }, [drugs, drugsData?.total]);

  const activeFilterCount = [
    nhisFilter,
    !!nhisCategoryFilter,
    !!categoryFilter,
    stockFilter !== 'all',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setNhisFilter(false);
    setNhisCategoryFilter('');
    setCategoryFilter('');
    setStockFilter('all');
    setSearch('');
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className={`text-xl font-bold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
          >
            Drug Catalogue
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage drugs, pricing, and inventory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RotateCcw size={14} className="mr-1" /> Refresh
          </Button>
          <Button onClick={onAddDrug}>
            <Plus size={16} className="mr-1" /> Add Drug
          </Button>
        </div>
      </div>

      {/* ── Summary stat cards ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Total Drugs',
            value: stats.total,
            icon: Pill,
            accent: 'indigo',
            filter: () => {},
          },
          {
            label: 'Low Stock',
            value: stats.low,
            icon: AlertTriangle,
            accent: 'amber',
            filter: () => {
              setStockFilter('low');
              setPage(1);
            },
          },
          {
            label: 'Out of Stock',
            value: stats.out,
            icon: TrendingDown,
            accent: 'red',
            filter: () => {
              setStockFilter('out');
              setPage(1);
            },
          },
        ].map((s) => (
          <button
            key={s.label}
            onClick={s.filter}
            className={`rounded-xl p-4 flex items-center gap-3 text-left transition-all ${
              isNightMode
                ? 'bg-slate-800 border border-slate-700 hover:border-slate-600'
                : 'bg-white border border-gray-100 shadow-sm hover:shadow-md'
            }`}
          >
            <div className={`p-2.5 rounded-lg bg-${s.accent}-100`}>
              <s.icon size={18} className={`text-${s.accent}-600`} />
            </div>
            <div>
              <div
                className={`text-lg font-bold ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
              >
                {s.value}
              </div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Search + quick filters ─────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="flex-1 relative min-w-[220px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search by drug name, code, or generic name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={`w-full pl-9 pr-8 py-2.5 text-sm rounded-xl border transition-colors outline-none focus:ring-2
              ${
                isNightMode
                  ? 'bg-slate-800 border-slate-700 text-slate-100 focus:ring-indigo-500/30 placeholder-slate-500'
                  : 'bg-white border-gray-200 text-gray-900 focus:ring-indigo-500/20 focus:border-indigo-300 placeholder-gray-400'
              }`}
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Stock quick-filter pills */}
        <div className="flex items-center gap-1">
          {[
            { key: 'all' as StockFilter, label: 'All' },
            { key: 'in_stock' as StockFilter, label: 'In Stock' },
            { key: 'low' as StockFilter, label: 'Low Stock' },
            { key: 'out' as StockFilter, label: 'Out' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setStockFilter(f.key);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                stockFilter === f.key
                  ? f.key === 'out'
                    ? 'bg-red-600 text-white'
                    : f.key === 'low'
                      ? 'bg-amber-500 text-white'
                      : isNightMode
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-600 text-white'
                  : isNightMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isNhisFeatureEnabled() && (
          <button
            onClick={() => {
              setNhisFilter(!nhisFilter);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              nhisFilter
                ? 'bg-emerald-600 text-white'
                : isNightMode
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Shield size={12} className="inline mr-1" />
            NHIS Only
          </button>
        )}

        {/* View mode toggle */}
        <div
          className={`flex items-center gap-0.5 p-0.5 rounded-lg ${isNightMode ? 'bg-slate-800' : 'bg-gray-100'}`}
        >
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'list'
                ? isNightMode
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-400'
            }`}
            title="List View"
          >
            <Layers size={14} />
          </button>
          <button
            onClick={() => setViewMode('grouped')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'grouped'
                ? isNightMode
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-400'
            }`}
            title="Grouped by Category"
          >
            <FolderOpen size={14} />
          </button>
        </div>

        {/* More filters toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
            showFilters || activeFilterCount > 0
              ? isNightMode
                ? 'bg-indigo-900/50 text-indigo-300 border-indigo-700'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              : isNightMode
                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Filter size={12} />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            <X size={12} /> Clear all
          </button>
        )}
      </div>

      {/* ── Expanded filters panel ─────────────────────────── */}
      {showFilters && (
        <div
          className={`flex flex-wrap items-center gap-3 p-4 rounded-xl border ${
            isNightMode
              ? 'bg-slate-800 border-slate-700'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          {/* Drug category */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Drug Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value as DrugCategory | '');
                setPage(1);
              }}
              className={`text-sm rounded-lg border px-3 py-1.5 outline-none ${
                isNightMode
                  ? 'bg-slate-700 border-slate-600 text-slate-200'
                  : 'bg-white border-gray-200 text-gray-700'
              }`}
            >
              <option value="">All Categories</option>
              {DRUG_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* NHIS category */}
          {availableNhisCategories.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                NHIS Category
              </label>
              <select
                value={nhisCategoryFilter}
                onChange={(e) => {
                  setNhisCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className={`text-sm rounded-lg border px-3 py-1.5 outline-none max-w-[280px] ${
                  isNightMode
                    ? 'bg-slate-700 border-slate-600 text-slate-200'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <option value="">All NHIS Categories</option>
                {availableNhisCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Sort by</label>
            <div className="flex items-center gap-1">
              {[
                { field: 'name' as SortField, label: 'Name' },
                { field: 'stock' as SortField, label: 'Stock' },
                { field: 'price' as SortField, label: 'Price' },
                { field: 'category' as SortField, label: 'Category' },
              ].map((s) => (
                <button
                  key={s.field}
                  onClick={() => toggleSort(s.field)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    sortField === s.field
                      ? isNightMode
                        ? 'bg-indigo-900/50 text-indigo-300'
                        : 'bg-indigo-50 text-indigo-700'
                      : isNightMode
                        ? 'text-slate-400 hover:bg-slate-700'
                        : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {s.label}
                  {sortField === s.field && (
                    <ArrowUpDown
                      size={11}
                      className={sortDir === 'desc' ? 'rotate-180' : ''}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Drug list / grouped view ───────────────────────── */}
      {viewMode === 'grouped' ? (
        <div className="space-y-3">
          {Object.keys(groupedDrugs).length === 0 ? (
            <Card className="py-16">
              <div className="flex flex-col items-center gap-4">
                <div
                  className={`p-4 rounded-2xl ${isNightMode ? 'bg-slate-700' : 'bg-gray-100'}`}
                >
                  <BoxSelect size={36} className="text-gray-400" />
                </div>
                <div className="text-center">
                  <h3
                    className={`text-base font-semibold ${isNightMode ? 'text-slate-200' : 'text-gray-700'}`}
                  >
                    No drugs found
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Try adjusting your filters
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            Object.entries(groupedDrugs).map(([category, categoryDrugs]) => (
              <Card key={category} className="overflow-hidden">
                <button
                  className={`w-full flex items-center justify-between p-4 transition-colors ${
                    isNightMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => toggleCategory(category)}
                >
                  <div className="flex items-center gap-3">
                    {expandedCategories.has(category) ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FolderOpen className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h3
                        className={`font-semibold text-sm ${isNightMode ? 'text-slate-100' : 'text-gray-900'}`}
                      >
                        {category}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {categoryDrugs.length} drug
                        {categoryDrugs.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                    NHIS
                  </span>
                </button>
                {expandedCategories.has(category) && (
                  <div className="border-t border-gray-100">
                    {categoryDrugs.map((drug) => (
                      <DrugRow
                        key={drug.drug_id}
                        drug={drug}
                        isNightMode={isNightMode}
                        onView={() => onViewDrug(drug)}
                        onEdit={() => onEditDrug(drug)}
                        onManageBatches={() => onManageBatches(drug)}
                      />
                    ))}
                  </div>
                )}
              </Card>
            ))
          )}
          <div
            className={`text-xs text-center py-2 ${isNightMode ? 'text-slate-400' : 'text-gray-500'}`}
          >
            {Object.keys(groupedDrugs).length} categories ·{' '}
            {filteredDrugs.length} drugs
          </div>
        </div>
      ) : (
        <Card className="overflow-hidden">
          {/* Column header */}
          <div
            className={`flex items-center gap-4 px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b
            ${isNightMode ? 'bg-slate-800/60 text-slate-400 border-slate-700' : 'bg-gray-50 text-gray-500 border-gray-100'}`}
          >
            <div className="w-64">Drug</div>
            <div className="w-40">Category</div>
            <div className="w-20">Strength</div>
            <div className="w-32">Stock</div>
            <div className="w-24 text-right">Price</div>
            <div className="w-16 text-center">Status</div>
            <div className="ml-auto">Actions</div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-8 w-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-sm text-gray-400">Loading drugs…</span>
            </div>
          ) : filteredDrugs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div
                className={`p-4 rounded-2xl ${isNightMode ? 'bg-slate-700' : 'bg-gray-100'}`}
              >
                <Pill size={36} className="text-gray-400" />
              </div>
              <div className="text-center">
                <h3
                  className={`text-base font-semibold ${isNightMode ? 'text-slate-200' : 'text-gray-700'}`}
                >
                  {search || activeFilterCount > 0
                    ? 'No matching drugs'
                    : 'No drugs yet'}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {search || activeFilterCount > 0
                    ? 'Try adjusting your search or filters'
                    : 'Add drugs to your catalogue to get started'}
                </p>
              </div>
              {!search && activeFilterCount === 0 && (
                <Button onClick={onAddDrug}>
                  <Plus size={16} className="mr-1" /> Add First Drug
                </Button>
              )}
            </div>
          ) : (
            <div>
              {filteredDrugs.map((drug) => (
                <DrugRow
                  key={drug.drug_id}
                  drug={drug}
                  isNightMode={isNightMode}
                  onView={() => onViewDrug(drug)}
                  onEdit={() => onEditDrug(drug)}
                  onManageBatches={() => onManageBatches(drug)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && filteredDrugs.length > 0 && (
            <div
              className={`flex items-center justify-between px-4 py-3 border-t ${
                isNightMode
                  ? 'bg-slate-800/40 border-slate-700'
                  : 'bg-gray-50 border-gray-100'
              }`}
            >
              <div className="text-xs text-gray-500">
                Page {page} of {totalPages} · {drugsData?.total || 0} total
                drugs
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    page <= 1
                      ? 'text-gray-300 cursor-not-allowed'
                      : isNightMode
                        ? 'text-slate-300 hover:bg-slate-700'
                        : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (page <= 3) pageNum = i + 1;
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = page - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        page === pageNum
                          ? 'bg-indigo-600 text-white'
                          : isNightMode
                            ? 'text-slate-300 hover:bg-slate-700'
                            : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    page >= totalPages
                      ? 'text-gray-300 cursor-not-allowed'
                      : isNightMode
                        ? 'text-slate-300 hover:bg-slate-700'
                        : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Footer count (single page) */}
          {totalPages <= 1 && filteredDrugs.length > 0 && (
            <div
              className={`px-4 py-2.5 text-xs border-t ${
                isNightMode
                  ? 'bg-slate-800/40 text-slate-400 border-slate-700'
                  : 'bg-gray-50 text-gray-500 border-gray-100'
              }`}
            >
              Showing {filteredDrugs.length} drug
              {filteredDrugs.length !== 1 ? 's' : ''}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
